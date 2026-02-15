// Static export with dynamic route - fully client-side rendered
// The [id] parameter is accessed via useParams in SensorDetailsClient
import SensorDetailsClient from './SensorDetailsClient'

// Required for Next.js 15 static export with dynamic routes
export async function generateStaticParams() {
  return []
}

export default function SensorDetailsPage() {
  return <SensorDetailsClient />
}

