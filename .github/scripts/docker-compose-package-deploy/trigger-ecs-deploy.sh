#!/usr/bin/env bash

set -euo pipefail

: "${DEPLOY_CMD:?DEPLOY_CMD is required}"
: "${REGION_ID:?REGION_ID is required}"
: "${INSTANCE_ID:?INSTANCE_ID is required}"
: "${GITHUB_ENV:?GITHUB_ENV is required}"

result=$(
  aliyun ecs RunCommand \
    --profile github \
    --RegionId "$REGION_ID" \
    --Name "deploy-next-blog" \
    --Type "RunShellScript" \
    --InstanceId.1 "$INSTANCE_ID" \
    --CommandContent "$(printf '%s' "$DEPLOY_CMD" | base64 -w 0)" \
    --Timeout 1800
)

echo "$result"

command_id=$(printf '%s' "$result" | python3 -c 'import json, sys; print(json.load(sys.stdin)["CommandId"])')
echo "COMMAND_ID=$command_id" >> "$GITHUB_ENV"
