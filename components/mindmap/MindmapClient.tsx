'use client'

import dynamic from 'next/dynamic'

const Mindmap = dynamic(() => import('./Mindmap'), { ssr: false })

export default function MindmapClient() {
  return <Mindmap />
}
