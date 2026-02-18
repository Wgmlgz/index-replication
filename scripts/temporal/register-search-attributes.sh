#!/bin/sh
set -eu

TEMPORAL_ADDRESS="${TEMPORAL_ADDRESS:-temporal:7233}"

echo "Waiting for Temporal server at ${TEMPORAL_ADDRESS}..."
max_attempts=20
attempt=0
until timeout 5 tctl --address "$TEMPORAL_ADDRESS" admin cluster describe >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Temporal cluster is not ready after $max_attempts attempts"
    exit 1
  fi
  echo "Temporal not ready yet, waiting... (attempt $attempt/$max_attempts)"
  sleep 3
done

echo "Registering custom search attributes..."
for pair in \
  "MoexDataset Keyword" \
  "MoexSecid Keyword" \
  "MoexMode Keyword" \
  "MoexProgress Keyword" \
  "MoexProcessed Int" \
  "MoexTotal Int"
do
  attr="$(echo "$pair" | awk '{print $1}')"
  attr_type="$(echo "$pair" | awk '{print $2}')"
  if tctl --address "$TEMPORAL_ADDRESS" admin cluster get-search-attributes 2>/dev/null | grep -q "$attr"; then
    echo "Search attribute '$attr' already exists"
    continue
  fi
  if tctl --address "$TEMPORAL_ADDRESS" admin cluster add-search-attributes --name "$attr" --type "$attr_type" >/dev/null 2>&1; then
    echo "Search attribute '$attr' registered"
  else
    echo "Search attribute '$attr' registration skipped (already exists or unsupported)"
  fi
done

echo "Search attribute registration complete"
