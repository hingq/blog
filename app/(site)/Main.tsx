import Link from '@/components/Link'
import Tag from '@/components/Tag'
import siteMetadata from '@/data/siteMetadata'
import { formatDate } from 'pliny/utils/formatDate'

const MAX_DISPLAY = 5

function vtName(slug: string) {
  return `post-title-${slug.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

export default function Home({ posts }) {
  const compact = posts.slice(0, MAX_DISPLAY - 1)

  return (
    <>
      {/* Hero: blue-white wash aligned with the restored theme. */}
      <section className="relative">
        <div className="hero-mist pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <div className="space-y-4 pt-12 pb-5 md:space-y-5 md:pt-5 md:pb-5">
          <p className="text-base text-gray-500 dark:text-gray-400">{siteMetadata.description}</p>
        </div>
      </section>

      {/* 其余文章：mist 细 rule 分隔，呼吸感间距 */}
      <ul className="divide-mist divide-y">
        {!compact.length && <li className="py-8 text-gray-500">No posts found.</li>}
        {compact.map((post) => {
          const { slug, date, title, summary, tags } = post
          return (
            <li key={slug} className="py-8">
              <article className="space-y-2">
                <dl className="text-sm leading-6 font-medium text-gray-500 dark:text-gray-400">
                  <dt className="sr-only">Published on</dt>
                  <dd>
                    <time dateTime={date}>{formatDate(date, siteMetadata.locale)}</time>
                  </dd>
                </dl>
                <h2
                  className="text-2xl leading-7 font-semibold tracking-tight"
                  style={{ viewTransitionName: vtName(slug) }}
                >
                  <Link
                    href={`/blog/${slug}`}
                    className="hover:text-primary-600 dark:hover:text-primary-400 text-gray-900 transition-colors dark:text-gray-100"
                  >
                    {title}
                  </Link>
                </h2>
                <div className="flex flex-wrap">
                  {tags?.map((tag) => (
                    <Tag key={tag} text={tag} />
                  ))}
                </div>
                {summary && (
                  <div className="prose max-w-none pt-1 text-gray-500 dark:text-gray-400">
                    {summary}
                  </div>
                )}
              </article>
            </li>
          )
        })}
      </ul>

      {posts?.length > MAX_DISPLAY && (
        <div className="flex justify-end pt-8 text-base leading-6 font-medium">
          <Link
            href="/blog"
            className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
            aria-label="All posts"
          >
            All Posts &rarr;
          </Link>
        </div>
      )}
    </>
  )
}
