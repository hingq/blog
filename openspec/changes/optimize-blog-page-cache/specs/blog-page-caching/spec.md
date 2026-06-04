## ADDED Requirements

### Requirement: Blog post pages are cached indefinitely

The system SHALL serve blog post pages from a permanent full-route cache rather than recomputing them on a fixed time interval. Once a post page has been rendered, subsequent requests SHALL be served from cache until the page is explicitly revalidated.

#### Scenario: Second request is served from cache
- **WHEN** a blog post page has already been rendered once
- **AND** the post has not been revalidated since
- **THEN** subsequent requests are served from the cached HTML without re-rendering

#### Scenario: Cache does not expire on a timer
- **WHEN** an arbitrary amount of time passes after a post is first rendered
- **AND** no revalidation has been triggered for that post
- **THEN** the post is still served from cache and is not recomputed on a schedule

### Requirement: Un-prerendered slugs render on demand

The system SHALL render a blog post that was not prerendered on its first request and then cache it, instead of returning a 404 for valid but un-prerendered slugs.

#### Scenario: New post not in the prerender set
- **WHEN** a request arrives for a valid post slug that was not prerendered
- **THEN** the system renders the post on demand and serves it
- **AND** the rendered result is cached for subsequent requests

#### Scenario: Unknown slug
- **WHEN** a request arrives for a slug that does not correspond to any post
- **THEN** the system responds with a not-found result

### Requirement: Crawlers receive server-rendered HTML

The system SHALL continue to serve fully server-rendered HTML for blog post pages so that search engine crawlers index complete content.

#### Scenario: Crawler requests a post
- **WHEN** a crawler requests a blog post page
- **THEN** the response contains the fully rendered post HTML

### Requirement: Per-slug revalidation invalidates a single post

The revalidation API SHALL accept an optional post slug and, when provided, invalidate only that post's cached page and cached data, leaving all other cached pages intact.

#### Scenario: Revalidate a single post
- **WHEN** an authenticated revalidation request includes a specific post slug
- **THEN** that post's cached page and cached data are evicted
- **AND** the post is re-rendered on its next request
- **AND** other posts remain served from cache

#### Scenario: Full clear when no slug is provided
- **WHEN** an authenticated revalidation request does not include a slug
- **THEN** the system clears all blog caches and revalidates the entire route tree

#### Scenario: Unauthorized revalidation is rejected
- **WHEN** a revalidation request is missing or has an invalid bearer token
- **THEN** the system rejects the request and does not modify any cache
