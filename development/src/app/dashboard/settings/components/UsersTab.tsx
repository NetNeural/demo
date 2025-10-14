'use client';

import React, { useState } from 'react';
import { Users as UsersIcon, Mail, UserPlus, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { SettingsSection } from './shared/SettingsSection';
import { SettingsFormGroup } from './shared/SettingsFormGroup';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  lastActive: string;
}

interface UsersTabProps {
  initialUsers?: User[];
}

export default function UsersTab({
  initialUsers = [
    {
      id: '1',
      name: 'NetNeural Admin',
      email: 'admin@netneural.ai',
      role: 'Owner',
      department: 'Management',
      lastActive: '2 min ago',
    },
    {
      id: '2',
      name: 'John Engineer',
      email: 'john@netneural.ai',
      role: 'Admin',
      department: 'Engineering',
      lastActive: '1 hour ago',
    },
    {
      id: '3',
      name: 'Sarah Operator',
      email: 'sarah@netneural.ai',
      role: 'Operator',
      department: 'Operations',
      lastActive: '3 hours ago',
    },
  ],
}: UsersTabProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteDepartment, setInviteDepartment] = useState('');

  const handleSendInvitation = async () => {
    console.log('Sending invitation:', { inviteEmail, inviteRole, inviteDepartment });
    // TODO: Implement API call
    setInviteEmail('');
    setInviteRole('viewer');
    setInviteDepartment('');
  };

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner':
        return <Badge className="bg-purple-500">Owner</Badge>;
      case 'admin':
        return <Badge className="bg-blue-500">Admin</Badge>;
      case 'operator':
        return <Badge className="bg-green-500">Operator</Badge>;
      case 'viewer':
        return <Badge variant="secondary">Viewer</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Invite New User */}
      <SettingsSection
        icon={<UserPlus className="w-5 h-5" />}
        title="Invite New User"
        description="Send an invitation to join your organization"
        actions={
          <Button size="sm" onClick={handleSendInvitation} disabled={!inviteEmail}>
            <Mail className="w-4 h-4 mr-2" />
            Send Invitation
          </Button>
        }
      >
        <div className="grid gap-6 md:grid-cols-3">
          <SettingsFormGroup label="Email Address" required>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@company.com"
            />
          </SettingsFormGroup>

          <SettingsFormGroup label="Role" required>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </SettingsFormGroup>

          <SettingsFormGroup label="Department">
            <Select value={inviteDepartment} onValueChange={setInviteDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Select department..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engineering">Engineering</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="management">Management</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
              </SelectContent>
            </Select>
          </SettingsFormGroup>
        </div>
      </SettingsSection>

      {/* Current Users */}
      <SettingsSection
        icon={<UsersIcon className="w-5 h-5" />}
        title="Current Users"
        description={`${users.length} active users in your organization`}
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell className="text-muted-foreground">{user.lastActive}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SettingsSection>
    </div>
  );
}
