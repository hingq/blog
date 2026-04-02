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
    <section className="comment-section">
      <div className="comment-section__header">
        <h2 className="comment-section__title">评论</h2>
        <p className="comment-section__description">欢迎交流、补充或指出问题。</p>
      </div>
      <div className="comment-section__body">
        {loadComments ? (
          isTwikooCommentsConfig(commentsConfig) ? (
            <TwikooComments key={slug} slug={slug} twikooConfig={commentsConfig.twikooConfig} />
          ) : (
            <div className="comment-thread">
              <PlinyComments commentsConfig={commentsConfig} slug={slug} />
            </div>
          )
        ) : (
          <button
            type="button"
            className="comment-section__load-button"
            onClick={() => setLoadComments(true)}
          >
            加载评论
          </button>
        )}
      </div>
    </section>
  )
}
