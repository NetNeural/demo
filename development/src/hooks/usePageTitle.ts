'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useOrganization } from '@/contexts/OrganizationContext';

/**
 * Map dashboard routes to human-readable page names.
 * More specific routes must come first (longest match wins).
 */
const ROUTE_TITLES: [string, string][] = [
  ['/dashboard/alert-rules/new', 'New Alert Rule'],
  ['/dashboard/alert-rules', 'Alert Rules'],
  ['/dashboard/alerts', 'Alerts'],
  ['/dashboard/analytics', 'AI Analytics'],
  ['/dashboard/devices/view', 'Device Details'],
  ['/dashboard/devices', 'Devices'],
  ['/dashboard/device-details', 'Sensor Details'],
  ['/dashboard/feedback', 'Feedback'],
  ['/dashboard/integrations/mqtt', 'MQTT Integration'],
  ['/dashboard/integrations/view', 'Integration Details'],
  ['/dashboard/integrations', 'Integrations'],
  ['/dashboard/organizations', 'Organization'],
  ['/dashboard/reports/audit-log', 'Audit Log'],
  ['/dashboard/reports/alerts', 'Alert History'],
  ['/dashboard/reports/telemetry', 'Telemetry Trends'],
  ['/dashboard/reports', 'Reports'],
  ['/dashboard/settings', 'Settings'],
  ['/dashboard/support', 'Support'],
  ['/dashboard/users', 'Users'],
  ['/dashboard', 'Dashboard'],
];

/**
 * Sets `document.title` to include the current page name and active organization.
 *
 * Format: `PageName | OrgName — NetNeural`
 * Fallback (no org): `PageName — NetNeural`
 *
 * Call once in the dashboard layout so every child page benefits automatically.
 */
export function usePageTitle() {
  const pathname = usePathname();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    const pageName =
      ROUTE_TITLES.find(([route]) => pathname.startsWith(route))?.[1] ?? 'Dashboard';

    const orgName = currentOrganization?.name;

    document.title = orgName
      ? `${pageName} | ${orgName} — NetNeural`
      : `${pageName} — NetNeural`;
  }, [pathname, currentOrganization]);
}
