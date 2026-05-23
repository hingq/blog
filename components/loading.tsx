export default function Loading() {
  return (
    <div className="fixed top-0 left-0 right-0 z-80">
      <div className="h-0.5 w-full overflow-hidden bg-primary-200 dark:bg-primary-900">
        <div className="h-full w-full origin-left animate-progress-bar bg-primary-600 dark:bg-primary-400" />
      </div>
    </div>
  )
}