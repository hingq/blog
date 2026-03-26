import { NewsletterAPI } from 'pliny/newsletter'
import siteMetadata from '@/data/siteMetadata'

export const dynamic = 'force-static'

const newsletterProvider = siteMetadata.newsletter?.provider
const handler = newsletterProvider ? NewsletterAPI({ provider: newsletterProvider }) : null

export async function GET(request: Request) {
  if (!handler) {
    return new Response('Newsletter is not configured', { status: 404 })
  }

  return handler(request)
}

export async function POST(request: Request) {
  if (!handler) {
    return new Response('Newsletter is not configured', { status: 404 })
  }

  return handler(request)
}
