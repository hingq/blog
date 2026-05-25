export default function Loading() {
  return (
    <div className="fixed top-0 right-0 left-0 z-80">
      <div className="bg-primary-200 dark:bg-primary-900 h-0.5 w-full overflow-hidden">
        <div className="animate-progress-bar bg-primary-600 dark:bg-primary-400 h-full w-full origin-left" />
      </div>
    </div>
  )
}
