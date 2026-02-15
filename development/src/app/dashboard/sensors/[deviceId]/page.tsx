'use client'

import { SensorDetailsClient } from './sensor-details-client'
import { useParams } from 'next/navigation'

export default function SensorDetailsPage() {
  const params = useParams()
  const deviceId = params?.deviceId as string
  
  return <SensorDetailsClient deviceId={deviceId} />
}
