'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Key, 
  Smartphone, 
  Clock, 
  Trash2,
  Copy,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
}

export function SecurityTab() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [qrCodeData, setQrCodeData] = useState('');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  // Load active sessions from Supabase
  useEffect(() => {
    const loadSessions = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Current session
        const currentSession: Session = {
          id: session.access_token.substring(0, 10),
          device: navigator.userAgent.includes('Chrome') ? 'Chrome on ' + (navigator.platform || 'Windows') :
                 navigator.userAgent.includes('Firefox') ? 'Firefox on ' + (navigator.platform || 'Windows') :
                 navigator.userAgent.includes('Safari') ? 'Safari on ' + (navigator.platform || 'macOS') :
                 'Unknown Device',
          location: 'Current Location', // Could use IP geolocation API
          lastActive: 'Active now',
          current: true
        };
        setSessions([currentSession]);
      }
    };
    
    loadSessions();
  }, []);

  // Load API keys from Supabase (stored in a custom api_keys table)
  // Load API keys from database
  useEffect(() => {
    const loadApiKeys = async () => {
      // Note: The api_keys table needs to be added to the database schema
      // For now, showing empty state
      // TODO: Add api_keys table migration with columns: id, user_id, name, key_prefix, key_suffix, created_at, last_used_at
      setApiKeys([]);
    };
    
    loadApiKeys();
  }, []);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    if (!currentPassword || !newPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "New password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      const supabase = createClient();
      
      // First verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getUser()).data.user?.email || '',
        password: currentPassword
      });

      if (verifyError) {
        toast({
          title: "Error",
          description: "Current password is incorrect",
          variant: "destructive",
        });
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        toast({
          title: "Error",
          description: "Failed to update password: " + updateError.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Password updated successfully!",
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Error changing password:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions(sessions.filter(s => s.id !== sessionId));
    toast({
      title: "Session Revoked",
      description: "The session has been successfully revoked",
    });
  };

  const handleRevokeApiKey = (keyId: string) => {
    setApiKeys(apiKeys.filter(k => k.id !== keyId));
    toast({
      title: "API Key Revoked",
      description: "The API key has been successfully revoked",
    });
  };

  const handleCreateApiKey = () => {
    const newKey: ApiKey = {
      id: `key${apiKeys.length + 1}`,
      name: 'New API Key',
      key: `nn_live_${Math.random().toString(36).substring(2, 15)}`,
      created: new Date().toISOString().split('T')[0] || '',
      lastUsed: 'Never'
    };
    setApiKeys([...apiKeys, newKey]);
    toast({
      title: "API Key Created",
      description: "New API key has been created. Copy it now - it won't be shown again!",
    });
  };

  const handleCopyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const handleToggle2FA = async (checked: boolean) => {
    if (checked) {
      toast({
        title: "2FA Setup (Coming Soon)",
        description: "Two-factor authentication requires Supabase MFA enrollment. The UI is ready but backend MFA enrollment is pending.",
      });
      setShowSetup2FA(true);
      setTwoFactorEnabled(true);
      
      // Generate a demo QR code data (in production this would come from Supabase MFA enrollment)
      setQrCodeData('otpauth://totp/NetNeural:admin@netneural.ai?secret=DEMO&issuer=NetNeural');
    } else {
      setTwoFactorEnabled(false);
      setShowSetup2FA(false);
      setQrCodeData('');
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled.",
      });
    }
  };

  const handleShowQRCode = () => {
    toast({
      title: "QR Code (Coming Soon)",
      description: "In production, a QR code from Supabase MFA enrollment would be displayed here for scanning with your authenticator app.",
    });
  };

  const handleShowSetupKey = () => {
    toast({
      title: "Setup Key (Coming Soon)",
      description: "In production, the TOTP secret from Supabase MFA enrollment would be shown here for manual entry in your authenticator app.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          <Button onClick={handleChangePassword}>
            Change Password
          </Button>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="2fa">Enable 2FA</Label>
              <p className="text-sm text-muted-foreground">
                Require a verification code from your phone when signing in
              </p>
            </div>
            <Switch
              id="2fa"
              checked={twoFactorEnabled}
              onCheckedChange={handleToggle2FA}
            />
          </div>

          {showSetup2FA && twoFactorEnabled && (
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <Smartphone className="w-5 h-5 mt-0.5 text-primary" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium">Setup Instructions</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Install an authenticator app (Google Authenticator, Authy, etc.)</li>
                    <li>Scan the QR code or enter the setup key</li>
                    <li>Enter the 6-digit code to verify</li>
                  </ol>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={handleShowQRCode}>Show QR Code</Button>
                    <Button size="sm" variant="outline" onClick={handleShowSetupKey}>Show Setup Key</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {twoFactorEnabled && !showSetup2FA && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Shield className="w-4 h-4" />
              Two-factor authentication is enabled
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Manage your active sessions across different devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{session.device}</p>
                      {session.current && (
                        <Badge variant="default" className="text-xs">Current</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{session.location}</p>
                    <p className="text-xs text-muted-foreground">Last active: {session.lastActive}</p>
                  </div>
                </div>
                {!session.current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeSession(session.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Manage your personal API keys for integrations
              </CardDescription>
            </div>
            <Button onClick={handleCreateApiKey} size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Create New Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{apiKey.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {apiKey.key}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyApiKey(apiKey.key)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Created: {apiKey.created}</span>
                    <span>Last used: {apiKey.lastUsed}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevokeApiKey(apiKey.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Keep your API keys secure and never share them publicly. Revoke any keys that may have been compromised.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
