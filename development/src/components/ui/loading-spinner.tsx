export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"></div>
      <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse animation-delay-200"></div>
      <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse animation-delay-400"></div>
    </div>
  )
}