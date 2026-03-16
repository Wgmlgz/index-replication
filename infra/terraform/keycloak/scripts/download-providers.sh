#!/bin/sh

set -eu

NAMESPACE="${1:?provider namespace is required}"
NAME="${2:?provider name is required}"
VERSION="${3:?provider version is required}"
REPO="${4:-${NAMESPACE}/terraform-provider-${NAME}}"

TARGET_OS="${TARGETOS:-linux}"
case "${TARGETARCH:-$(uname -m)}" in
  x86_64|amd64) TARGET_ARCH="amd64" ;;
  aarch64|arm64) TARGET_ARCH="arm64" ;;
  *)
    echo "unsupported architecture: ${TARGETARCH:-$(uname -m)}" >&2
    exit 1
    ;;
esac

OS_ARCH="${TARGET_OS}_${TARGET_ARCH}"
PROVIDER_DIR="/providers/registry.terraform.io/$NAMESPACE/$NAME/$VERSION/$OS_ARCH"
TMP_DIR="/tmp/$NAME"
ARCHIVE_PATH="/tmp/${NAME}.zip"
ARCHIVE_URL="https://github.com/${REPO}/releases/download/v${VERSION}/terraform-provider-${NAME}_${VERSION}_${TARGET_OS}_${TARGET_ARCH}.zip"

mkdir -p "$PROVIDER_DIR"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

curl -fsSL -o "$ARCHIVE_PATH" "$ARCHIVE_URL"
unzip -q "$ARCHIVE_PATH" -d "$TMP_DIR"
cp "$TMP_DIR"/terraform-provider-"$NAME"* "$PROVIDER_DIR/"
chmod +x "$PROVIDER_DIR"/terraform-provider-"$NAME"*

rm -f "$ARCHIVE_PATH"
rm -rf "$TMP_DIR"
