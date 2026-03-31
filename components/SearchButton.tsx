'use client'

import { useEffect, useState } from 'react'
import { AlgoliaButton } from 'pliny/search/AlgoliaButton'
import { KBarButton } from 'pliny/search/KBarButton'
import siteMetadata from '@/data/siteMetadata'

const SEARCH_UNAVAILABLE_TEXT = '搜索暂不可用'

const SearchFallback = () => (
  <div
    className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400"
    title={SEARCH_UNAVAILABLE_TEXT}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
    <span>{SEARCH_UNAVAILABLE_TEXT}</span>
  </div>
)

const SearchButton = () => {
  const [isSearchAvailable, setIsSearchAvailable] = useState(true)

  useEffect(() => {
    const checkSearchAvailability = async () => {
      if (siteMetadata.search?.provider !== 'kbar') {
        return
      }

      const searchPath = siteMetadata.search.kbarConfig?.searchDocumentsPath
      if (!searchPath) {
        setIsSearchAvailable(false)
        return
      }

      try {
        const response = await fetch(searchPath, { cache: 'no-store' })
        const status = response.headers.get('x-search-status')

        if (!response.ok || status === 'degraded') {
          setIsSearchAvailable(false)
        }
      } catch (error) {
        console.error('[search] Search endpoint health check failed.', error)
        setIsSearchAvailable(false)
      }
    }

    checkSearchAvailability()
  }, [])

  if (
    !siteMetadata.search ||
    (siteMetadata.search.provider !== 'algolia' && siteMetadata.search.provider !== 'kbar')
  ) {
    return null
  }

  if (!isSearchAvailable) {
    return <SearchFallback />
  }

  const SearchButtonWrapper =
    siteMetadata.search.provider === 'algolia' ? AlgoliaButton : KBarButton

  return (
    <SearchButtonWrapper aria-label="Search">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="hover:text-primary-500 dark:hover:text-primary-400 h-6 w-6 text-gray-900 dark:text-gray-100"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
    </SearchButtonWrapper>
  )
}

export default SearchButton
