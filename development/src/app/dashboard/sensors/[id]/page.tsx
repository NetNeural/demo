import SensorDetailsClient from './SensorDetailsClient'
import { createClient } from '@/lib/supabase/server'

// Required for static export with dynamic routes
// Fetch device IDs from database at build time to pre-generate pages
export async function generateStaticParams() {
  try {
    const supabase = await createClient()
    const { data: devices } = await supabase
      .from('devices')
      .select('id')
      .limit(100) // Pre-generate up to 100 device pages

    if (!devices) return []
    
    return devices.map((device) => ({
      id: device.id,
    }))
  } catch (error) {
    console.error('Error generating static params:', error)
    return [] // Fallback to empty if build-time DB access fails
  }
}

export default function SensorDetailsPage() {
  return <SensorDetailsClient />
}

