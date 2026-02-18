/**
 * Access Request Types
 * Cross-org temporary access request system (Issue #35)
 */

export type AccessRequestStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'revoked';
export type AccessRequestDuration = '1h' | '4h' | '24h' | '48h' | '7d';

export interface AccessRequest {
  id: string;
  requester_id: string;
  requester_org_id: string;
  target_org_id: string;
  reason: string;
  requested_duration: string;
  status: AccessRequestStatus;
  approved_by?: string;
  approved_at?: string;
  denied_by?: string;
  denied_at?: string;
  denial_reason?: string;
  expires_at?: string;
  granted_membership_id?: string;
  created_at: string;
  updated_at: string;
  // Joined relations
  requester?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  requester_org?: {
    id: string;
    name: string;
    slug: string;
  };
  target_org?: {
    id: string;
    name: string;
    slug: string;
  };
  approver?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface CreateAccessRequestData {
  target_org_id: string;
  reason: string;
  requested_duration: AccessRequestDuration;
}

export interface ApproveAccessRequestData {
  request_id: string;
  action: 'approve' | 'deny';
  denial_reason?: string;
}

export const DURATION_OPTIONS: { value: AccessRequestDuration; label: string; description: string }[] = [
  { value: '1h', label: '1 Hour', description: 'Quick inspection or support' },
  { value: '4h', label: '4 Hours', description: 'Standard support session' },
  { value: '24h', label: '24 Hours', description: 'Extended troubleshooting' },
  { value: '48h', label: '48 Hours', description: 'Multi-day investigation' },
  { value: '7d', label: '7 Days', description: 'Extended project work' },
];

export function getStatusColor(status: AccessRequestStatus): string {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'denied': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'expired': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    case 'revoked': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export function formatDuration(pgInterval: string): string {
  const match = pgInterval.match(/(\d+)\s*(hour|day)s?/);
  if (!match || !match[1] || !match[2]) return pgInterval;
  const amount = match[1];
  const unit = match[2];
  return `${amount} ${unit}${parseInt(amount) > 1 ? 's' : ''}`;
}

export function isRequestExpired(request: AccessRequest): boolean {
  if (request.status !== 'approved' || !request.expires_at) return false;
  return new Date(request.expires_at) < new Date();
}

export function getTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Expired';
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}
