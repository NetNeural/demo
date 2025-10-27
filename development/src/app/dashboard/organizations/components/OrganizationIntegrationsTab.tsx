'use client';

import IntegrationsTab from '@/app/dashboard/settings/components/IntegrationsTab';

interface OrganizationIntegrationsTabProps {
  organizationId: string;
}

export function OrganizationIntegrationsTab({ organizationId }: OrganizationIntegrationsTabProps) {
  return <IntegrationsTab initialOrganization={organizationId} hideOrganizationSelector={true} />;
}

