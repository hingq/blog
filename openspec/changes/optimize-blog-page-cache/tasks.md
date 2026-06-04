## 1. Route caching config

- [x] 1.1 In `app/blog/[...slug]/page.tsx`, change `export const revalidate = 600` to `export const revalidate = false`
- [x] 1.2 Add `export const dynamicParams = true` to the same route
- [x] 1.3 (Optional) Add `generateStaticParams()` returning known slugs from `getAllPosts()` to prerender popular posts

## 2. Per-slug data-cache eviction

- [x] 2.1 In `lib/blog.ts`, add and export `clearBlogPostCache(slug)` that does `postCache.delete(slug)` and `indexCache.clear()`

## 3. Revalidate API

- [x] 3.1 In `app/api/revalidate/route.ts`, read an optional `slug` from the JSON body (keep `REVALIDATE_TOKEN` bearer auth unchanged)
- [x] 3.2 When `slug` is present: call `clearBlogPostCache(slug)` and `revalidatePath('/blog/' + slug)`
- [x] 3.3 When `slug` is absent: keep existing `clearBlogCache()` + `revalidatePath('/', 'layout')` fallback

## 4. Verify

- [x] 4.1 Run `yarn lint`
- [x] 4.2 Run `yarn build` and confirm `/blog/[...slug]` is reported as cache-capable
