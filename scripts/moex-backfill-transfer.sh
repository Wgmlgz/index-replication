#!/usr/bin/env bash
set -euo pipefail

MOEX_SCHEMA="moex"
MOEX_TABLES=(
  indexes
  index_collections
  index_collection_memberships
  index_history_daily
  index_composition_daily
  security_history_daily
  sync_state
  data_coverage
  sync_runs
)

SCRIPT_NAME="$(basename "$0")"

usage() {
  cat <<'USAGE'
Usage:
  scripts/moex-backfill-transfer.sh dump [options]
  scripts/moex-backfill-transfer.sh restore --file PATH [options]
  scripts/moex-backfill-transfer.sh migrate --target-context CONTEXT [options]

Commands:
  dump       Export MOEX backfill tables from a compose postgres container.
  restore    Import MOEX backfill tables into a compose postgres container.
  migrate    Run dump + restore in one command.

Options:
  --file PATH              Dump file path (.sql.gz recommended).
  --source-context NAME    Docker context for source (default: current context).
  --source-project NAME    Compose project name for source (optional).
  --target-context NAME    Docker context for target (required for migrate).
  --target-project NAME    Compose project name for target (optional).
  --no-truncate            Do not truncate target MOEX tables before restore.
  --keep-file              Keep temp dump when running migrate.
  -h, --help               Show help.

Notes:
  - The script discovers the postgres container via compose labels.
  - If multiple postgres containers match a context and no project is provided,
    pass --source-project / --target-project to disambiguate.
  - restore expects SQL or gzipped SQL produced by this script.
USAGE
}

log() {
  echo "[$SCRIPT_NAME] $*"
}

die() {
  echo "[$SCRIPT_NAME] ERROR: $*" >&2
  exit 1
}

docker_cmd() {
  local context="$1"
  shift
  if [[ -n "$context" ]]; then
    docker --context "$context" "$@"
  else
    docker "$@"
  fi
}

resolve_postgres_container() {
  local context="$1"
  local project="$2"
  local -a filters
  local -a matches
  local line

  filters=(--filter "label=com.docker.compose.service=postgres")
  if [[ -n "$project" ]]; then
    filters+=(--filter "label=com.docker.compose.project=$project")
  fi

  while IFS= read -r line; do
    [[ -n "$line" ]] && matches+=("$line")
  done < <(docker_cmd "$context" ps "${filters[@]}" --format '{{.ID}} {{.Names}} {{.Label "com.docker.compose.project"}}')

  if [[ "${#matches[@]}" -eq 0 ]]; then
    if [[ -n "$project" ]]; then
      die "No postgres container found in context '$context' for compose project '$project'."
    fi
    die "No postgres container found in context '$context'."
  fi

  if [[ "${#matches[@]}" -gt 1 ]]; then
    printf '[%s] ERROR: Multiple postgres containers found in context %q:\n' "$SCRIPT_NAME" "${context:-current}" >&2
    printf '  %s\n' "${matches[@]}" >&2
    die "Pass --source-project or --target-project to pick one compose project."
  fi

  echo "${matches[0]%% *}"
}

read_postgres_env() {
  local context="$1"
  local container_id="$2"
  local env_dump
  local user pass db

  env_dump="$(docker_cmd "$context" inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container_id")"
  user="$(printf '%s\n' "$env_dump" | awk -F= '$1=="POSTGRES_USER"{sub(/^[^=]*=/, ""); print; exit}')"
  pass="$(printf '%s\n' "$env_dump" | awk -F= '$1=="POSTGRES_PASSWORD"{sub(/^[^=]*=/, ""); print; exit}')"
  db="$(printf '%s\n' "$env_dump" | awk -F= '$1=="POSTGRES_DB"{sub(/^[^=]*=/, ""); print; exit}')"

  [[ -n "$user" ]] || die "POSTGRES_USER is missing in container '$container_id'."
  [[ -n "$db" ]] || die "POSTGRES_DB is missing in container '$container_id'."

  printf '%s|%s|%s\n' "$user" "$pass" "$db"
}

assert_moex_tables_exist() {
  local context="$1"
  local container="$2"
  local pg_user="$3"
  local pg_pass="$4"
  local pg_db="$5"
  local sql="
SELECT CASE
  WHEN EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = '${MOEX_SCHEMA}'
      AND table_name = 'indexes'
  ) THEN 1
  ELSE 0
END;
"

  local detected
  detected="$(docker_cmd "$context" exec -e "PGPASSWORD=$pg_pass" "$container" \
    psql -h 127.0.0.1 -U "$pg_user" -d "$pg_db" -At -v ON_ERROR_STOP=1 -c "$sql")"
  detected="${detected//$'\n'/}"
  if [[ "$detected" != "1" ]]; then
    die "Expected ${MOEX_SCHEMA}.indexes in database '$pg_db'. Run MOEX schema/table migrations first."
  fi
}

build_table_args() {
  local -a args=()
  local t
  for t in "${MOEX_TABLES[@]}"; do
    args+=(--table="${MOEX_SCHEMA}.${t}")
  done
  printf '%s\n' "${args[@]}"
}

build_truncate_sql() {
  local sql="TRUNCATE TABLE "
  local t
  for t in "${MOEX_TABLES[@]}"; do
    sql+="${MOEX_SCHEMA}.${t}, "
  done
  sql="${sql%, }"
  sql+=" RESTART IDENTITY;"
  printf '%s\n' "$sql"
}

dump_counts_sql() {
  local sql=""
  local t
  for t in "${MOEX_TABLES[@]}"; do
    if [[ -n "$sql" ]]; then
      sql+=" UNION ALL "
    fi
    sql+="SELECT '${t}' AS table_name, COUNT(*) AS row_count FROM ${MOEX_SCHEMA}.${t}"
  done
  sql+=" ORDER BY table_name;"
  printf '%s\n' "$sql"
}

print_counts() {
  local context="$1"
  local container="$2"
  local pg_user="$3"
  local pg_pass="$4"
  local pg_db="$5"
  local title="$6"
  local sql

  sql="$(dump_counts_sql)"
  log "$title"
  docker_cmd "$context" exec -e "PGPASSWORD=$pg_pass" "$container" \
    psql -h 127.0.0.1 -U "$pg_user" -d "$pg_db" -At -F $'\t' -c "$sql" \
    | awk -F '\t' '{printf "  %-40s %s\n", $1, $2}'
}

do_dump() {
  local source_context="$1"
  local source_project="$2"
  local file="$3"
  local source_container source_env source_user source_pass source_db
  local -a table_args

  source_container="$(resolve_postgres_container "$source_context" "$source_project")"
  source_env="$(read_postgres_env "$source_context" "$source_container")"
  IFS='|' read -r source_user source_pass source_db <<<"$source_env"
  assert_moex_tables_exist "$source_context" "$source_container" "$source_user" "$source_pass" "$source_db"

  mkdir -p "$(dirname "$file")"
  while IFS= read -r arg; do
    table_args+=("$arg")
  done < <(build_table_args)

  log "Dumping MOEX tables from container '$source_container' (context: ${source_context:-current}, schema: ${MOEX_SCHEMA}) to '$file'."
  docker_cmd "$source_context" exec -e "PGPASSWORD=$source_pass" "$source_container" \
    pg_dump -h 127.0.0.1 -U "$source_user" -d "$source_db" \
      --data-only --no-owner --no-privileges "${table_args[@]}" \
    | gzip -c >"$file"

  print_counts "$source_context" "$source_container" "$source_user" "$source_pass" "$source_db" \
    "Source row counts:"
}

do_restore() {
  local target_context="$1"
  local target_project="$2"
  local file="$3"
  local truncate="$4"
  local target_container target_env target_user target_pass target_db truncate_sql

  [[ -f "$file" ]] || die "Dump file does not exist: $file"

  target_container="$(resolve_postgres_container "$target_context" "$target_project")"
  target_env="$(read_postgres_env "$target_context" "$target_container")"
  IFS='|' read -r target_user target_pass target_db <<<"$target_env"
  assert_moex_tables_exist "$target_context" "$target_container" "$target_user" "$target_pass" "$target_db"

  log "Restoring into container '$target_container' (context: ${target_context:-current}, schema: ${MOEX_SCHEMA}) from '$file'."
  if [[ "$truncate" == "true" ]]; then
    truncate_sql="$(build_truncate_sql)"
    log "Truncating target MOEX tables before import."
    docker_cmd "$target_context" exec -e "PGPASSWORD=$target_pass" "$target_container" \
      psql -h 127.0.0.1 -U "$target_user" -d "$target_db" -v ON_ERROR_STOP=1 -c "$truncate_sql"
  else
    log "Skipping truncate (--no-truncate was passed)."
  fi

  if [[ "$file" == *.gz ]]; then
    gzip -dc "$file" | docker_cmd "$target_context" exec -i -e "PGPASSWORD=$target_pass" "$target_container" \
      psql -h 127.0.0.1 -U "$target_user" -d "$target_db" -v ON_ERROR_STOP=1
  else
    cat "$file" | docker_cmd "$target_context" exec -i -e "PGPASSWORD=$target_pass" "$target_container" \
      psql -h 127.0.0.1 -U "$target_user" -d "$target_db" -v ON_ERROR_STOP=1
  fi

  print_counts "$target_context" "$target_container" "$target_user" "$target_pass" "$target_db" \
    "Target row counts after restore:"
}

main() {
  local command="${1:-}"
  local source_context=""
  local source_project=""
  local target_context=""
  local target_project=""
  local file=""
  local truncate="true"
  local keep_file="false"
  local generated_file="false"

  if [[ "$command" == "-h" || "$command" == "--help" ]]; then
    usage
    exit 0
  fi

  if [[ -z "$command" ]]; then
    usage
    exit 1
  fi
  shift

  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --source-context)
        source_context="${2:-}"
        shift 2
        ;;
      --source-project)
        source_project="${2:-}"
        shift 2
        ;;
      --target-context)
        target_context="${2:-}"
        shift 2
        ;;
      --target-project)
        target_project="${2:-}"
        shift 2
        ;;
      --file)
        file="${2:-}"
        shift 2
        ;;
      --no-truncate)
        truncate="false"
        shift
        ;;
      --keep-file)
        keep_file="true"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done

  case "$command" in
    dump)
      if [[ -z "$file" ]]; then
        file="./backups/moex-backfill-$(date +%Y%m%d-%H%M%S).sql.gz"
      fi
      do_dump "$source_context" "$source_project" "$file"
      log "Dump complete: $file"
      ;;
    restore)
      [[ -n "$file" ]] || die "restore requires --file PATH"
      do_restore "$target_context" "$target_project" "$file" "$truncate"
      log "Restore complete."
      ;;
    migrate)
      [[ -n "$target_context" ]] || die "migrate requires --target-context NAME"
      if [[ -z "$file" ]]; then
        file="./backups/moex-backfill-migrate-$(date +%Y%m%d-%H%M%S).sql.gz"
        generated_file="true"
      fi
      do_dump "$source_context" "$source_project" "$file"
      do_restore "$target_context" "$target_project" "$file" "$truncate"
      if [[ "$generated_file" == "true" && "$keep_file" != "true" ]]; then
        rm -f "$file"
        log "Removed temporary dump file."
      else
        log "Dump file kept at: $file"
      fi
      log "Migration complete."
      ;;
    *)
      die "Unknown command: $command"
      ;;
  esac
}

main "$@"
