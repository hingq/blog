'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CoreBlogPost } from '@/lib/blog'
import type { TrashedPostEntry } from '@/lib/admin/posts'

type Filter = 'all' | 'draft' | 'published' | 'trash'
type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end'

type Props = {
  posts: CoreBlogPost[]
  trash: TrashedPostEntry[]
}

const POSTS_PER_PAGE = 20

function formatDate(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value))
}

async function readError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  return payload.error || `请求失败（${response.status}）`
}

function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set([1, totalPages])
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page > 1 && page < totalPages) pages.add(page)
  }

  if (currentPage <= 4) {
    for (let page = 2; page <= 5; page += 1) pages.add(page)
  }
  if (currentPage >= totalPages - 3) {
    for (let page = totalPages - 4; page < totalPages; page += 1) pages.add(page)
  }

  const sortedPages = [...pages].sort((left, right) => left - right)
  const items: PaginationItem[] = []

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1]
    if (previousPage && page - previousPage > 1) {
      items.push(previousPage === 1 ? 'ellipsis-start' : 'ellipsis-end')
    }
    items.push(page)
  })

  return items
}

export default function AdminPostList({ posts, trash }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [busySlug, setBusySlug] = useState('')
  const [error, setError] = useState('')

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const source = filter === 'trash' ? trash : posts
    return source.filter((post) => {
      if (filter === 'draft' && post.draft !== true) return false
      if (filter === 'published' && post.draft === true) return false
      return (
        !normalizedQuery ||
        post.title.toLowerCase().includes(normalizedQuery) ||
        post.slug.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [filter, posts, query, trash])

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE))
  const visiblePage = Math.min(currentPage, totalPages)
  const visiblePosts = useMemo(
    () => filteredPosts.slice((visiblePage - 1) * POSTS_PER_PAGE, visiblePage * POSTS_PER_PAGE),
    [filteredPosts, visiblePage]
  )
  const paginationItems = getPaginationItems(visiblePage, totalPages)

  function selectFilter(nextFilter: Filter) {
    setFilter(nextFilter)
    setCurrentPage(1)
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery)
    setCurrentPage(1)
  }

  async function mutate(slug: string, action: 'trash' | 'restore' | 'purge') {
    const confirmation =
      action === 'trash'
        ? `确定将“${slug}”移入回收站吗？`
        : action === 'restore'
          ? `确定恢复“${slug}”吗？`
          : `确定永久删除“${slug}”吗？此操作无法撤销。`
    if (!window.confirm(confirmation)) return

    setBusySlug(slug)
    setError('')
    const endpoint =
      action === 'trash'
        ? `/api/admin/posts/${encodeURIComponent(slug)}`
        : `/api/admin/posts/${encodeURIComponent(slug)}/${action === 'restore' ? 'restore' : 'purge'}`

    try {
      const response = await fetch(endpoint, {
        method: action === 'restore' ? 'POST' : 'DELETE',
      })
      if (!response.ok) throw new Error(await readError(response))
      router.refresh()
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : '操作失败')
    } finally {
      setBusySlug('')
    }
  }

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: '全部', count: posts.length },
    { id: 'draft', label: '草稿', count: posts.filter((post) => post.draft === true).length },
    {
      id: 'published',
      label: '已发布',
      count: posts.filter((post) => post.draft !== true).length,
    },
    { id: 'trash', label: '回收站', count: trash.length },
  ]

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文章管理</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            直接管理 MinIO 中的文章、发布状态和搜索索引。
          </p>
        </div>
        <Link
          className="bg-primary-600 hover:bg-primary-700 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-white transition"
          href="/admin/posts/new"
        >
          新建文章
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-center lg:justify-between dark:border-gray-800">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                filter === item.id
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
              key={item.id}
              onClick={() => selectFilter(item.id)}
              type="button"
            >
              {item.label} {item.count}
            </button>
          ))}
        </div>
        <input
          className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-lg border-gray-300 bg-white text-sm lg:w-72 dark:border-gray-700 dark:bg-gray-950"
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="搜索标题或 slug"
          type="search"
          value={query}
        />
      </div>

      {error ? (
        <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 text-xs tracking-wide text-gray-500 uppercase dark:bg-gray-900/70 dark:text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">文章</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">日期</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {visiblePosts.map((post) => {
                const isTrash = filter === 'trash'
                return (
                  <tr key={post.slug}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{post.title}</p>
                      <p className="mt-1 font-mono text-xs text-gray-500">{post.slug}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          isTrash
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                            : post.draft
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                      >
                        {isTrash ? '已删除' : post.draft ? '草稿' : '已发布'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 dark:text-gray-400">
                      {formatDate(
                        isTrash ? (post as TrashedPostEntry).deletedAt : post.lastmod || post.date
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        {isTrash ? (
                          <>
                            <button
                              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 disabled:opacity-50"
                              disabled={busySlug === post.slug}
                              onClick={() => mutate(post.slug, 'restore')}
                              type="button"
                            >
                              恢复
                            </button>
                            <button
                              className="text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
                              disabled={busySlug === post.slug}
                              onClick={() => mutate(post.slug, 'purge')}
                              type="button"
                            >
                              永久删除
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                              href={`/admin/posts/${encodeURIComponent(post.slug)}`}
                            >
                              编辑
                            </Link>
                            <button
                              className="text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
                              disabled={busySlug === post.slug}
                              onClick={() => mutate(post.slug, 'trash')}
                              type="button"
                            >
                              删除
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visiblePosts.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-gray-500" colSpan={4}>
                    没有符合条件的文章
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {filteredPosts.length > 0 ? (
        <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-gray-500 dark:text-gray-400">
            共 {filteredPosts.length} 篇，第 {visiblePage} / {totalPages} 页
          </p>
          {totalPages > 1 ? (
            <nav aria-label="文章列表分页" className="flex flex-wrap items-center gap-1">
              <button
                aria-label="上一页"
                className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
                disabled={visiblePage === 1}
                onClick={() => setCurrentPage(visiblePage - 1)}
                type="button"
              >
                上一页
              </button>
              {paginationItems.map((item) =>
                typeof item === 'number' ? (
                  <button
                    aria-current={item === visiblePage ? 'page' : undefined}
                    aria-label={`第 ${item} 页`}
                    className={`min-w-9 rounded-md border px-2.5 py-1.5 transition ${
                      item === visiblePage
                        ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900'
                    }`}
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ) : (
                  <span aria-hidden="true" className="px-1 text-gray-400" key={item}>
                    …
                  </span>
                )
              )}
              <button
                aria-label="下一页"
                className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
                disabled={visiblePage === totalPages}
                onClick={() => setCurrentPage(visiblePage + 1)}
                type="button"
              >
                下一页
              </button>
            </nav>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
