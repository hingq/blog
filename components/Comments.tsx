'use client'

import { Comments as CommentsComponent } from 'pliny/comments'
import { useEffect, useState } from 'react'
import siteMetadata from '@/data/siteMetadata'

declare global {
  interface Window {
    Waline?: {
      init: (options: Record<string, unknown>) => { destroy?: () => void }
    }
  }
}

function WalineComments({ slug }: { slug: string }) {
  useEffect(() => {
    let walineInstance: { destroy?: () => void } | undefined

    const loadWaline = async () => {
      if (!document.getElementById('waline-style')) {
        const style = document.createElement('link')
        style.id = 'waline-style'
        style.rel = 'stylesheet'
        style.href = 'https://unpkg.com/@waline/client@v3/dist/waline.css'
        document.head.appendChild(style)
      }

      if (!window.Waline) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.id = 'waline-script'
          script.src = 'https://unpkg.com/@waline/client@v3/dist/waline.js'
          script.async = true
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('加载 Waline 脚本失败'))
          document.body.appendChild(script)
        })
      }

      const walineConfig = (
        siteMetadata.comments as { walineConfig?: Record<string, unknown> } | undefined
      )?.walineConfig

      if (!walineConfig?.serverURL) {
        return
      }

      walineInstance = window.Waline?.init({
        el: '#waline',
        path: `/${slug}`,
        lang: 'zh-CN',
        ...walineConfig,
      })
    }

    loadWaline().catch((error) => {
      console.error(error)
    })

    return () => {
      walineInstance?.destroy?.()
    }
  }, [slug])

  return <div id="waline" />
}

export default function Comments({ slug }: { slug: string }) {
  const [loadComments, setLoadComments] = useState(false)

  if (!siteMetadata.comments?.provider) {
    return null
  }

  const provider = siteMetadata.comments.provider as string

  return loadComments ? (
    provider === 'waline' ? (
      <WalineComments slug={slug} />
    ) : (
      <CommentsComponent commentsConfig={siteMetadata.comments} slug={slug} />
    )
  ) : (
    <button onClick={() => setLoadComments(true)}>加载评论</button>
  )
}
