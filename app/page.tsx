import Main from './Main'
import { getAllCorePosts } from '@/lib/blog'

export const revalidate = 600

export default async function Page() {
  const posts = await getAllCorePosts()
  return <Main posts={posts} />
}
