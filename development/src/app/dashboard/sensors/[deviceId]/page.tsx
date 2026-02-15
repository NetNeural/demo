import { SensorDetailsClient } from './sensor-details-client'

// Required for static export with dynamic routes
export async function generateStaticParams() {
  // Return empty array - device IDs are dynamic and handled client-side
  return []
}

interface PageProps {
  params: {
    deviceId: string
  }
}

export default function SensorDetailsPage({ params }: PageProps) {
  return <SensorDetailsClient deviceId={params.deviceId} />
}
