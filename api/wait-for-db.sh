set -e

host="${POSTGRES_HOST:-localhost}"
port="${POSTGRES_PORT:-5432}"

# Wait for the database to be available
until nc -z "$host" "$port"; do
  echo "Waiting for database at $host:$port..."
  sleep 1
done

echo "Database is up! Starting app."
exec "$@" 
