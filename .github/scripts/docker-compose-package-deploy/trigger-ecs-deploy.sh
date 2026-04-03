#!/usr/bin/env bash

set -euo pipefail

: "${DEPLOY_CMD:?DEPLOY_CMD is required}"
: "${REGION_ID:?REGION_ID is required}"
: "${INSTANCE_ID:?INSTANCE_ID is required}"
: "${GITHUB_ENV:?GITHUB_ENV is required}"

echo "Triggering ECS deploy"
echo "REGION_ID=$REGION_ID"
echo "INSTANCE_ID_SET=${INSTANCE_ID:+yes}"
echo "INSTANCE_ID_LENGTH=${#INSTANCE_ID}"

result=$(
  aliyun ecs RunCommand \
    --profile github \
    --RegionId "$REGION_ID" \
    --Name "deploy-next-blog" \
    --Type "RunShellScript" \
    --CommandContent "$(printf '%s' "$DEPLOY_CMD" | base64 -w 0)" \
    --ContentEncoding "Base64" \
    --InstanceId.1 "$INSTANCE_ID" \
    --Timeout 1800
)

echo "$result"

command_id=$(printf '%s' "$result" | python3 -c 'import json, sys; print(json.load(sys.stdin)["CommandId"])')
echo "COMMAND_ID=$command_id" >> "$GITHUB_ENV"
