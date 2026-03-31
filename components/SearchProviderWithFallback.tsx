'use client'

import { SearchProvider, type SearchConfig } from 'pliny/search'
import type { Action } from 'kbar'

type SearchProviderWithFallbackProps = {
  children: React.ReactNode
  searchConfig: SearchConfig
}

const mapSearchDocumentsToActions = (documents: unknown): Action[] => {
  if (!Array.isArray(documents)) {
    console.error('[search] Invalid search document payload: expected array.', documents)
    return []
  }

  return documents
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      id: String(item.path || item.title || ''),
      name: String(item.title || 'Untitled'),
      keywords: String(item.summary || ''),
      section: 'Content',
      subtitle: typeof item.date === 'string' ? item.date : '',
      perform: () => {
        if (typeof window !== 'undefined' && typeof item.path === 'string') {
          window.location.href = `/${item.path}`
        }
      },
    }))
}

export default function SearchProviderWithFallback({
  children,
  searchConfig,
}: SearchProviderWithFallbackProps) {
  if (searchConfig.provider !== 'kbar') {
    return <SearchProvider searchConfig={searchConfig}>{children}</SearchProvider>
  }

  const safeSearchConfig: SearchConfig = {
    ...searchConfig,
    kbarConfig: {
      ...searchConfig.kbarConfig,
      onSearchDocumentsLoad: (payload: unknown) => {
        try {
          return mapSearchDocumentsToActions(payload)
        } catch (error) {
          console.error(
            '[search] Failed to parse search documents, fallback to empty actions.',
            error
          )
          return []
        }
      },
    },
  }

  return <SearchProvider searchConfig={safeSearchConfig}>{children}</SearchProvider>
}
