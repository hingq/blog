import AdminPostList from '@/components/admin/AdminPostList'
import { listManagedPosts } from '@/lib/admin/posts'

export const dynamic = 'force-dynamic'

export default async function AdminPostsPage() {
  const data = await listManagedPosts()
  return <AdminPostList posts={data.posts} trash={data.trash} />
}
