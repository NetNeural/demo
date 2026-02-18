'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Inbox,
  AlertTriangle,
  Loader2,
  Ban,
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUser } from '@/contexts/UserContext';
import { edgeFunctions } from '@/lib/edge-functions/client';
import { useToast } from '@/hooks/use-toast';
import type {
  AccessRequest,
  AccessRequestDuration,
  AccessRequestStatus,
} from '@/types/access-request';
import {
  DURATION_OPTIONS,
  getStatusColor,
  formatDuration,
  getTimeRemaining,
  isRequestExpired,
} from '@/types/access-request';

interface AccessRequestsTabProps {
  organizationId: string;
}

export function AccessRequestsTab({ organizationId }: AccessRequestsTabProps) {
  const { currentOrganization, userOrganizations, isOwner, isAdmin } = useOrganization();
  const { user } = useUser();
  const { toast } = useToast();

  const [sentRequests, setSentRequests] = useState<AccessRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'sent' | 'received'>('sent');

  // New request dialog
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [targetOrgId, setTargetOrgId] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<AccessRequestDuration>('4h');
  const [submitting, setSubmitting] = useState(false);

  // Approval dialog
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [denialReason, setDenialReason] = useState('');
  const [approving, setApproving] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [sentRes, receivedRes] = await Promise.all([
        edgeFunctions.accessRequests.list({ view: 'sent' }),
        edgeFunctions.accessRequests.list({ view: 'received', organizationId }),
      ]);

      if (sentRes.success && sentRes.data) {
        setSentRequests(sentRes.data.requests);
      }
      if (receivedRes.success && receivedRes.data) {
        setReceivedRequests(receivedRes.data.requests);
      }
    } catch (error) {
      console.error('Error fetching access requests:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Available orgs to request access to (exclude current)
  const targetOrgs = userOrganizations?.filter(o => o.id !== organizationId) || [];

  const handleCreateRequest = async () => {
    if (!targetOrgId || !reason || reason.length < 10) {
      toast({
        title: 'Validation Error',
        description: 'Please select a target organization and provide a reason (min 10 characters).',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await edgeFunctions.accessRequests.create({
        target_org_id: targetOrgId,
        reason,
        requested_duration: duration,
      });

      if (res.success) {
        toast({
          title: 'Request Sent',
          description: `Access request sent to ${res.data?.target_org_name || 'target organization'}. Waiting for approval.`,
        });
        setShowNewRequest(false);
        setTargetOrgId('');
        setReason('');
        setDuration('4h');
        fetchRequests();
      } else {
        toast({
          title: 'Request Failed',
          description: res.error?.message || 'Failed to create access request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveRequest = async (approve: boolean) => {
    if (!selectedRequest) return;
    if (!approve && !denialReason) {
      toast({
        title: 'Required',
        description: 'Please provide a reason for denying the request.',
        variant: 'destructive',
      });
      return;
    }

    setApproving(true);
    try {
      const res = await edgeFunctions.accessRequests.respond({
        request_id: selectedRequest.id,
        action: approve ? 'approve' : 'deny',
        ...((!approve && denialReason) && { denial_reason: denialReason }),
      });

      if (res.success) {
        toast({
          title: approve ? 'Access Approved' : 'Request Denied',
          description: approve
            ? 'Temporary access has been granted.'
            : 'The access request has been denied.',
        });
        setShowApprovalDialog(false);
        setSelectedRequest(null);
        setDenialReason('');
        fetchRequests();
      } else {
        toast({
          title: 'Error',
          description: res.error?.message || 'Failed to process request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setApproving(false);
    }
  };

  const handleRevokeRequest = async (requestId: string) => {
    try {
      const res = await edgeFunctions.accessRequests.revoke(requestId);
      if (res.success) {
        toast({
          title: 'Request Cancelled',
          description: 'The access request has been cancelled.',
        });
        fetchRequests();
      } else {
        toast({
          title: 'Error',
          description: res.error?.message || 'Failed to cancel request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const pendingReceivedCount = receivedRequests.filter(r => r.status === 'pending').length;

  const renderStatusBadge = (status: AccessRequestStatus, expiresAt?: string) => {
    const expired = status === 'approved' && expiresAt && isRequestExpired({ status, expires_at: expiresAt } as AccessRequest);
    const displayStatus = expired ? 'expired' : status;
    return (
      <Badge className={getStatusColor(displayStatus as AccessRequestStatus)}>
        {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
      </Badge>
    );
  };

  const renderTimeInfo = (request: AccessRequest) => {
    if (request.status === 'approved' && request.expires_at) {
      const expired = isRequestExpired(request);
      if (expired) {
        return <span className="text-xs text-muted-foreground">Expired</span>;
      }
      return (
        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
          {getTimeRemaining(request.expires_at)}
        </span>
      );
    }
    return (
      <span className="text-xs text-muted-foreground">
        {formatDuration(request.requested_duration)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Cross-Org Access Requests
              </CardTitle>
              <CardDescription>
                Request temporary access to other organizations or manage incoming requests.
              </CardDescription>
            </div>
            {(isOwner || isAdmin) && (
              <Button onClick={() => setShowNewRequest(true)} className="gap-2">
                <Send className="w-4 h-4" />
                Request Access
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'sent' | 'received')}>
            <TabsList className="mb-4">
              <TabsTrigger value="sent" className="gap-2">
                <Send className="w-4 h-4" />
                Sent Requests
              </TabsTrigger>
              <TabsTrigger value="received" className="gap-2 relative">
                <Inbox className="w-4 h-4" />
                Incoming Requests
                {pendingReceivedCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                    {pendingReceivedCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Sent Requests Tab */}
            <TabsContent value="sent">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : sentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No access requests sent yet.</p>
                  <p className="text-sm mt-1">Use &quot;Request Access&quot; to request temporary access to another organization.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target Organization</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sentRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.target_org?.name || 'Unknown'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={request.reason}>
                          {request.reason}
                        </TableCell>
                        <TableCell>{renderTimeInfo(request)}</TableCell>
                        <TableCell>{renderStatusBadge(request.status, request.expires_at)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {request.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeRequest(request.id)}
                              className="text-destructive"
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          )}
                          {request.status === 'denied' && request.denial_reason && (
                            <span className="text-xs text-muted-foreground" title={request.denial_reason}>
                              Reason: {request.denial_reason}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Received Requests Tab */}
            <TabsContent value="received">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : receivedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No incoming access requests.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requester</TableHead>
                      <TableHead>From Organization</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivedRequests.map((request) => (
                      <TableRow key={request.id} className={request.status === 'pending' ? 'bg-yellow-50/50 dark:bg-yellow-950/20' : ''}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{request.requester?.full_name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{request.requester?.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{request.requester_org?.name || 'Unknown'}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={request.reason}>
                          {request.reason}
                        </TableCell>
                        <TableCell>{renderTimeInfo(request)}</TableCell>
                        <TableCell>{renderStatusBadge(request.status, request.expires_at)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {request.status === 'pending' && (isOwner || isAdmin) && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setShowApprovalDialog(true);
                                }}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Review
                              </Button>
                            </div>
                          )}
                          {request.status === 'approved' && !isRequestExpired(request) && (isOwner || isAdmin) && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1"
                              onClick={() => handleRevokeRequest(request.id)}
                            >
                              <Ban className="w-3 h-3" />
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Active Temporary Access Summary */}
      {sentRequests.filter(r => r.status === 'approved' && !isRequestExpired(r)).length > 0 && (
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Clock className="w-5 h-5" />
              Active Temporary Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sentRequests
                .filter(r => r.status === 'approved' && !isRequestExpired(r))
                .map(request => (
                  <div key={request.id} className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                    <div>
                      <span className="font-medium">{request.target_org?.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        — {request.reason}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        {request.expires_at && getTimeRemaining(request.expires_at)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Request Dialog */}
      <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Request Cross-Org Access
            </DialogTitle>
            <DialogDescription>
              Request temporary access to another organization. The org owner will be notified and can approve or deny.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Organization</Label>
              <Select value={targetOrgId} onValueChange={setTargetOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization..." />
                </SelectTrigger>
                <SelectContent>
                  {targetOrgs.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No other organizations available
                    </SelectItem>
                  ) : (
                    targetOrgs.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Access Duration</Label>
              <Select value={duration} onValueChange={(v) => setDuration(v as AccessRequestDuration)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason for Access</Label>
              <Textarea
                placeholder="Describe why you need temporary access to this organization (min 10 characters)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This will be visible to the organization owner when reviewing your request.
              </p>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Temporary access grants member-level permissions. All access is logged in the audit trail.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRequest(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRequest} disabled={submitting || !targetOrgId || reason.length < 10}>
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval/Denial Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={(open) => {
        setShowApprovalDialog(open);
        if (!open) {
          setSelectedRequest(null);
          setDenialReason('');
        }
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Review Access Request</DialogTitle>
            <DialogDescription>
              Approve or deny this cross-org access request.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Requester</span>
                  <span className="text-sm">{selectedRequest.requester?.full_name || selectedRequest.requester?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">From</span>
                  <span className="text-sm">{selectedRequest.requester_org?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Duration</span>
                  <span className="text-sm">{formatDuration(selectedRequest.requested_duration)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">Reason</Label>
                <p className="text-sm p-3 rounded-lg bg-muted/50">{selectedRequest.reason}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Denial Reason (required if denying)</Label>
                <Textarea
                  placeholder="Why is this request being denied..."
                  value={denialReason}
                  onChange={(e) => setDenialReason(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => handleApproveRequest(false)}
              disabled={approving}
            >
              {approving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              Deny
            </Button>
            <Button
              onClick={() => handleApproveRequest(true)}
              disabled={approving}
            >
              {approving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Approve Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
