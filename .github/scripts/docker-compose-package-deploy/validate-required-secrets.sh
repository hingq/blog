#!/usr/bin/env bash

set -euo pipefail

required_vars=(
  SSH_PRIVATE_KEY
)

for key in "${required_vars[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo "Missing secret: $key"
    exit 1
  fi
done
