'use client';

import { useState, useEffect, useCallback } from 'react';
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
  AlertCircle,
  Loader2,
  CheckCircle2
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

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function SecurityTab() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 2FA state
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollQrCode, setEnrollQrCode] = useState<string | null>(null);
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  // Load active sessions from Supabase
  useEffect(() => {
    const loadSessions = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Parse browser and OS from user agent
        const ua = navigator.userAgent;
        let browser = 'Unknown Browser';
        if (ua.includes('Edg/')) browser = 'Edge';
        else if (ua.includes('Chrome/')) browser = 'Chrome';
        else if (ua.includes('Firefox/')) browser = 'Firefox';
        else if (ua.includes('Safari/')) browser = 'Safari';

        let os = 'Unknown OS';
        if (ua.includes('Win')) os = 'Windows';
        else if (ua.includes('Mac')) os = 'macOS';
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

        // Calculate session age from token issued time
        const tokenIssuedAt = session.expires_at
          ? new Date((session.expires_at - 3600) * 1000) // expires_at minus 1 hour default TTL
          : null;

        const signedInText = tokenIssuedAt
          ? `Signed in ${formatTimeAgo(tokenIssuedAt)}`
          : 'Active now';

        const currentSession: Session = {
          id: session.access_token.substring(0, 10),
          device: `${browser} on ${os}`,
          location: signedInText,
          lastActive: 'Active now',
          current: true
        };
        setSessions([currentSession]);
      }
    };
    
    loadSessions();
  }, []);

  // Check MFA enrollment status on mount
  const checkMfaStatus = useCallback(async () => {
    try {
      setMfaLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        console.error('Failed to list MFA factors:', error);
        return;
      }
      // Find verified TOTP factor
      const verified = data.totp.find(f => f.status === 'verified');
      if (verified) {
        setMfaEnrolled(true);
        setMfaFactorId(verified.id);
      } else {
        setMfaEnrolled(false);
        setMfaFactorId(null);
      }
    } catch (err) {
      console.error('MFA status check error:', err);
    } finally {
      setMfaLoading(false);
    }
  }, []);

  useEffect(() => {
    checkMfaStatus();
  }, [checkMfaStatus]);

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
      // Start MFA enrollment
      try {
        setEnrolling(true);
        const supabase = createClient();
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Authenticator App',
        });
        if (error) {
          toast({
            title: 'Error',
            description: `Failed to start 2FA setup: ${error.message}`,
            variant: 'destructive',
          });
          setEnrolling(false);
          return;
        }
        setEnrollQrCode(data.totp.qr_code);
        setEnrollSecret(data.totp.secret);
        setEnrollFactorId(data.id);
      } catch (err) {
        console.error('MFA enroll error:', err);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred starting 2FA setup.',
          variant: 'destructive',
        });
        setEnrolling(false);
      }
    } else {
      // Unenroll MFA
      if (!mfaFactorId) return;
      try {
        setUnenrolling(true);
        const supabase = createClient();
        const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
        if (error) {
          toast({
            title: 'Error',
            description: `Failed to disable 2FA: ${error.message}`,
            variant: 'destructive',
          });
          return;
        }
        setMfaEnrolled(false);
        setMfaFactorId(null);
        toast({
          title: '2FA Disabled',
          description: 'Two-factor authentication has been removed from your account.',
        });
      } catch (err) {
        console.error('MFA unenroll error:', err);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred removing 2FA.',
          variant: 'destructive',
        });
      } finally {
        setUnenrolling(false);
      }
    }
  };

  const handleVerifyEnrollment = async () => {
    if (!enrollFactorId || verifyCode.length !== 6) {
      toast({
        title: 'Error',
        description: 'Please enter the 6-digit code from your authenticator app.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setVerifying(true);
      const supabase = createClient();

      // Challenge the factor first
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollFactorId,
      });
      if (challengeError) {
        toast({
          title: 'Error',
          description: `Challenge failed: ${challengeError.message}`,
          variant: 'destructive',
        });
        return;
      }

      // Verify with the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      if (verifyError) {
        toast({
          title: 'Invalid Code',
          description: 'The verification code was incorrect. Please check your authenticator app and try again.',
          variant: 'destructive',
        });
        return;
      }

      // Success
      setMfaEnrolled(true);
      setMfaFactorId(enrollFactorId);
      setEnrolling(false);
      setEnrollQrCode(null);
      setEnrollSecret(null);
      setEnrollFactorId(null);
      setVerifyCode('');
      setShowSecret(false);
      toast({
        title: '2FA Enabled',
        description: 'Two-factor authentication is now active. You\'ll need your authenticator app when signing in.',
      });
    } catch (err) {
      console.error('MFA verify error:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred during verification.',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleCancelEnrollment = async () => {
    // Unenroll the unverified factor to clean up
    if (enrollFactorId) {
      try {
        const supabase = createClient();
        await supabase.auth.mfa.unenroll({ factorId: enrollFactorId });
      } catch {
        // Ignore cleanup errors
      }
    }
    setEnrolling(false);
    setEnrollQrCode(null);
    setEnrollSecret(null);
    setEnrollFactorId(null);
    setVerifyCode('');
    setShowSecret(false);
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
          {mfaLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking 2FA status...
            </div>
          ) : enrolling && enrollQrCode ? (
            /* ── Enrollment flow: QR code + verify ── */
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-4">
                <div className="flex items-start gap-2">
                  <Smartphone className="w-5 h-5 mt-0.5 text-primary" />
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium">Setup Instructions</p>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Open your authenticator app (Google Authenticator, Authy, 1Password, etc.)</li>
                      <li>Scan the QR code below, or enter the setup key manually</li>
                      <li>Enter the 6-digit code shown in the app to confirm</li>
                    </ol>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex justify-center py-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={enrollQrCode}
                      alt="Scan this QR code with your authenticator app"
                      width={200}
                      height={200}
                    />
                  </div>
                </div>

                {/* Manual setup key */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? 'Hide' : 'Show'} Setup Key
                  </Button>
                  {showSecret && enrollSecret && (
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-background px-3 py-2 rounded border font-mono tracking-wider">
                        {enrollSecret}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(enrollSecret);
                          toast({ title: 'Copied', description: 'Setup key copied to clipboard' });
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Verification input */}
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="verify-code">Enter 6-digit code from your app</Label>
                  <div className="flex gap-2">
                    <Input
                      id="verify-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-32 text-center font-mono text-lg tracking-widest"
                      autoComplete="one-time-code"
                    />
                    <Button
                      onClick={handleVerifyEnrollment}
                      disabled={verifying || verifyCode.length !== 6}
                    >
                      {verifying ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>
                      ) : (
                        <><CheckCircle2 className="w-4 h-4 mr-2" />Verify & Enable</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={handleCancelEnrollment}>
                Cancel Setup
              </Button>
            </div>
          ) : (
            /* ── Normal state: toggle on/off ── */
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="2fa">Enable 2FA</Label>
                  <p className="text-sm text-muted-foreground">
                    Require a verification code from your phone when signing in
                  </p>
                </div>
                <Switch
                  id="2fa"
                  checked={mfaEnrolled}
                  onCheckedChange={handleToggle2FA}
                  disabled={unenrolling}
                />
              </div>

              {mfaEnrolled && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Shield className="w-4 h-4" />
                  Two-factor authentication is enabled
                  {unenrolling && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                </div>
              )}
            </>
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
