import { genPageMetadata } from 'app/seo'
import MindmapClient from '@/components/mindmap/MindmapClient'

export const metadata = genPageMetadata({ title: 'Mindmap' })

export default function Page() {
  return <MindmapClient />
}
