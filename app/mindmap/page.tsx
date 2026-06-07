import { genPageMetadata } from 'app/seo'
import MindmapClient from '@/components/mindmap/MindmapClient'

export const metadata = genPageMetadata({ title: 'Mindmap' })

export default function Page() {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      <div className="space-y-2 pt-6 pb-8 md:space-y-5">
        <h1 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10 md:text-6xl md:leading-14 dark:text-gray-100">
          Mindmap
        </h1>
        <p className="text-lg leading-7 text-gray-500 dark:text-gray-400">
          上传 Markdown 文件，按标题层级自动生成可编辑的思维导图。
        </p>
      </div>
      <div className="py-8">
        <MindmapClient />
      </div>
    </div>
  )
}
