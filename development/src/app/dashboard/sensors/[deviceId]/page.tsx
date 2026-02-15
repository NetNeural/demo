import { SensorDetailsClient } from './sensor-details-client'

// Allow dynamic device IDs beyond those in generateStaticParams
export const dynamicParams = true

// Required for static export with dynamic routes
export async function generateStaticParams() {
  // Return empty array - device IDs are dynamic and handled client-side
  return []
}

interface PageProps {
  params: Promise<{
    deviceId: string
  }>
}

export default async function SensorDetailsPage({ params }: PageProps) {
  const { deviceId } = await params
  return <SensorDetailsClient deviceId={deviceId} />
}
