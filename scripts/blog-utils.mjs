import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { compile } from '@mdx-js/mdx'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import matter from 'gray-matter'
import path from 'node:path'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import readingTime from 'reading-time'
import { slug as githubSlug } from 'github-slugger'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { remarkAlert } from 'remark-github-blockquote-alert'
import {
  extractTocHeadings,
  remarkCodeTitles,
  remarkExtractFrontmatter,
  remarkImgToJsx,
} from 'pliny/mdx-plugins/index.js'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeCitation from 'rehype-citation'
import rehypeKatex from 'rehype-katex'
import rehypeKatexNoTranslate from 'rehype-katex-notranslate'
import rehypePresetMinify from 'rehype-preset-minify'
import rehypePrismPlus from 'rehype-prism-plus'
import rehypeSlug from 'rehype-slug'
import siteMetadata from '../data/siteMetadata.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const blogDir = path.join(projectRoot, 'data', 'blog')
const blogIndexUrl = process.env.BLOG_INDEX_URL
const minioEndpoint = process.env.MINIO_ENDPOINT
const minioRegion = process.env.MINIO_REGION || 'us-east-1'
const minioBucket = process.env.MINIO_BUCKET
const minioBlogIndexKey = process.env.MINIO_BLOG_INDEX_KEY
const minioAccessKeyId = process.env.MINIO_ACCESS_KEY_ID
const minioSecretAccessKey = process.env.MINIO_SECRET_ACCESS_KEY
const minioForcePathStyle = process.env.MINIO_FORCE_PATH_STYLE !== 'false'

const icon = fromHtmlIsomorphic(
  `
  <span class="content-header-link">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 linkicon">
  <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
  <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
  </svg>
  </span>
`,
  { fragment: true }
)

function hasMinioRuntimeConfig() {
  return Boolean(
    minioEndpoint && minioBucket && minioBlogIndexKey && minioAccessKeyId && minioSecretAccessKey
  )
}

function createMinioClient() {
  if (!hasMinioRuntimeConfig()) {
    throw new Error('MinIO runtime config is incomplete')
  }

  return new S3Client({
    endpoint: minioEndpoint,
    region: minioRegion,
    forcePathStyle: minioForcePathStyle,
    credentials: {
      accessKeyId: minioAccessKeyId,
      secretAccessKey: minioSecretAccessKey,
    },
  })
}

export function sortPosts(posts) {
  return [...posts].sort((a, b) => {
    if (a.date > b.date) return -1
    if (a.date < b.date) return 1
    return 0
  })
}

export function toCoreContent(post) {
  const { body, _raw, _id, ...rest } = post
  return rest
}

export function assertCompiledPost(post, index) {
  if (!post || typeof post !== 'object') {
    throw new Error(`Invalid compiled blog post at index ${index}: expected object`)
  }

  if (
    typeof post.title !== 'string' ||
    typeof post.date !== 'string' ||
    typeof post.slug !== 'string' ||
    typeof post.path !== 'string'
  ) {
    throw new Error(`Invalid compiled blog post at index ${index}: missing required metadata`)
  }

  if (!post.body || typeof post.body.code !== 'string') {
    throw new Error(`Invalid compiled blog post at index ${index}: missing body.code`)
  }
}

async function getMdxFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name)
      return entry.isDirectory() ? getMdxFiles(fullPath) : [fullPath]
    })
  )

  return files.flat().filter((file) => file.endsWith('.md') || file.endsWith('.mdx'))
}

async function compileMdx(source) {
  return String(
    await compile(source, {
      outputFormat: 'function-body',
      remarkPlugins: [
        remarkExtractFrontmatter,
        remarkGfm,
        remarkCodeTitles,
        remarkMath,
        remarkImgToJsx,
        remarkAlert,
      ],
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'prepend',
            headingProperties: {
              className: ['content-header'],
            },
            content: icon,
          },
        ],
        rehypeKatex,
        rehypeKatexNoTranslate,
        [rehypeCitation, { path: path.join(projectRoot, 'data') }],
        [rehypePrismPlus, { defaultLanguage: 'js', ignoreMissing: true }],
        rehypePresetMinify,
      ],
    })
  )
}

function getPrimaryImage(images) {
  if (Array.isArray(images)) {
    return images[0]
  }

  return images || siteMetadata.socialBanner
}

export async function compileLocalBlogPosts() {
  const files = await getMdxFiles(blogDir)

  return Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, 'utf8')
      const { data, content } = matter(source)
      const sourceFilePath = path.relative(path.join(projectRoot, 'data'), file).replace(/\\/g, '/')
      const flattenedPath = sourceFilePath.replace(/\.mdx?$/, '')

      return {
        title: data.title,
        date: new Date(data.date).toISOString(),
        tags: data.tags || [],
        lastmod: data.lastmod ? new Date(data.lastmod).toISOString() : undefined,
        draft: data.draft,
        summary: data.summary,
        images: data.images,
        authors: data.authors,
        layout: data.layout,
        bibliography: data.bibliography,
        canonicalUrl: data.canonicalUrl,
        readingTime: readingTime(content),
        slug: flattenedPath.replace(/^.+?\//, ''),
        path: flattenedPath,
        filePath: sourceFilePath,
        toc: extractTocHeadings(content),
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: data.title,
          datePublished: new Date(data.date).toISOString(),
          dateModified: data.lastmod
            ? new Date(data.lastmod).toISOString()
            : new Date(data.date).toISOString(),
          description: data.summary,
          image: getPrimaryImage(data.images),
          url: `${siteMetadata.siteUrl}/${flattenedPath}`,
        },
        body: {
          raw: content,
          code: await compileMdx(content),
        },
      }
    })
  )
}

export async function loadBlogIndexFromEnv() {
  if (hasMinioRuntimeConfig()) {
    const client = createMinioClient()
    const response = await client.send(
      new GetObjectCommand({
        Bucket: minioBucket,
        Key: minioBlogIndexKey,
      })
    )

    if (!response.Body) {
      throw new Error('MinIO returned an empty blog index body')
    }

    const raw = await response.Body.transformToString()
    const payload = JSON.parse(raw)
    if (!Array.isArray(payload)) {
      throw new Error('Invalid blog index payload: expected a top-level array')
    }

    payload.forEach((post, index) => assertCompiledPost(post, index))
    return payload
  }

  if (blogIndexUrl) {
    const response = await fetch(blogIndexUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch blog index: ${response.status} ${response.statusText}`)
    }

    const payload = await response.json()
    if (!Array.isArray(payload)) {
      throw new Error('Invalid blog index payload: expected a top-level array')
    }

    payload.forEach((post, index) => assertCompiledPost(post, index))
    return payload
  }

  throw new Error('Blog source is not configured. Set MinIO runtime env vars or BLOG_INDEX_URL.')
}

export function getTagKeys(posts) {
  return Array.from(
    new Set(posts.flatMap((post) => (post.tags || []).map((tag) => githubSlug(tag))))
  )
}
