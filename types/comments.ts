import type { CommentsConfig as PlinyCommentsConfig } from 'pliny/comments'
import type { PlinyConfig } from 'pliny/config'

export interface TwikooConfig {
  envId: string
  lang?: string
}

export interface TwikooCommentsConfig {
  provider: 'twikoo'
  twikooConfig: TwikooConfig
}

export type SiteCommentsConfig = PlinyCommentsConfig | TwikooCommentsConfig

export type SiteMetadataConfig = Omit<PlinyConfig, 'comments'> & {
  comments?: SiteCommentsConfig
}
