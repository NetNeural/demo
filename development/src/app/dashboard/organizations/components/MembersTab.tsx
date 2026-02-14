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
  const { canManageMembers, canRemoveMembers } = permissions;
  const { toast } = useToast();
  
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);

  // Debug logging
  console.log('📋 MembersTab context:', { 
    userRole, 
    canManageMembers, 
    canRemoveMembers, 
    organizationId 
  });

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
    const memberToRemove = members.find(m => m.id === memberId);
    const memberName = memberToRemove?.name || 'this member';
    
    if (!confirm(`Are you sure you want to remove ${memberName} from the organization?`)) {
      return;
    }

    try {
      console.log('🗑️ Removing member:', { memberId, organizationId });
      
      const response = await edgeFunctions.members.remove(organizationId, memberId);

      if (!response.success) {
        const errorMsg = typeof response.error === 'string'
          ? response.error
          : 'Failed to remove member';
        
        console.error('❌ Remove member failed:', response.error);
        throw new Error(errorMsg);
      }

      console.log('✅ Member removed successfully');
      
      toast({
        title: 'Success',
        description: `${memberName} has been removed from the organization`,
      });
      
      await fetchMembers();
    } catch (error) {
      console.error('❌ Error removing member:', error);
      
      const errorMsg = error instanceof Error ? error.message : 'Failed to remove member';
      
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  const handleChangeRole = async (memberId: string, newRole: OrganizationRole) => {
    const memberToUpdate = members.find(m => m.id === memberId);
    const memberName = memberToUpdate?.name || 'member';
    
    try {
      console.log('🔄 Updating member role:', { memberId, newRole, organizationId });
      
      const response = await edgeFunctions.members.updateRole(organizationId, memberId, newRole);

      if (!response.success) {
        const errorMsg = typeof response.error === 'string'
          ? response.error
          : 'Failed to update role';
        
        console.error('❌ Update role failed:', response.error);
        throw new Error(errorMsg);
      }

      console.log('✅ Role updated successfully');
      
      toast({
        title: 'Success',
        description: `${memberName}'s role has been updated to ${newRole}`,
      });
      
      await fetchMembers();
    } catch (error) {
      console.error('❌ Error changing role:', error);
      
      const errorMsg = error instanceof Error ? error.message : 'Failed to update role';
      
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

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
                  
                  // Can modify if:
                  // 1. User can manage members (admin or owner)
                  // 2. AND (target is not owner OR current user is owner - only owners can modify owners)
                  const canModifyThisMember = canManageMembers && (member.role !== 'owner' || userRole === 'owner');
                  
                  // Can delete if:
                  // 1. User has remove permissions (admin or owner)
                  // 2. AND (target is not owner OR current user is owner - only owners can delete owners)
                  const canDeleteThisMember = canRemoveMembers && (member.role !== 'owner' || userRole === 'owner');
                  
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
                        {canDeleteThisMember ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                            title="Remove member from organization"
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
