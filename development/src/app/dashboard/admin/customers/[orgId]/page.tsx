import CustomerDetailClient from './CustomerDetailClient'

// Required for static export with dynamic routes
export async function generateStaticParams() {
  return [{ orgId: 'detail' }]
}

export default function CustomerDetailPage() {
  return <CustomerDetailClient />
}
