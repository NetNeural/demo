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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getRoleDisplayInfo, OrganizationRole } from '@/types/organization';
import { UserPlus, Trash2, KeyRound, Copy, Mail, CheckCircle2 } from 'lucide-react';
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
  passwordChangeRequired?: boolean;
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
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

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

  const handleResetPassword = async (member: OrganizationMember) => {
    try {
      setResettingPassword(true);
      setSelectedMember(member);
      
      // Generate random password (12 characters, mix of letters, numbers, special chars)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
      const tempPassword = Array.from(
        { length: 12 }, 
        () => chars[Math.floor(Math.random() * chars.length)]
      ).join('');
      
      // Call reset password API (we'll create this edge function)
      const response = await edgeFunctions.members.resetPassword(
        member.userId, 
        tempPassword
      );

      if (!response.success) {
        const errorMsg = typeof response.error === 'string'
          ? response.error
          : 'Failed to reset password';
        throw new Error(errorMsg);
      }

      setGeneratedPassword(tempPassword);
      setPasswordCopied(false);
      setShowPasswordDialog(true);
      
      toast({
        title: 'Password Reset',
        description: `New temporary password generated for ${member.name}`,
      });
      
      // Refresh members to update password status
      await fetchMembers();
    } catch (error) {
      console.error('❌ Error resetting password:', error);
      
      const errorMsg = error instanceof Error ? error.message : 'Failed to reset password';
      
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    setPasswordCopied(true);
    
    toast({
      title: 'Copied',
      description: 'Password copied to clipboard',
    });
    
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const handleEmailPassword = async () => {
    if (!selectedMember) return;
    
    try {
      // Reset password again to trigger email
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
      const tempPassword = Array.from(
        { length: 12 }, 
        () => chars[Math.floor(Math.random() * chars.length)]
      ).join('');
      
      const response = await edgeFunctions.members.resetPassword(
        selectedMember.userId, 
        tempPassword
      );

      if (!response.success) {
        throw new Error('Failed to send email');
      }

      toast({
        title: 'Email Sent',
        description: `Password has been emailed to ${selectedMember.email}`,
      });
      
      // Update the displayed password
      setGeneratedPassword(tempPassword);
      setPasswordCopied(false);
    } catch (error) {
      console.error('❌ Error emailing password:', error);
      
      toast({
        title: 'Email Failed',
        description: 'Could not send email. Please copy the password manually.',
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
                  <TableHead>Password</TableHead>
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
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={member.passwordChangeRequired ? "destructive" : "outline"}
                            className="text-xs"
                          >
                            {member.passwordChangeRequired ? "Temporary" : "Set"}
                          </Badge>
                          {canModifyThisMember && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetPassword(member)}
                              disabled={resettingPassword}
                              title="Reset password"
                            >
                              <KeyRound className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
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

      {/* Reset Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset</DialogTitle>
            <DialogDescription>
              A new temporary password has been generated for {selectedMember?.name}.
              The user will be required to change it on their next login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="text-sm text-muted-foreground">
                {selectedMember?.email}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Temporary Password</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                  {generatedPassword}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPassword}
                  title="Copy to clipboard"
                >
                  {passwordCopied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ Make sure to save this password - you won&apos;t be able to see it again!
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleEmailPassword}
              className="w-full sm:w-auto"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email Password
            </Button>
            <Button
              onClick={() => setShowPasswordDialog(false)}
              className="w-full sm:w-auto"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
