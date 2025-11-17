'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getRoleDisplayInfo, OrganizationRole } from '@/types/organization';
import { UserPlus, Trash2, Shield } from 'lucide-react';
import { edgeFunctions } from '@/lib/edge-functions/client';
import { useToast } from '@/hooks/use-toast';
import { AddMemberDialog } from '@/components/organizations/AddMemberDialog';
import { handleApiError } from '@/lib/sentry-utils';

interface OrganizationMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: OrganizationRole;
  joinedAt: string;
}

interface MembersTabProps {
  organizationId: string;
}

export function MembersTab({ organizationId }: MembersTabProps) {
  const { permissions, userRole } = useOrganization();
  const { canManageMembers } = permissions;
  const { toast } = useToast();
  
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!organizationId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const response = await edgeFunctions.members.list(organizationId);

      if (!response.success) {
        const error = new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to fetch members'
        );
        
        // Send to Sentry with context but don't show popup
        handleApiError(error, {
          endpoint: `/api/organizations/${organizationId}/members`,
          method: 'GET',
          context: {
            organization_id: organizationId,
          },
          skipUserNotification: true, // Prevent Sentry popup
        });
        
        // Don't throw - just set empty members array and continue
        setMembers([]);
        return;
      }

      const data = response.data as { members?: OrganizationMember[] };
      setMembers(data.members || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      
      // Send to Sentry but don't show popup to user
      handleApiError(
        error instanceof Error ? error : new Error('Unknown error'),
        {
          endpoint: `/api/organizations/${organizationId}/members`,
          method: 'GET',
          context: {
            component: 'MembersTab',
            action: 'fetchMembers',
            organization_id: organizationId,
          },
          skipUserNotification: true, // Prevent Sentry popup
        }
      );
      
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) {
      return;
    }

    try {
      const response = await edgeFunctions.members.remove(organizationId, memberId);

      if (!response.success) {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to remove member'
        );
      }

      toast({
        title: 'Success',
        description: 'Member removed successfully',
      });
      
      await fetchMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  const handleChangeRole = async (memberId: string, newRole: OrganizationRole) => {
    try {
      const response = await edgeFunctions.members.updateRole(organizationId, memberId, newRole);

      if (!response.success) {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to update role'
        );
      }

      toast({
        title: 'Success',
        description: 'Member role updated successfully',
      });
      
      await fetchMembers();
    } catch (error) {
      console.error('Error changing role:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive',
      });
    }
  };

  if (!canManageMembers) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center space-y-3">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">Permission Denied</h3>
            <p className="text-muted-foreground">
              You do not have permission to manage members in this organization.
            </p>
            <p className="text-sm text-muted-foreground">
              Current role: <Badge variant="secondary" className="capitalize">{userRole}</Badge>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <p className="text-muted-foreground">Loading members...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organization Members ({members.length})</CardTitle>
              <CardDescription>
                Users who have access to this organization
              </CardDescription>
            </div>
            {canManageMembers && (
              <Button onClick={() => setShowAddMemberDialog(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No members in this organization yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const roleInfo = getRoleDisplayInfo(member.role);
                  const canModifyThisMember = canManageMembers && member.role !== 'owner';
                  
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell className="text-muted-foreground">{member.email}</TableCell>
                      <TableCell>
                        {canModifyThisMember ? (
                          <Select 
                            value={member.role} 
                            onValueChange={(val) => handleChangeRole(member.id, val as OrganizationRole)}
                          >
                            <SelectTrigger className="w-32">
                              <Badge className={roleInfo.color}>{roleInfo.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              {userRole === 'owner' && <SelectItem value="owner">Owner</SelectItem>}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={roleInfo.color}>{roleInfo.label}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {canModifyThisMember ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <AddMemberDialog
        organizationId={organizationId}
        open={showAddMemberDialog}
        onOpenChange={setShowAddMemberDialog}
        onMemberAdded={fetchMembers}
        userRole={userRole || 'member'}
      />
    </div>
  );
}
