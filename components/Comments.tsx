'use client'

import { Comments as PlinyComments } from 'pliny/comments'
import { useState } from 'react'
import siteMetadata from '@/data/siteMetadata'
import type { SiteCommentsConfig, TwikooCommentsConfig } from '@/types/comments'
import TwikooComments from './TwikooComments'

function isTwikooCommentsConfig(
  commentsConfig: SiteCommentsConfig
): commentsConfig is TwikooCommentsConfig {
  return commentsConfig.provider === 'twikoo'
}

export default function Comments({ slug }: { slug: string }) {
  const [loadComments, setLoadComments] = useState(false)
  const commentsConfig = siteMetadata.comments

  if (!commentsConfig?.provider) {
    return null
  }

  return (
    <>
      {loadComments ? (
        isTwikooCommentsConfig(commentsConfig) ? (
          <TwikooComments key={slug} slug={slug} twikooConfig={commentsConfig.twikooConfig} />
        ) : (
          <PlinyComments commentsConfig={commentsConfig} slug={slug} />
        )
      ) : (
        <button onClick={() => setLoadComments(true)}>Load Comments</button>
      )}
    </>
  )
}
