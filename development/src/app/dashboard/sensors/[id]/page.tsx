import SensorDetailsClient from './SensorDetailsClient'

// For static export, we can't pre-generate dynamic routes at build time
// The page will be generated on-demand when users navigate to it
export const dynamicParams = true

export default function SensorDetailsPage() {
  return <SensorDetailsClient />
}

