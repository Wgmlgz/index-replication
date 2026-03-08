#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

ADMINER_HTTPS_PORT="${TAILSCALE_ADMINER_HTTPS_PORT:-8443}"
TEMPORAL_UI_HTTPS_PORT="${TAILSCALE_TEMPORAL_UI_HTTPS_PORT:-9443}"
ADMINER_LOCAL_URL="${TAILSCALE_ADMINER_LOCAL_URL:-http://127.0.0.1:8081}"
TEMPORAL_UI_LOCAL_URL="${TAILSCALE_TEMPORAL_UI_LOCAL_URL:-http://127.0.0.1:8233}"

usage() {
  cat <<'EOF'
Usage:
  scripts/tailscale-admin-access.sh enable
  scripts/tailscale-admin-access.sh disable
  scripts/tailscale-admin-access.sh status

Environment overrides:
  TAILSCALE_ADMINER_HTTPS_PORT      Tailscale HTTPS port for Adminer (default: 8443)
  TAILSCALE_TEMPORAL_UI_HTTPS_PORT  Tailscale HTTPS port for Temporal UI (default: 9443)
  TAILSCALE_ADMINER_LOCAL_URL        Local Adminer URL target (default: http://127.0.0.1:8081)
  TAILSCALE_TEMPORAL_UI_LOCAL_URL    Local Temporal UI URL target (default: http://127.0.0.1:8233)

Notes:
  - This uses `tailscale serve` (private to your tailnet), not Funnel.
  - Both mappings are configured in background mode (`--bg`).
EOF
}

log() {
  echo "[$SCRIPT_NAME] $*"
}

die() {
  echo "[$SCRIPT_NAME] ERROR: $*" >&2
  exit 1
}

require_tailscale() {
  command -v tailscale >/dev/null 2>&1 || die "'tailscale' CLI is not installed."
}

enable() {
  require_tailscale

  tailscale serve --bg --https="$ADMINER_HTTPS_PORT" "$ADMINER_LOCAL_URL"
  tailscale serve --bg --https="$TEMPORAL_UI_HTTPS_PORT" "$TEMPORAL_UI_LOCAL_URL"

  log "Enabled private admin access via Tailscale Serve."
  log "Adminer  : https://<this-node>.<tailnet>.ts.net:$ADMINER_HTTPS_PORT -> $ADMINER_LOCAL_URL"
  log "Temporal : https://<this-node>.<tailnet>.ts.net:$TEMPORAL_UI_HTTPS_PORT -> $TEMPORAL_UI_LOCAL_URL"
  tailscale serve status
}

disable() {
  require_tailscale

  tailscale serve --https="$ADMINER_HTTPS_PORT" off || true
  tailscale serve --https="$TEMPORAL_UI_HTTPS_PORT" off || true

  log "Disabled Tailscale Serve mappings on ports $ADMINER_HTTPS_PORT and $TEMPORAL_UI_HTTPS_PORT."
  tailscale serve status
}

status() {
  require_tailscale
  tailscale serve status
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    enable)
      enable
      ;;
    disable)
      disable
      ;;
    status)
      status
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      usage
      die "Unknown command: ${cmd:-<empty>}"
      ;;
  esac
}

main "$@"
