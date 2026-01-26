import { EditRuleClient } from '@/components/alerts/EditRuleClient'

// Required for static export with dynamic routes
export async function generateStaticParams() {
  // For static export - no pre-rendering, handled client-side
  return []
}

export default function EditAlertRulePage() {
  return <EditRuleClient />
}
