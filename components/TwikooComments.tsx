'use client'

import { useEffect } from 'react'
import type { TwikooConfig } from '@/types/comments'

const commentElementId = 'tcomment'

export default function TwikooComments({
  twikooConfig,
  slug,
}: {
  twikooConfig: TwikooConfig
  slug: string
}) {
  useEffect(() => {
    let isCancelled = false
    const container = document.getElementById(commentElementId)

    if (container) {
      container.innerHTML = ''
    }

    import('twikoo').then((m) => {
      if (isCancelled) {
        return
      }

      const twikoo = m.default ?? m
      twikoo.init({
        envId: twikooConfig.envId,
        el: `#${commentElementId}`,
        lang: twikooConfig.lang ?? 'zh-CN',
      })
    })

    return () => {
      isCancelled = true

      if (container) {
        container.innerHTML = ''
      }
    }
  }, [slug, twikooConfig.envId, twikooConfig.lang])

  return <div id={commentElementId} />
}
