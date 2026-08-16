import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import LoginForm from '@/components/admin/LoginForm'
import { isAdminAuthenticated } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '管理员登录',
  robots: { index: false, follow: false },
}

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect('/admin/posts')

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5 py-12 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-primary-600 dark:text-primary-400 text-sm font-semibold">Blog Admin</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">登录文章后台</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
          登录状态将在 12 小时后失效。
        </p>
        <LoginForm />
      </div>
    </main>
  )
}
