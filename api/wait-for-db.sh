set -e

database_url="${DATABASE_URL:-}"
host=""
port=""

if [ -n "$database_url" ]; then
  without_scheme="${database_url#*://}"
  authority="${without_scheme%%/*}"
  hostport="${authority#*@}"
  host="${hostport%%:*}"
  port="${hostport#*:}"
  if [ "$port" = "$hostport" ]; then
    port=""
  fi
fi

host="${host:-${DB_HOST:-localhost}}"
port="${port:-${DB_PORT:-5432}}"

# Wait for the database to be available
until nc -z "$host" "$port"; do
  echo "Waiting for database at $host:$port..."
  sleep 1
done

echo "Database is up! Starting app."
exec "$@" 
