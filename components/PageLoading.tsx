import GlobalLoading from '@/components/loading'

export default function PageLoading() {
  return (
    <>
      <GlobalLoading />
      <div className="fixed inset-0 z-70 flex items-center justify-center bg-white/60 backdrop-blur-sm dark:bg-gray-950/60">
        <div className="border-primary-500/30 border-t-primary-500 dark:border-primary-400/30 dark:border-t-primary-400 h-10 w-10 animate-spin rounded-full border-4" />
      </div>
    </>
  )
}
