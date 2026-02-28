import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404 - Page Not Found</h1>
        <p className="text-gray-600">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Go back home
        </Link>
      </div>
    </div>
  )
}
