## Why

Blog post pages currently use a 10-minute ISR window (`revalidate = 600`), so on a 2-core ECS host the first request after each window pays the full RSC render cost, and readers can be served content up to 10 minutes stale. On top of that, every content publish calls `revalidatePath('/', 'layout')`, discarding the cached HTML for *all* pages even when a single post changed. We want post pages to stay cached indefinitely and refresh precisely per-slug on publish.

## What Changes

- Switch the post route from time-based ISR (`revalidate = 600`) to a permanent full-route cache (`revalidate = false`) with `dynamicParams = true`, so unknown slugs still SSR on demand and then cache.
- Optionally prerender known posts via `generateStaticParams()` so popular posts are warm without a first-visit penalty.
- Make the revalidate API accept an optional `slug` and invalidate only that post (`revalidatePath('/blog/' + slug)` plus per-slug data-cache eviction), while keeping the existing full-clear behavior as a fallback when no `slug` is provided.
- Add a per-slug data-cache eviction helper to `lib/blog.ts` alongside the existing `clearBlogCache()`.

Out of scope (deferred to future proposals): Nginx HTML caching, CDN caching/purge, and any change to the MDX compile pipeline or the existing TTL data cache design.

## Capabilities

### New Capabilities
- `blog-page-caching`: Defines the caching and on-demand revalidation behavior for blog post pages — permanent full-route caching, on-demand rendering of un-prerendered slugs, and precise per-slug invalidation via the authenticated revalidate API.

### Modified Capabilities
<!-- None: no existing specs in openspec/specs/. -->

## Impact

- `app/blog/[...slug]/page.tsx` — route segment config (`revalidate`, `dynamicParams`, optional `generateStaticParams`).
- `app/api/revalidate/route.ts` — optional per-slug branch; existing `REVALIDATE_TOKEN` Bearer auth unchanged.
- `lib/blog.ts` — new `clearBlogPostCache(slug)` helper next to `clearBlogCache()`.
- Behavior: publishers that want narrow invalidation should now send `{ "slug": "<post-slug>" }`; omitting it preserves today's full-tree clear.
