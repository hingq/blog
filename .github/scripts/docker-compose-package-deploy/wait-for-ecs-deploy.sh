#!/usr/bin/env bash

set -euo pipefail

: "${REGION_ID:?REGION_ID is required}"
: "${COMMAND_ID:?COMMAND_ID is required}"

for _ in $(seq 1 30); do
  result=$(
    aliyun ecs DescribeInvocationResults \
      --profile github \
      --RegionId "$REGION_ID" \
      --CommandId "$COMMAND_ID" \
      --ContentEncoding PlainText
  )

  echo "$result"

  status=$(
    printf '%s' "$result" | python3 -c '
import json
import sys

data = json.load(sys.stdin)
items = data.get("Invocation", {}).get("InvocationResults", {}).get("InvocationResult", [])

if not items:
    print("Pending")
else:
    print(items[0].get("InvocationStatus", "Pending"))
'
  )

  echo "InvocationStatus=$status"

  if [ "$status" = "Finished" ] || [ "$status" = "Success" ]; then
    exit 0
  fi

  if [ "$status" = "Failed" ] || [ "$status" = "Stopped" ] || [ "$status" = "Timeout" ]; then
    exit 1
  fi

  sleep 10
done

echo "Deploy result timeout"
exit 1
