    "https:\/\/docker.m.daocloud.io"

```sh

  本地重新构建新镜像：

  docker compose build --no-cache nextjs
  docker images | grep blog

  docker save -o blog-linux-amd64.tar blog:latest
  scp ./blog-linux-amd64.tar root@47.108.133.169:/blog
  scp ./docker-compose.yml root@47.108.133.169:/blog
  scp ./.env root@47.108.133.169:/blog

  登录服务器：

  ssh user@host

  如果远程 SSH 端口不是 22：

  ssh -p 2222 user@host

  服务器上加载镜像：

  cd /path/to/target
  docker load -i blog-linux-amd64.tar
  docker images | grep blog
  docker compose down
  docker compose up -d --force-recreate nextjs


  查看状态和日志：

  docker ps
  docker logs -f blog

  停止和删除旧容器后重启：

  docker stop blog
  docker rm blog


  cd /path/to/target
  # docker-compose.yml 已固定使用宿主机本地地址，不受 .env 同名变量影响
  docker compose down
  docker compose up -d --force-recreate nextjs
  docker compose ps
  docker compose logs -f nextjs

  更新版本时：

  docker compose down
  docker rmi blog:latest
  docker load -i blog-linux-amd64.tar
  docker compose up -d --force-recreate nextjs

  清理 tar 包：

  rm -f blog-linux-amd64.tar

```

## GitHub Actions 安全配置（密码方式）

如果你使用 `DEPLOY_PASSWORD`（而不是 SSH Key），建议按下面方式配置，避免明文泄露：

1. 在 GitHub 仓库中创建 **Environment**（名称使用 `blog`）。
2. 将以下敏感信息放到 **Environment secrets**（不要放到代码仓库、不要写进 workflow 文件）：
   - `DEPLOY_HOST`
   - `DEPLOY_USER`
   - `DEPLOY_PASSWORD`
   - `DEPLOY_PORT`（可选）
3. 给该 Environment 开启保护策略：
   - Required reviewers（发布前人工审批）
   - Restrict branches（只允许 `main`）
4. 定期轮换服务器密码，并避免多人共享同一账号。
5. 若条件允许，长期建议改成 SSH Key（可撤销、可分账号管理、审计更清晰）。

> 注意：GitHub Secrets 在日志中会自动做脱敏，但如果你主动 `echo` 明文变量，仍有泄露风险。

> 说明：当前工作流会将仓库根目录的 `.env` 文件一并上传到服务器 `/blog`。


### 在哪里配置（是的，要在 GitHub 仓库里配置）

进入你的仓库页面后按下面路径操作：

1. `Settings` → `Environments` → 新建 `blog`。
2. 进入 `blog` → `Environment secrets` → `Add secret`，依次添加：
   - `DEPLOY_HOST`
   - `DEPLOY_USER`
   - `DEPLOY_PASSWORD`（或 `DEPLOY_SSH_KEY`）
   - `DEPLOY_PORT`（可选）
3. 在 `blog` 的保护规则中设置：
   - `Required reviewers`
   - `Deployment branches` 仅 `main`

如果你不使用 Environment，也可以放在仓库级 `Settings` → `Secrets and variables` → `Actions`，
但不如 Environment 安全、可控。

