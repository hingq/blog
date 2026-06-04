## Context

Blog posts are rendered by `app/blog/[...slug]/page.tsx`, which currently declares `export const revalidate = 600` (10-minute ISR). Post data (the already-compiled MDX `body.code`, with KaTeX/Prism output baked in at compile time) is fetched through `lib/blog.ts` and held in a 10-minute TTL data cache (`lib/cache.ts`). Content publishes hit `app/api/revalidate/route.ts`, which authenticates with a `REVALIDATE_TOKEN` Bearer token, calls `clearBlogCache()`, then `revalidatePath('/', 'layout')`.

The host is a 2-core ECS box, so per-request RSC rendering is the cost we want to avoid on the hot path. Because KaTeX/Prism already run at compile time, the remaining per-request work is RSC rendering and HTML serialization — exactly what Next.js's full-route cache eliminates when a page is cached.

## Goals / Non-Goals

**Goals:**
- Keep rendered post HTML cached indefinitely instead of for a 10-minute window.
- Invalidate a single post precisely on publish, leaving every other cached page intact.
- Preserve SEO: crawlers continue to receive fully server-rendered HTML.
- Reuse existing infrastructure (`lib/cache.ts`, `REVALIDATE_TOKEN` auth) rather than adding parallel caching layers.

**Non-Goals:**
- No Nginx HTML cache, CDN cache, or CDN purge (deferred to future proposals).
- No custom in-process HTML `Map` (as sketched in `cache.md`) — redundant with Next's full-route cache and hard to populate from an RSC.
- No change to the MDX compile pipeline or the TTL data-cache design.

## Decisions

**1. Permanent full-route cache over time-based ISR.**
Set `revalidate = false` and `dynamicParams = true` on the post route. With `dynamicParams = true`, slugs not covered by `generateStaticParams` are rendered on demand on first request and then cached, so new posts never 404. Chosen over `revalidate = 600` (still recomputes every window) and over a manual HTML `Map` (Next already provides the full-route cache; intercepting rendered HTML from a server component is awkward and duplicative).

**2. Per-slug invalidation in the revalidate route, with full-clear fallback.**
The route accepts an optional `slug` in the JSON body. When present: evict that post from the data cache and call `revalidatePath('/blog/' + slug)`. When absent: keep today's `clearBlogCache()` + `revalidatePath('/', 'layout')`. This keeps existing callers working unchanged while letting publishers opt into narrow invalidation. Auth (`REVALIDATE_TOKEN` Bearer) is untouched.

**3. New `clearBlogPostCache(slug)` helper in `lib/blog.ts`.**
Encapsulates the per-slug eviction so the route does not reach into module internals. It deletes the slug from `postCache` and also clears `indexCache`, because adjacency (prev/next) and the index can shift when a post changes.

**4. `generateStaticParams()` is optional.**
Returning known slugs from `getAllPosts()` warms popular posts at build/start, avoiding a first-visit render penalty. It is safe to ship without it (on-demand rendering covers all slugs); include it if build-time data access is reliable in the deployment.

## Risks / Trade-offs

- **Stale content if a publish forgets to call revalidate** → Permanent cache means nothing expires on its own. Mitigation: the publish path already calls the revalidate API; keep the full-clear fallback available for bulk/uncertain updates.
- **`generateStaticParams` at build time may lack a content source** → `lib/blog.ts` already degrades to an empty index when no source is configured, so build won't crash; un-prerendered slugs simply render on demand. Mitigation: rely on `dynamicParams = true`.
- **Per-slug path mismatch** → `revalidatePath('/blog/' + slug)` must match the actual route. Slugs may contain `/` (nested routing); pass the same joined slug the page uses. Mitigation: verify with the curl test in tasks before relying on it.
- **Rollback** → revert the three edits; `revalidate = 600` restores prior behavior with no data migration.
