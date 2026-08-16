'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LogoutButton() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function logout() {
    setSubmitting(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.replace('/admin/login')
      router.refresh()
    }
  }

  return (
    <button
      className="hover:text-primary-600 dark:hover:text-primary-400 text-sm text-gray-500 transition dark:text-gray-400"
      disabled={submitting}
      onClick={logout}
      type="button"
    >
      {submitting ? '退出中…' : '退出登录'}
    </button>
  )
}
