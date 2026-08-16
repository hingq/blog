'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error || '登录失败')
      router.replace('/admin/posts')
      router.refresh()
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="password">
          管理员密码
        </label>
        <input
          autoComplete="current-password"
          className="focus:border-primary-500 focus:ring-primary-500 mt-2 block w-full rounded-lg border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-950"
          id="password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <button
        className="bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 w-full rounded-lg px-4 py-2.5 font-medium text-white transition disabled:cursor-not-allowed"
        disabled={submitting}
        type="submit"
      >
        {submitting ? '登录中…' : '登录'}
      </button>
    </form>
  )
}
