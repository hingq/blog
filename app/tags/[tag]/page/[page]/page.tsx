import ListLayout from '@/layouts/ListLayoutWithTags'
import { notFound } from 'next/navigation'
import { getPostsByTag, getTagCounts } from '@/lib/blog'

const POSTS_PER_PAGE = 5
export const dynamic = 'force-dynamic'

export default async function TagPage(props: { params: Promise<{ tag: string; page: string }> }) {
  const params = await props.params
  const tag = decodeURI(params.tag)
  const title = tag[0].toUpperCase() + tag.split(' ').join('-').slice(1)
  const pageNumber = parseInt(params.page)
  const [filteredPosts, tagCounts] = await Promise.all([getPostsByTag(tag), getTagCounts()])
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE)

  // Return 404 for invalid page numbers or empty pages
  if (pageNumber <= 0 || pageNumber > totalPages || isNaN(pageNumber)) {
    return notFound()
  }
  const initialDisplayPosts = filteredPosts.slice(
    POSTS_PER_PAGE * (pageNumber - 1),
    POSTS_PER_PAGE * pageNumber
  )
  const pagination = {
    currentPage: pageNumber,
    totalPages: totalPages,
  }

  return (
    <ListLayout
      posts={filteredPosts}
      initialDisplayPosts={initialDisplayPosts}
      pagination={pagination}
      tagCounts={tagCounts}
      title={title}
    />
  )
}
