// For static export with dynamic routes, the page must be client-side
// The [id] parameter will be accessed via useParams in the client component
import SensorDetailsClient from './SensorDetailsClient'

export default function SensorDetailsPage() {
  return <SensorDetailsClient />
}

