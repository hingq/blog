import AuthorLayout from '@/layouts/AuthorLayout'
import { genPageMetadata } from 'app/seo'
import { notFound } from 'next/navigation'
import { getAuthorBySlug } from '@/lib/authors'

export const metadata = genPageMetadata({ title: 'About' })

export default async function Page() {
  const author = await getAuthorBySlug('default')
  if (!author) {
    return notFound()
  }

  const { body, ...mainContent } = author

  return (
    <>
      <AuthorLayout content={mainContent}>
        <div dangerouslySetInnerHTML={{ __html: body.html }} />
      </AuthorLayout>
    </>
  )
}
