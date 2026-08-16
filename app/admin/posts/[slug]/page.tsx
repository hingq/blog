import 'css/prism.css'
import 'katex/dist/katex.css'

import { notFound } from 'next/navigation'
import PostEditor from '@/components/admin/PostEditor'
import { getManagedPost } from '@/lib/admin/posts'

export const dynamic = 'force-dynamic'

export default async function EditAdminPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getManagedPost(decodeURIComponent(slug))
  if (!post) notFound()
  return <PostEditor initialPost={post} />
}
