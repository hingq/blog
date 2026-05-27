#!/usr/bin/env bash

set -euo pipefail

: "${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY is required}"

echo "🚀 Triggering ECS deploy..."
echo "REGION_ID=$REGION_ID"

# 1. 本地构建与打包
echo "📦 Building docker image..."
docker compose build --no-cache nextjs

echo "💾 Saving image to tar archive..."
docker save -o blog-linux-amd64.tar blog:latest

# 2. 动态注入并保护 SSH 私钥
echo "🔑 Setting up temporary SSH key..."
SSH_KEY_FILE=$(mktemp)
echo "$SSH_PRIVATE_KEY" > "$SSH_KEY_FILE"
chmod 600 "$SSH_KEY_FILE"

#  确保脚本退出时（无论成功还是失败），同时清理临时私钥和本地 tar 包
trap 'rm -f "$SSH_KEY_FILE" ./blog-linux-amd64.tar; echo "🧹 Local temporary files cleaned."' EXIT

# 3. 免密上传压缩包
echo "🚚 Uploading tar archive to remote server..."
scp -o StrictHostKeyChecking=no -i "$SSH_KEY_FILE" ./blog-linux-amd64.tar root@47.108.133.169:/blog/

# 4. 远程执行安装脚本
echo "🏃 Executing remote deploy script..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_FILE" root@47.108.133.169 "/bin/bash /blog/install.sh"

echo "🎉 Deployment completed successfully!"