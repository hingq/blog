import { revalidatePath } from 'next/cache'
import { clearBlogCache } from '@/lib/blog'

export function revalidatePublishedBlog() {
  clearBlogCache()
  revalidatePath('/', 'layout')
  revalidatePath('/api/search-documents')
}
