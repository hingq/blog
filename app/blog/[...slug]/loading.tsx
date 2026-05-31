import GlobalLoading from '@/components/loading'

export default function Loading() {
  return (
    <>
      <GlobalLoading />
      <article className="mx-auto max-w-3xl px-4 sm:px-6 xl:max-w-5xl xl:px-0">
        <div className="xl:divide-y xl:divide-gray-200 xl:dark:divide-gray-700">
          <header className="pt-6 xl:pb-6">
            <div className="space-y-1 text-center">
              <dl className="space-y-10">
                <div>
                  <dt className="sr-only">Published on</dt>
                  <dd className="text-base leading-6 font-medium text-gray-500 dark:text-gray-400">
                    <div className="mx-auto h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                  </dd>
                </div>
              </dl>
              <div className="flex justify-center">
                <div className="mt-2 h-10 w-3/4 animate-pulse rounded bg-gray-200 md:h-12 dark:bg-gray-800" />
              </div>
            </div>
          </header>
          <div className="grid-rows-[auto_1fr] divide-y divide-gray-200 pb-8 xl:grid xl:grid-cols-4 xl:gap-x-6 xl:divide-y-0 dark:divide-gray-700">
            <dl className="pt-6 pb-10 xl:border-b xl:border-gray-200 xl:pt-11 xl:dark:border-gray-700">
              <dt className="sr-only">Authors</dt>
              <dd>
                <ul className="flex flex-wrap justify-center gap-4 sm:space-x-12 xl:block xl:space-y-8 xl:space-x-0">
                  <li className="flex items-center space-x-2">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
                    <dl className="text-sm leading-5 font-medium whitespace-nowrap">
                      <dt className="sr-only">Name</dt>
                      <dd className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    </dl>
                  </li>
                </ul>
              </dd>
            </dl>
            <div className="divide-y divide-gray-200 xl:col-span-3 xl:row-span-2 xl:pb-0 dark:divide-gray-700">
              <div className="prose dark:prose-invert max-w-none space-y-6 pt-10 pb-8">
                <div className="space-y-3">
                  <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-4 w-11/12 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>
                <div className="space-y-3 pt-4">
                  <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-4 w-11/12 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>
                <div className="space-y-3 pt-4">
                  <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </>
  )
}
