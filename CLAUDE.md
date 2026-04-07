# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev          # Start development server
yarn build        # Production build
yarn serve        # Serve production build locally
yarn lint         # Lint and auto-fix (ESLint + Prettier)
yarn analyze      # Build with bundle analysis
yarn publish:content  # Publish content via scripts/publish-content.mjs
```

Tests are located in `/tests/` as `.test.cjs` files. There is no test runner script in package.json; tests appear to be run as part of CI.

Pre-commit hooks automatically run ESLint and Prettier via Husky + lint-staged.

## Architecture

**Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, MDX

### Content Pipeline

Blog posts live in `/data/blog/` as Markdown/MDX files. Pliny + Contentlayer process them through a Remark/Rehype pipeline (math via KaTeX, syntax highlighting via Prism+, citations, GitHub alerts). The processed content is rendered by `MDXRenderer.tsx` using custom components from `MDXComponents.tsx`.

A runtime content source (`/lib/runtime-content-source.mjs`) can fetch content from an external URL (MinIO/S3), configured via `BLOG_INDEX_URL` and `SEARCH_INDEX_URL` env vars — this enables the Docker deployment to pull content without rebuilding the image.

### Routing & Pages

All pages use Next.js App Router under `/app/`:
- `/app/blog/` — dynamic blog post pages with nested slug routing
- `/app/tags/` — tag-based archives
- `/app/api/` — server-side API routes (search index, etc.)
- `/app/robots.ts` and `/app/sitemap.ts` — generated at build time

### Layouts

Six layout templates in `/layouts/` are selected per-post via frontmatter (`layout` field):
- `PostLayout` — two-column with sidebar metadata (default)
- `PostSimple` — minimal single-column
- `PostBanner` — with hero banner image
- `ListLayout` / `ListLayoutWithTags` — blog list views
- `AuthorLayout` — author profile

### Configuration

`/data/siteMetadata.js` is the central config for site title, analytics (Umami), comments (Twikoo), search, and social links.

`next.config.js` manages CSP headers, remote image patterns, and SVG loading (via @svgr/webpack). Security headers are applied to all routes.

### Path Aliases

TypeScript paths (configured in `tsconfig.json`):
- `@/components` → `./components`
- `@/data` → `./data`
- `@/layouts` → `./layouts`
- `@/lib` → `./lib`
- `@/types` → `./types`
- `@/css` → `./css`

## Deployment

Docker image is built for `linux/amd64` and pushed to Alibaba Cloud ACR via GitHub Actions (`.github/workflows/docker-compose-package-deploy.yml`), then deployed to ECS. Version is auto-bumped on merge to main.

Static export is supported via `EXPORT=1` environment variable.

## Code Style

- No semicolons, single quotes, print width 100 (Prettier)
- ESLint flat config (v9) with TypeScript + Next.js + a11y rules
- React 19: `react/react-in-jsx-scope` is disabled (no need to import React)