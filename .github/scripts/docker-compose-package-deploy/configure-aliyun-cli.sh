#!/usr/bin/env bash

set -euo pipefail

: "${ALIYUN_ACCESS_KEY_ID:?ALIYUN_ACCESS_KEY_ID is required}"
: "${ALIYUN_ACCESS_KEY_SECRET:?ALIYUN_ACCESS_KEY_SECRET is required}"
: "${REGION_ID:?REGION_ID is required}"

aliyun configure set \
  --profile github \
  --mode AK \
  --access-key-id "$ALIYUN_ACCESS_KEY_ID" \
  --access-key-secret "$ALIYUN_ACCESS_KEY_SECRET" \
  --region "$REGION_ID"
