import { MqttPageClient } from './MqttPageClient'

// Required for static export with dynamic routes
// This tells Next.js to generate static pages for these IDs at build time
export async function generateStaticParams() {
  // For static export, we can only pre-generate the 'new' route
  // Existing integration IDs will be handled client-side
  return [{ id: 'new' }]
}

export default function MqttIntegrationPage() {
  return <MqttPageClient />
}
