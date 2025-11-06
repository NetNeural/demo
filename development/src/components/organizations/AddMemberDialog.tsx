'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { OrganizationRole } from '@/types/organization';
import { UserPlus, Mail, Shield, CheckCircle2, Copy, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AddMemberDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: () => void;
  userRole: OrganizationRole;
}

export function AddMemberDialog({
  organizationId,
  open,
  onOpenChange,
  onMemberAdded,
  userRole,
}: AddMemberDialogProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<OrganizationRole>('member');
  const [isProcessing, setIsProcessing] = useState(false);
  const [needsUserCreation, setNeedsUserCreation] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPasswordSuccess, setShowPasswordSuccess] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const { toast } = useToast();

  const handleAddMember = async () => {
    if (!email) {
      toast({
        title: 'Email Required',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    // If we need to create user, validate full name
    if (needsUserCreation && !fullName) {
      toast({
        title: 'Name Required',
        description: 'Please enter the full name for the new user',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsProcessing(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      // If we already know user needs to be created and we have the full name, create them first
      if (needsUserCreation && fullName) {
        const createUserUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-user`;
        
        // Generate a temporary password (user will be required to change it)
        const tempPassword = `Temp${Math.random().toString(36).substring(2, 10)}!`;

        const createResponse = await fetch(createUserUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            fullName,
            password: tempPassword,
            role: 'user',
          }),
        });

        const createData = await createResponse.json();

        if (!createResponse.ok) {
          // Check if user already exists (they might have been created in a previous attempt)
          const errorMsg = createData.error?.toLowerCase() || '';
          const userExists = errorMsg.includes('already exists') || errorMsg.includes('already registered');
          
          if (userExists) {
            // User already exists, just try to add them to the organization
            const addMemberUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/members?organization_id=${organizationId}`;
            
            const addResponse = await fetch(addMemberUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, role }),
            });

            const addData = await addResponse.json();

            if (!addResponse.ok) {
              // Check if already a member
              const addErrorMsg = addData.error?.toLowerCase() || '';
              const alreadyMember = addErrorMsg.includes('already a member') || addErrorMsg.includes('already exists');
              
              if (alreadyMember) {
                toast({
                  title: 'Already a Member',
                  description: `${email} is already a member of this organization.`,
                });

                // Reset form and close dialog
                setEmail('');
                setFullName('');
                setRole('member');
                setNeedsUserCreation(false);
                onOpenChange(false);
                onMemberAdded();
                return;
              }
              
              throw new Error(addData.error || 'User exists but failed to add to organization');
            }

            toast({
              title: 'Member Added',
              description: `${email} has been added to the organization.`,
            });

            // Reset form and close dialog
            setEmail('');
            setFullName('');
            setRole('member');
            setNeedsUserCreation(false);
            onOpenChange(false);
            onMemberAdded();
            return;
          }
          
          throw new Error(createData.error || 'Failed to create user account');
        }

        // User created successfully, store the password and show success
        setGeneratedPassword(tempPassword);
        setShowPasswordSuccess(true);
        setIsProcessing(false);
        
        // Now add to organization
        const addMemberUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/members?organization_id=${organizationId}`;
        
        const addResponse = await fetch(addMemberUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, role }),
        });

        const addData = await addResponse.json();

        if (!addResponse.ok) {
          // Check if user is already a member (they might have been added in a previous attempt)
          const errorMsg = addData.error?.toLowerCase() || '';
          const alreadyMember = errorMsg.includes('already a member') || errorMsg.includes('already exists');
          
          if (alreadyMember) {
            // User was already added - just keep showing the password screen
            // We'll refresh the member list when they click "Done"
            return;
          }
          
          throw new Error(addData.error || 'User created but failed to add to organization');
        }

        // All done - password screen is already showing
        setIsProcessing(false);
      }

      // Try to add existing user to organization
      const addMemberUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/members?organization_id=${organizationId}`;
      
      const addResponse = await fetch(addMemberUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, role }),
      });

      const addData = await addResponse.json();

      if (addResponse.ok) {
        // User exists and was added successfully
        toast({
          title: 'Member Added',
          description: `${email} has been added to the organization`,
        });

        // Reset form and close dialog
        setEmail('');
        setFullName('');
        setRole('member');
        setNeedsUserCreation(false);
        onOpenChange(false);
        onMemberAdded();
      } else {
        // Check if error is because user doesn't exist
        const errorMsg = addData.error?.toLowerCase() || '';
        const userNotFound = errorMsg.includes('not found') || errorMsg.includes('does not exist');

        if (userNotFound) {
          // User doesn't exist - show the creation form
          setNeedsUserCreation(true);
          setIsProcessing(false);
          return; // Don't close dialog, let user fill in details
        } else {
          // Some other error
          throw new Error(addData.error || 'Failed to add member');
        }
      }
    } catch (error) {
      console.error('Error adding member:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add member',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setEmail('');
    setFullName('');
    setRole('member');
    setNeedsUserCreation(false);
    setGeneratedPassword('');
    setShowPasswordSuccess(false);
    setPasswordCopied(false);
    onOpenChange(false);
  };

  const copyPassword = async () => {
    if (generatedPassword) {
      await navigator.clipboard.writeText(generatedPassword);
      setPasswordCopied(true);
      toast({
        title: 'Password Copied',
        description: 'Temporary password copied to clipboard',
      });
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setEmail('');
    setFullName('');
    setRole('member');
    setNeedsUserCreation(false);
    setGeneratedPassword('');
    setShowPasswordSuccess(false);
    setPasswordCopied(false);
    onOpenChange(false);
    onMemberAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {showPasswordSuccess ? (
          // Success screen showing the generated password
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                User Created Successfully!
              </DialogTitle>
              <DialogDescription>
                {fullName} has been added to the organization. Share these credentials with them.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <p className="font-medium">{email}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 bg-white px-3 py-2 rounded border text-sm font-mono">
                          {generatedPassword}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={copyPassword}
                          className="shrink-0"
                        >
                          {passwordCopied ? (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-1" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertDescription className="text-xs">
                  <strong>Important:</strong> The user will be required to change this password on their first login.
                  Make sure to share these credentials securely.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Normal add member form
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Add Team Member
              </DialogTitle>
              <DialogDescription>
                {needsUserCreation
                  ? 'This email is not registered. Provide their details to create an account and add them to your organization.'
                  : 'Add someone to your organization. If they don&apos;t have an account yet, we&apos;ll create one for them.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="add-member-email">Email Address *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                id="add-member-email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isProcessing || needsUserCreation}
                className="pl-10"
              />
            </div>
          </div>

          {/* Show name field if user needs to be created */}
          {needsUserCreation && (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  No account found for <strong>{email}</strong>. We&apos;ll create one for them.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="add-member-name">Full Name *</Label>
                <Input
                  id="add-member-name"
                  type="text"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isProcessing}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  This will be displayed in the organization
                </p>
              </div>
            </>
          )}

          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="add-member-role">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Role in Organization *
              </div>
            </Label>
            <Select value={role} onValueChange={(val) => setRole(val as OrganizationRole)}>
              <SelectTrigger id="add-member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[300]">
                <SelectItem value="member">Member - Can manage devices and alerts</SelectItem>
                <SelectItem value="admin">Admin - Full management access including members</SelectItem>
                {userRole === 'owner' && (
                  <SelectItem value="owner">Owner - Complete control including billing</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {needsUserCreation && (
            <Alert>
              <AlertDescription className="text-xs">
                <strong>Note:</strong> A temporary password will be generated. The user will be
                required to change it on first login. You&apos;ll see the password after creating the account.
              </AlertDescription>
            </Alert>
          )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
                Cancel
              </Button>
              <Button onClick={handleAddMember} disabled={isProcessing}>
                {isProcessing ? (
                  <>Processing...</>
                ) : needsUserCreation ? (
                  <>Create & Add to Organization</>
                ) : (
                  <>Add to Organization</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
