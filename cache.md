# 博客文章页渲染性能优化方案

> 场景：Next.js 15 App Router + MDX + ECS 2核4G 自托管，文章页首次加载 TTFB 过长，兼顾 SEO。

---

## 问题根因

文章页走服务端动态渲染，每次请求都完整经历：

```
MDX 解析 → Remark/Rehype（KaTeX + Prism）→ RSC 渲染 → HTML 序列化
```

KaTeX 和 Prism 是 CPU 密集型操作，2核机器上并发请求会互相竞争，TTFB 轻易拉到 500ms–2s。渲染结果没有被缓存，每次请求都重新计算，是核心问题所在。

---

## 解决思路

业内标准做法（知乎、Reddit 同类方案）：

> **SSR 负责保证 SEO 正确性，缓存负责保证 SSR 不在关键路径上。**

三层缓存叠加，按优先级依次实施：

```
访客请求
  → CDN（命中率 ~95%，10ms）          ← 第三层，可选
  → Nginx 缓存（命中率 ~99%，5ms）    ← 第二层
  → Next.js 进程内缓存（~100%，20ms） ← 第一层，优先实施
  → MDX 编译渲染（极少数首次请求）
```

SEO 全程不受影响，爬虫始终拿到完整的服务端渲染 HTML。

---

## 第一层：Next.js 进程内缓存

**优先级：高 / 改动量：小 / 本周可上线**

### 1. 新建缓存模块

```ts
// lib/page-cache.ts

const cache = new Map<string, { payload: string; ts: number }>()

export const pageCache = {
  get(key: string): string | null {
    const hit = cache.get(key)
    if (!hit) return null
    return hit.payload
  },
  set(key: string, payload: string): void {
    cache.set(key, { payload, ts: Date.now() })
  },
  del(key: string): void {
    cache.delete(key)
  },
  clear(): void {
    cache.clear()
  },
}
```

特点：零外部依赖，容器内自包含，容器不重启则缓存永远有效。

### 2. 文章页开启永久缓存

```ts
// app/blog/[...slug]/page.tsx

export const revalidate = false // 永久缓存，不走时间驱动刷新
export const dynamicParams = true // 未预渲染的 slug 走 SSR 兜底，不 404
```

`revalidate = false` 配合进程内缓存，第一个访客触发一次 MDX 编译，之后所有请求命中缓存，TTFB 从 1s+ 降至 20ms 以内。

### 3. revalidate 路由里清对应缓存

```ts
// app/api/revalidate/route.ts

import { pageCache } from '@/lib/page-cache'
import { revalidatePath } from 'next/cache'

export async function POST(req: Request) {
  const { secret, slug } = await req.json()

  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 清进程内缓存
  pageCache.del(slug)

  // 同时清 Next.js RSC 缓存
  revalidatePath(`/blog/${slug}`)

  return Response.json({ revalidated: true })
}
```

内容更新时调用此接口，精确清除对应文章的缓存，其他文章不受影响。

---

## 第二层：Nginx 层 HTML 缓存

**优先级：高 / 改动量：小 / 标准运维操作**

### Nginx 配置

```nginx
# /etc/nginx/conf.d/blog.conf

proxy_cache_path /var/cache/nginx/blog
  levels=1:2
  keys_zone=blog_cache:10m
  inactive=24h
  max_size=1g;

server {
  listen 80;
  server_name yourdomain.com;

  location / {
    proxy_cache blog_cache;
    proxy_cache_key "$scheme$host$uri";
    proxy_cache_valid 200 24h;

    # 缓存过期时继续返回旧内容，后台异步刷新，用户无感知
    proxy_cache_use_stale updating error timeout http_500 http_502 http_503;
    proxy_cache_background_update on;
    proxy_cache_lock on;

    add_header X-Cache-Status $upstream_cache_status;

    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # 静态资源长期缓存，不走 proxy_cache
  location /_next/static/ {
    proxy_pass http://127.0.0.1:3000;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

`proxy_cache_use_stale updating` 是关键配置：缓存过期时 Nginx 继续返回旧内容，同时在后台等 Next.js 完成重新渲染，用户完全感知不到缓存刷新的延迟。

### 手动清除 Nginx 缓存

在 revalidate 路由里追加清缓存逻辑：

```ts
// 方式一：删除对应缓存文件（需要知道缓存路径规则）
import { execSync } from 'child_process'
execSync(`find /var/cache/nginx/blog -name "*.cache" | xargs rm -f`)

// 方式二：重启 Nginx worker（博客场景够用，成本低）
execSync('nginx -s reload')
```

对于个人博客，文章更新频率低，直接 `nginx -s reload` 清全部缓存是最简单可靠的做法。

---

## 第三层：阿里云 CDN（可选）

**优先级：低 / 流量上来再加**

### Next.js 设置 HTTP 缓存头

```ts
// next.config.js

const nextConfig = {
  async headers() {
    return [
      {
        source: '/blog/:slug*',
        headers: [
          {
            key: 'Cache-Control',
            // CDN 缓存 1 小时，过期后继续用旧内容同时异步刷新
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}
```

### 内容更新时刷新 CDN

阿里云 CDN 提供缓存刷新 API，在 revalidate 路由里调用：

```ts
import CDN from '@alicloud/cdn20180510'

async function purgeAliyunCDN(slug: string) {
  const client = new CDN.default({ accessKeyId, accessKeySecret })
  await client.refreshObjectCaches({
    ObjectPath: `https://yourdomain.com/blog/${slug}`,
    ObjectType: 'File',
  })
}
```

---

## 完整的内容更新链路

```
内容变更（git push 或 MinIO 上传）
  ↓
调用 POST /api/revalidate { secret, slug }
  ↓
清除进程内缓存（pageCache.del）
  ↓
清除 Next.js RSC 缓存（revalidatePath）
  ↓
清除 Nginx 缓存（nginx -s reload）
  ↓
（可选）刷新阿里云 CDN 缓存
  ↓
下一个访客触发一次 SSR 重新渲染并回填各层缓存
```

---

## 预期效果

| 指标                 | 优化前   | 优化后                   |
| -------------------- | -------- | ------------------------ |
| 文章页 TTFB          | 500ms–2s | 5–20ms（缓存命中）       |
| SEO                  | 正常     | 不变                     |
| KaTeX/Prism CPU 开销 | 每次请求 | 只有首次或 revalidate 后 |
| 新文章首次访问       | 每次都慢 | 只有第一个访客慢         |
| 打包频率             | 不变     | 不变                     |

---

## 实施顺序建议

1. **本周**：加 `export const revalidate = false` + `lib/page-cache.ts` + revalidate 路由清缓存，部署观察 TTFB 变化
2. **下周**：配置 Nginx proxy_cache，加 `X-Cache-Status` 响应头方便调试
3. **后续**：流量增长后再评估是否接入阿里云 CDN

第一步两处改动就能解决 80% 的问题，风险极低，优先落地。
