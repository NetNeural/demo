export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-gray-600">The page you're looking for doesn't exist.</p>
        <a href="/" className="text-blue-600 hover:underline mt-4 inline-block">
          Go back home
        </a>
      </div>
    </div>
  );
}
