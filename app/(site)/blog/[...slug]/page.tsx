import 'css/prism.css'
import 'katex/dist/katex.css'

import { components } from '@/components/MDXComponents'
import MDXRenderer from '@/components/MDXRenderer'
import PostSimple from '@/layouts/PostSimple'
import PostLayout from '@/layouts/PostLayout'
import PostBanner from '@/layouts/PostBanner'
import { Metadata } from 'next'
import siteMetadata from '@/data/siteMetadata'
import { notFound } from 'next/navigation'
import { getAdjacentPosts, getAllPosts, getPostBySlug } from '@/lib/blog'
import { getAuthorsBySlugs } from '@/lib/authors'
const defaultLayout = 'PostLayout'
// 永久缓存：渲染结果进入 Next.js 全路由缓存，不走时间驱动刷新。
export const revalidate = false
// 未预渲染的 slug 走按需 SSR 兜底并回填缓存，而非 404。
export const dynamicParams = true

export async function generateStaticParams(): Promise<{ slug: string[] }[]> {
  const posts = await getAllPosts()
  return posts.map((post) => ({ slug: post.slug.split('/') }))
}
const layouts = {
  PostSimple,
  PostLayout,
  PostBanner,
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>
}): Promise<Metadata | undefined> {
  const params = await props.params
  const slug = decodeURI(params.slug.join('/'))
  const post = await getPostBySlug(slug)
  if (!post) {
    return
  }

  const authorDetails = await getAuthorsBySlugs(post.authors || ['default'])

  const publishedAt = new Date(post.date).toISOString()
  const modifiedAt = new Date(post.lastmod || post.date).toISOString()
  const authors = authorDetails.map((author) => author.name)
  let imageList = [siteMetadata.socialBanner]
  if (post.images) {
    imageList = typeof post.images === 'string' ? [post.images] : post.images
  }
  const ogImages = imageList.map((img) => {
    return {
      url: img && img.includes('http') ? img : siteMetadata.siteUrl + img,
    }
  })

  return {
    title: post.title,
    description: post.summary,
    alternates: {
      canonical: './',
    },
    openGraph: {
      title: post.title,
      description: post.summary,
      siteName: siteMetadata.title,
      locale: siteMetadata.locale,
      type: 'article',
      publishedTime: publishedAt,
      modifiedTime: modifiedAt,
      url: './',
      images: ogImages,
      authors: authors.length > 0 ? authors : [siteMetadata.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.summary,
      images: imageList,
    },
  }
}

export default async function Page(props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params
  const slug = decodeURI(params.slug.join('/'))
  const [post, adjacent] = await Promise.all([getPostBySlug(slug), getAdjacentPosts(slug)])
  if (!post) {
    return notFound()
  }

  const authorDetails = await getAuthorsBySlugs(post.authors || ['default'])
  const mainContent = (({ body, _id, _raw, ...rest }) => rest)(post)
  const jsonLd = { ...(post.structuredData || {}) }
  jsonLd['author'] = authorDetails.map((author) => {
    return {
      '@type': 'Person',
      name: author.name,
    }
  })

  const code = post.body.code
  if (!code) {
    return notFound()
  }

  const Layout = layouts[post.layout || defaultLayout]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Layout
        content={mainContent}
        authorDetails={authorDetails}
        next={adjacent.next}
        prev={adjacent.prev}
      >
        <MDXRenderer code={code} components={components} toc={post.toc} />
      </Layout>
    </>
  )
}
