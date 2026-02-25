export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="h-4 w-4 animate-pulse rounded-full bg-blue-600"></div>
      <div className="animation-delay-200 h-4 w-4 animate-pulse rounded-full bg-blue-600"></div>
      <div className="animation-delay-400 h-4 w-4 animate-pulse rounded-full bg-blue-600"></div>
    </div>
  )
}
