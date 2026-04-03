#!/usr/bin/env bash

set -euo pipefail

required_vars=(
  ACR_USERNAME
  ACR_PASSWORD
  ALIYUN_ACCESS_KEY_ID
  ALIYUN_ACCESS_KEY_SECRET
  ALIYUN_INSTANCE_ID
)

for key in "${required_vars[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo "Missing secret: $key"
    exit 1
  fi
done
