import { EditRuleClient } from '@/components/alerts/EditRuleClient'

// For static export: no pre-rendering (client-side routing only)
export function generateStaticParams() {
  return []
}

export default function EditAlertRulePage() {
  return <EditRuleClient />
}
