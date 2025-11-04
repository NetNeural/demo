'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { UserPlus, Mail, Trash2, Shield, UserCog } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CreateUserDialog } from '@/components/organizations/CreateUserDialog';
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
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<OrganizationRole>('member');
  const [isAdding, setIsAdding] = useState(false);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!organizationId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/members?organization_id=${organizationId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Members API Error:', response.status, errorData);
        
        // Send to Sentry with context - feedback dialog shown automatically
        const error = new Error(errorData.error || `HTTP error! status: ${response.status}`);
        handleApiError(error, {
          endpoint: `/api/organizations/${organizationId}/members`,
          method: 'GET',
          status: response.status,
          errorData,
          context: {
            organization_id: organizationId,
          },
        });
        
        throw error;
      }

      const data = await response.json();
      setMembers(data.members || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      
      // Send to Sentry if not already sent
      if (error instanceof Error && !error.message.includes('HTTP error')) {
        handleApiError(error, {
          endpoint: `/api/organizations/${organizationId}/members`,
          method: 'GET',
          context: {
            component: 'MembersTab',
            action: 'fetchMembers',
            organization_id: organizationId,
          },
        });
      }
      
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAddMember = async () => {
    if (!addEmail || !addRole) {
      toast({
        title: 'Error',
        description: 'Please enter an email and select a role',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsAdding(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/members?organization_id=${organizationId}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: addEmail, role: addRole })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add member');
      }

      toast({
        title: 'Success',
        description: 'Member added successfully',
      });
      
      setAddEmail('');
      setAddRole('member');
      await fetchMembers();
    } catch (error) {
      console.error('Error adding member:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add member';
      const isUserNotFound = errorMessage.toLowerCase().includes('not found') || 
                             errorMessage.toLowerCase().includes('does not exist');
      
      if (isUserNotFound) {
        toast({
          title: 'User Not Found',
          description: `No account exists for ${addEmail}. Click "Create User" button below to create an account first.`,
          variant: 'destructive',
        });
        // Automatically show the create user dialog
        setTimeout(() => setShowCreateUserDialog(true), 1500);
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) {
      return;
    }

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/members?organization_id=${organizationId}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ memberId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove member');
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
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/members?organization_id=${organizationId}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ memberId, role: newRole })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role');
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

  const handleUserCreated = (email: string) => {
    // Auto-fill the email field with the newly created user's email
    setAddEmail(email);
    toast({
      title: 'User Created',
      description: `Now you can add ${email} to this organization`,
    });
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
      {/* Add New Member */}
      {canManageMembers && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Add Member
                </CardTitle>
                <CardDescription>
                  Add an existing user to this organization by their email.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowCreateUserDialog(true)}
              >
                <UserCog className="w-4 h-4 mr-2" />
                Create New User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="add-email">Email Address</Label>
                <div className="flex gap-2">
                  <Mail className="w-4 h-4 mt-3 text-muted-foreground" />
                  <Input
                    id="add-email"
                    type="email"
                    placeholder="user@example.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-role">Role</Label>
                <Select value={addRole} onValueChange={(val) => setAddRole(val as OrganizationRole)}>
                  <SelectTrigger id="add-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member - Manage devices & alerts</SelectItem>
                    <SelectItem value="admin">Admin - Full management access</SelectItem>
                    {userRole === 'owner' && (
                      <SelectItem value="owner">Owner - Complete control</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button onClick={handleAddMember} className="w-full" disabled={isAdding}>
                  {isAdding ? 'Adding...' : 'Add Member'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Members ({members.length})</CardTitle>
          <CardDescription>
            Users who have access to this organization
          </CardDescription>
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

      {/* Create User Dialog */}
      <CreateUserDialog 
        open={showCreateUserDialog}
        onOpenChange={setShowCreateUserDialog}
        onUserCreated={handleUserCreated}
      />
    </div>
  );
}
