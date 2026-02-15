'use client'

// Static export with dynamic route - fully client-side rendered
// The [id] parameter is accessed via useParams in SensorDetailsClient
import SensorDetailsClient from './SensorDetailsClient'

export default function SensorDetailsPage() {
  return <SensorDetailsClient />
}

