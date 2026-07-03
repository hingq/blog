#!/bin/bash
set -e 

docker compose build

docker save -o blog.tar blog:latest

scp -i ~/.ssh/id_rsa ./blog.tar root@47.108.133.169:/blog