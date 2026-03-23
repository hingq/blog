```sh

  docker save -o blog-linux-amd64.tar blog:latest
  scp ./blog-linux-amd64.tar user@host:/path/to/target/
  scp ./docker-compose.yml user@host:/path/to/target/
  scp ./.env user@host:/path/to/target/

  如果远程 SSH 端口不是 22：

  scp -P 2222 ./blog-linux-amd64.tar user@host:/path/to/target/
  scp -P 2222 ./docker-compose.yml user@host:/path/to/target/
  scp -P 2222 ./.env user@host:/path/to/target/

  登录服务器：

  ssh user@host

  如果远程 SSH 端口不是 22：

  ssh -p 2222 user@host

  服务器上加载镜像：

  cd /path/to/target
  docker load -i blog-linux-amd64.tar
  docker images | grep blog

  直接用 docker run 启动：

  docker run -d \
    --name blog \
    --restart unless-stopped \
    --env-file .env \
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
  docker-compose up -d
  docker-compose ps
  docker-compose logs -f nextjs

  更新版本时：

  docker stop blog
  docker rm blog
  docker rmi blog:latest
  docker load -i blog-linux-amd64.tar
  docker run -d \
    --name blog \
    --restart unless-stopped \
    --env-file .env \
    -p 3000:3000 \
    blog:latest

  清理 tar 包：

  rm -f blog-linux-amd64.tar

```
