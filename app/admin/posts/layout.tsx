import type { Metadata } from 'next'
import Link from 'next/link'
import LogoutButton from '@/components/admin/LogoutButton'
import { requireAdminPage } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '文章管理',
  robots: { index: false, follow: false },
}

export default async function AdminPostsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between px-5 py-4 sm:px-8">
          <Link className="font-semibold tracking-tight" href="/admin/posts">
            Blog Admin
          </Link>
          <div className="flex items-center gap-5">
            <Link
              className="hover:text-primary-600 dark:hover:text-primary-400 text-sm text-gray-500 transition dark:text-gray-400"
              href="/"
              target="_blank"
            >
              打开博客
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[96rem] px-5 py-8 sm:px-8">{children}</main>
    </div>
  )
}
