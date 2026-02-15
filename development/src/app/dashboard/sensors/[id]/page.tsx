// Static export with dynamic route - client-side rendering
import SensorDetailsClient from './SensorDetailsClient'

// Required for static export with dynamic routes
export async function generateStaticParams() {
  // Return empty array - pages generated on demand via client-side routing
  return []
}

export default function SensorDetailsPage() {
  return <SensorDetailsClient />
}

