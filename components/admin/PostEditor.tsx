'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import MDXRenderer from '@/components/MDXRenderer'
import { components } from '@/components/MDXComponents'
import type { ManagedBlogPost } from '@/lib/admin/posts'

type Props = {
  initialPost?: ManagedBlogPost
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  return payload.error || `请求失败（${response.status}）`
}

export default function PostEditor({ initialPost }: Props) {
  const router = useRouter()
  const isNew = !initialPost
  const originalSlug = initialPost?.slug
  const slugLocked = Boolean(initialPost?.firstPublishedAt || initialPost?.draft !== true)
  const legacyBodyOnly = Boolean(initialPost?.body.code && !initialPost?.body.raw)
  const [title, setTitle] = useState(initialPost?.title ?? '')
  const [slug, setSlug] = useState(initialPost?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(initialPost))
  const [date, setDate] = useState((initialPost?.date ?? new Date().toISOString()).slice(0, 10))
  const [summary, setSummary] = useState(initialPost?.summary ?? '')
  const [tags, setTags] = useState((initialPost?.tags ?? []).join(', '))
  const [draft, setDraft] = useState(initialPost?.draft ?? true)
  const [body, setBody] = useState(initialPost?.body.raw ?? '')
  const [previewCode, setPreviewCode] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setPreviewError('')
      try {
        const response = await fetch('/api/admin/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ source: body }),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(await responseError(response))
        const payload = (await response.json()) as { code: string }
        setPreviewCode(payload.code)
      } catch (previewFailure) {
        if (controller.signal.aborted) return
        setPreviewCode('')
        setPreviewError(previewFailure instanceof Error ? previewFailure.message : '预览失败')
      }
    }, 450)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [body])

  const payload = useMemo(
    () => ({
      title,
      slug,
      date,
      summary,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      draft,
      body,
    }),
    [body, date, draft, slug, summary, tags, title]
  )

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const endpoint = isNew
        ? '/api/admin/posts'
        : `/api/admin/posts/${encodeURIComponent(originalSlug || '')}`
      const response = await fetch(endpoint, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const result = (await response.json()) as { post: ManagedBlogPost }
      setSaved(true)
      if (isNew || result.post.slug !== originalSlug) {
        router.replace(`/admin/posts/${encodeURIComponent(result.post.slug)}`)
      }
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!originalSlug || !window.confirm(`确定将“${title}”移入回收站吗？`)) return
    setDeleting(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/posts/${encodeURIComponent(originalSlug)}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(await responseError(response))
      router.replace('/admin/posts')
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败')
      setDeleting(false)
    }
  }

  function updateTitle(value: string) {
    setTitle(value)
    if (!slugTouched && !slugLocked) setSlug(slugify(value))
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center dark:border-gray-800">
        <div>
          <Link
            className="text-primary-600 dark:text-primary-400 text-sm hover:underline"
            href="/admin/posts"
          >
            ← 返回文章列表
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {isNew ? '新建文章' : '编辑文章'}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!isNew && initialPost?.draft !== true ? (
            <Link
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
              href={`/blog/${initialPost?.slug}`}
              target="_blank"
            >
              查看文章
            </Link>
          ) : null}
          {!isNew ? (
            <button
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              disabled={deleting || saving}
              onClick={remove}
              type="button"
            >
              {deleting ? '删除中…' : '移入回收站'}
            </button>
          ) : null}
          <button
            className="bg-primary-600 hover:bg-primary-700 rounded-lg px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving || deleting || legacyBodyOnly}
            onClick={save}
            type="button"
          >
            {saving ? '保存中…' : draft ? '保存草稿' : isNew ? '发布文章' : '保存并更新'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {legacyBodyOnly ? (
        <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          这篇文章只有已编译内容，没有可编辑的 Markdown/MDX 原文。请先通过发布脚本重新发布后再编辑。
        </p>
      ) : null}
      {saved ? (
        <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          已保存，公开站点缓存正在刷新。
        </p>
      ) : null}

      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="title">
              标题
            </label>
            <input
              className="focus:border-primary-500 focus:ring-primary-500 mt-2 block w-full rounded-lg border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-950"
              id="title"
              onChange={(event) => updateTitle(event.target.value)}
              required
              value={title}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="text-sm font-medium text-gray-700 dark:text-gray-200"
                htmlFor="slug"
              >
                Slug
              </label>
              <input
                className="focus:border-primary-500 focus:ring-primary-500 mt-2 block w-full rounded-lg border-gray-300 bg-white font-mono disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:disabled:bg-gray-900"
                disabled={slugLocked}
                id="slug"
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(slugify(event.target.value))
                }}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
                value={slug}
              />
              {slugLocked ? <p className="mt-1 text-xs text-gray-500">首次发布后不可修改</p> : null}
            </div>
            <div>
              <label
                className="text-sm font-medium text-gray-700 dark:text-gray-200"
                htmlFor="date"
              >
                发布日期
              </label>
              <input
                className="focus:border-primary-500 focus:ring-primary-500 mt-2 block w-full rounded-lg border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-950"
                id="date"
                onChange={(event) => setDate(event.target.value)}
                required
                type="date"
                value={date}
              />
            </div>
          </div>

          <div>
            <label
              className="text-sm font-medium text-gray-700 dark:text-gray-200"
              htmlFor="summary"
            >
              摘要
            </label>
            <textarea
              className="focus:border-primary-500 focus:ring-primary-500 mt-2 block w-full rounded-lg border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-950"
              id="summary"
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
              value={summary}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
            <div>
              <label
                className="text-sm font-medium text-gray-700 dark:text-gray-200"
                htmlFor="tags"
              >
                标签
              </label>
              <input
                className="focus:border-primary-500 focus:ring-primary-500 mt-2 block w-full rounded-lg border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-950"
                id="tags"
                onChange={(event) => setTags(event.target.value)}
                placeholder="nextjs, minio"
                value={tags}
              />
              <p className="mt-1 text-xs text-gray-500">使用英文逗号分隔</p>
            </div>
            <div>
              <label
                className="text-sm font-medium text-gray-700 dark:text-gray-200"
                htmlFor="status"
              >
                状态
              </label>
              <select
                className="focus:border-primary-500 focus:ring-primary-500 mt-2 block w-full rounded-lg border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-950"
                id="status"
                onChange={(event) => setDraft(event.target.value === 'draft')}
                value={draft ? 'draft' : 'published'}
              >
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                className="text-sm font-medium text-gray-700 dark:text-gray-200"
                htmlFor="body"
              >
                Markdown / MDX 正文
              </label>
              <span className="text-xs text-gray-500">{body.length.toLocaleString()} 字符</span>
            </div>
            <textarea
              className="focus:border-primary-500 focus:ring-primary-500 mt-2 block min-h-[42rem] w-full resize-y rounded-lg border-gray-300 bg-gray-950 p-4 font-mono text-sm leading-6 text-gray-100"
              id="body"
              onChange={(event) => setBody(event.target.value)}
              spellCheck={false}
              value={body}
            />
          </div>
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200">实时预览</h2>
            {previewError ? <span className="text-xs text-red-500">编译失败</span> : null}
          </div>
          <div className="min-h-[42rem] overflow-auto rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
            {previewError ? (
              <pre className="text-sm whitespace-pre-wrap text-red-600 dark:text-red-400">
                {previewError}
              </pre>
            ) : previewCode ? (
              <article className="prose dark:prose-invert max-w-none">
                <MDXRenderer code={previewCode} components={components} />
              </article>
            ) : (
              <p className="text-sm text-gray-500">输入正文后将在这里显示预览。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
