#!/usr/bin/env bash

set -euo pipefail

curl -fsSL https://aliyuncli.alicdn.com/aliyun-cli-linux-latest-amd64.tgz -o aliyun.tgz
tar -xzf aliyun.tgz
sudo mv aliyun /usr/local/bin/aliyun
aliyun version
