#!/usr/bin/env bash
set -euo pipefail

enable() {
  tailscale serve --bg --https=8081 http://127.0.0.1:8081
  tailscale serve --bg --https=8233 http://127.0.0.1:8233
}

disable() {
  tailscale serve --https=8081 off || true
  tailscale serve --https=8233 off || true
}

case "${1:-}" in
  enable) enable ;;
  disable) disable ;;
  *) echo "Usage: $0 enable|disable" >&2; exit 1 ;;
esac
