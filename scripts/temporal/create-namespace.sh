#!/bin/sh
set -eu

NAMESPACE="${DEFAULT_NAMESPACE:-default}"
TEMPORAL_ADDRESS="${TEMPORAL_ADDRESS:-temporal:7233}"

echo "Waiting for Temporal server port to be available..."
nc -z -w 10 "$(echo "$TEMPORAL_ADDRESS" | cut -d: -f1)" "$(echo "$TEMPORAL_ADDRESS" | cut -d: -f2)"
echo 'Temporal server port is available'

echo 'Creating namespace...'
max_attempts=10
attempt=0
until timeout 5 tctl --address "$TEMPORAL_ADDRESS" namespace list >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Server not ready after $max_attempts attempts"
    exit 1
  fi
  echo "Server not ready yet, waiting... (attempt $attempt/$max_attempts)"
  sleep 5
done

if timeout 5 tctl --address "$TEMPORAL_ADDRESS" --ns "$NAMESPACE" namespace describe >/dev/null 2>&1; then
  echo "Namespace '$NAMESPACE' already exists"
  exit 0
fi

attempt=0
until timeout 5 tctl --address "$TEMPORAL_ADDRESS" --ns "$NAMESPACE" namespace register --rd 3 >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Failed to create/verify namespace after $max_attempts attempts"
    exit 1
  fi
  echo "Server not ready yet, waiting... (attempt $attempt/$max_attempts)"
  sleep 5
done

echo "Namespace '$NAMESPACE' created"
