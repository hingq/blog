'use client'

import { useEffect } from 'react'
import type { TwikooConfig } from '@/types/comments'

const commentElementId = 'tcomment'
type TwikooInit = (options: { envId: string; el: string; lang: string }) => void | Promise<void>

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

      const init =
        typeof m.default === 'function'
          ? m.default
          : typeof m.init === 'function'
            ? m.init
            : typeof m === 'function'
              ? m
              : null

      if (!init) {
        console.error('Failed to resolve Twikoo init function from dynamic import.', m)
        return
      }

      ;(init as TwikooInit)({
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

  return <div className="comment-thread comment-thread-twikoo" id={commentElementId} />
}
