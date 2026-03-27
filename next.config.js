const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
const siteMetadata = require('./data/siteMetadata')
const remoteImagePatterns = [
  {
    protocol: 'https',
    hostname: 'picsum.photos',
  },
]

const defaultCspHosts = {
  comments: ['giscus.app'],
  analytics: ['analytics.umami.is'],
  images: ['picsum.photos'],
  runtimeContent: [],
}

const toCspHost = (value) => {
  if (!value) {
    return null
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      return new URL(value).origin
    } catch {
      return null
    }
  }

  if (value.includes('/')) {
    return null
  }

  return value
}

const toCspHosts = (values) =>
  values.map(toCspHost).filter((value) => Boolean(value))

const appendCspHosts = (existing, values) => {
  const next = new Set(existing)
  values.forEach((value) => next.add(value))
  return [...next]
}

const isCommentsEnabled = Boolean(siteMetadata.comments?.provider)
const isUmamiEnabled = Boolean(siteMetadata.analytics?.umamiAnalytics?.umamiWebsiteId)

const runtimeContentHosts = toCspHosts([
  process.env.BLOG_INDEX_URL,
  process.env.SEARCH_INDEX_URL,
  process.env.MINIO_PUBLIC_BASE_URL,
  process.env.MINIO_ENDPOINT,
])

const imageHosts = appendCspHosts(
  defaultCspHosts.images,
  toCspHosts(
    [
      ...remoteImagePatterns.map(
        ({ protocol = 'https', hostname, port = '' }) =>
          hostname ? `${protocol}://${hostname}${port ? `:${port}` : ''}` : null
      ),
      process.env.MINIO_PUBLIC_BASE_URL,
      process.env.MINIO_ENDPOINT,
    ].filter(Boolean)
  )
)

const commentsHosts = isCommentsEnabled ? defaultCspHosts.comments : []
const analyticsHosts = isUmamiEnabled
  ? appendCspHosts(
      defaultCspHosts.analytics,
      toCspHosts([siteMetadata.analytics?.umamiAnalytics?.src])
    )
  : []
const connectHosts = appendCspHosts(
  ["'self'"],
  [...runtimeContentHosts, ...commentsHosts, ...analyticsHosts]
)
const scriptHosts = appendCspHosts(["'self'", "'unsafe-eval'", "'unsafe-inline'"], [
  ...commentsHosts,
  ...analyticsHosts,
])
const frameHosts = commentsHosts
const imgHosts = appendCspHosts(["'self'", 'blob:', 'data:'], imageHosts)

// CSP maintenance notes:
// 1) Comments: if comments.provider is enabled (giscus/utterances/disqus), add required domains below.
// 2) Analytics: if a provider is enabled in siteMetadata.analytics, sync script/connect domains below.
// 3) Remote images/object storage: when adding CDN/S3/MinIO domains, sync both `images.remotePatterns` and img-src.
// 4) Runtime content endpoints (SEARCH_INDEX_URL/BLOG_INDEX_URL/MINIO_*): keep connect-src aligned with deployment env.
const ContentSecurityPolicy = `
  default-src 'self';
  script-src ${scriptHosts.join(' ')};
  style-src 'self' 'unsafe-inline';
  img-src ${imgHosts.join(' ')};
  media-src *.s3.amazonaws.com;
  connect-src ${connectHosts.join(' ')};
  font-src 'self';
  frame-src ${frameHosts.length > 0 ? frameHosts.join(' ') : "'none'"};
`

const securityHeaders = [
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\n/g, ''),
  },
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-DNS-Prefetch-Control
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Feature-Policy
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const output = process.env.EXPORT ? 'export' : 'standalone'
const basePath = process.env.BASE_PATH || undefined
const unoptimized = process.env.UNOPTIMIZED ? true : undefined

/**
 * @type {import('next/dist/next-server/server/config').NextConfig}
 **/
module.exports = () => {
  const plugins = [withBundleAnalyzer]
  return plugins.reduce((acc, next) => next(acc), {
    output,
    basePath,
    reactStrictMode: true,
    trailingSlash: true,
    turbopack: {
      root: process.cwd(),
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
    pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
    images: {
      remotePatterns: remoteImagePatterns,
      unoptimized,
    },
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: securityHeaders,
        },
      ]
    },
    webpack: (config, options) => {
      config.module.rules.push({
        test: /\.svg$/,
        use: ['@svgr/webpack'],
      })

      return config
    },
  })
}
