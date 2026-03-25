```sh

  本地重新构建新镜像：

  docker compose build --no-cache nextjs
  docker images | grep blog

  docker save -o blog-linux-amd64.tar blog:latest
  scp ./blog-linux-amd64.tar root@47.108.133.169:/blog
  scp ./docker-compose.yml user@host:/path/to/target/
  scp ./.env user@host:/path/to/target/

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

  直接用 docker run 启动：

  docker run -d \
    --name blog \
    --restart unless-stopped \
    -p 3000:3000 \
    blog:latest

  查看状态和日志：

  docker ps
  docker logs -f blog

  停止和删除旧容器后重启：

  docker stop blog
  docker rm blog
  docker run -d \
    --name blog \
    --restart unless-stopped \
    --env-file .env \
    -p 3000:3000 \
    blog:latest

  如果你想在服务器上继续用 docker-compose 启动，而不是 docker run：

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
