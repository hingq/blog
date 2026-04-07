import { MetadataRoute } from 'next'
import siteMetadata from '@/data/siteMetadata'
import { getRobotsHost } from '@/lib/robots-host.mjs'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteMetadata.siteUrl}/sitemap.xml`,
  }
}
