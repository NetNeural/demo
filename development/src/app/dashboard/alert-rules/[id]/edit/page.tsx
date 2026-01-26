import { EditRuleClient } from '@/components/alerts/EditRuleClient'

// For static export: no pre-rendering (client-side routing only)
export function generateStaticParams() {
  return []
}

export default async function EditAlertRulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EditRuleClient ruleId={id} />
}
