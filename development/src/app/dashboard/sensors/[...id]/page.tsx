// For static export with dynamic routes, the page must be client-side
// The [id] parameter will be accessed via useParams in the client component
import SensorDetailsClient from './SensorDetailsClient'
// Static export requires generateStaticParams for dynamic routes
// Return empty array - actual params come from client-side navigation
export async function generateStaticParams() {
  return []
}
export default function SensorDetailsPage() {
  return <SensorDetailsClient />
}

