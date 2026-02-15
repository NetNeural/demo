import SensorDetailsClient from './SensorDetailsClient'

// Required for static export with dynamic routes
// Returns empty array since device IDs are dynamic and fetched at runtime
export async function generateStaticParams() {
  return []
}

export default function SensorDetailsPage() {
  return <SensorDetailsClient />
}

