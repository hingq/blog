import { genPageMetadata } from 'app/seo'
import ListLayout from '@/layouts/ListLayoutWithTags'
import { getAllCorePosts, getTagCounts } from '@/lib/blog'

const POSTS_PER_PAGE = 5
export const dynamic = 'force-dynamic'

export const metadata = genPageMetadata({ title: 'Blog' })

export default async function BlogPage(props: { searchParams: Promise<{ page: string }> }) {
  const [posts, tagCounts] = await Promise.all([getAllCorePosts(), getTagCounts()])
  const pageNumber = 1
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE)
  const initialDisplayPosts = posts.slice(0, POSTS_PER_PAGE * pageNumber)
  const pagination = {
    currentPage: pageNumber,
    totalPages: totalPages,
  }

  return (
    <ListLayout
      posts={posts}
      initialDisplayPosts={initialDisplayPosts}
      pagination={pagination}
      tagCounts={tagCounts}
      title="All Posts"
    />
  )
}
