#!/usr/bin/env bash

set -euo pipefail

: "${ACR_USERNAME:?ACR_USERNAME is required}"
: "${ACR_PASSWORD:?ACR_PASSWORD is required}"
: "${REGISTRY:?REGISTRY is required}"

printf '%s' "$ACR_PASSWORD" | docker login \
  --username "$ACR_USERNAME" \
  --password-stdin \
  "$REGISTRY"
