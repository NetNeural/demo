'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Moon, Sun, Monitor, Globe, Layout, Bell, Palette, Building2, Thermometer } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';

export function PreferencesTab() {
  const { currentOrganization } = useOrganization();
  const [saving, setSaving] = useState(false);
  const [useOrgDefault, setUseOrgDefault] = useState(true); // Default to organization theme
  const [theme, setTheme] = useState('system');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('America/New_York');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [timeFormat, setTimeFormat] = useState('12h');
  const [compactMode, setCompactMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [minSeverity, setMinSeverity] = useState('medium');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');
  const [muteWeekends, setMuteWeekends] = useState(false);

  // Temperature unit preference (default: Fahrenheit)
  const [temperatureUnit, setTemperatureUnit] = useState<'F' | 'C'>('F');

  // Get organization default theme
  const orgTheme = currentOrganization?.settings?.theme || 'auto';
  
  // Apply theme to document whenever it changes
  useEffect(() => {
    const root = document.documentElement;
    
    // Save preferences to localStorage
    localStorage.setItem('useOrgDefaultTheme', useOrgDefault.toString());
    if (!useOrgDefault) {
      localStorage.setItem('theme', theme);
    }
    
    // Determine which theme to apply
    const effectiveTheme = useOrgDefault ? orgTheme : theme;
    
    // Remove all theme classes
    root.classList.remove('dark', 'light', 'theme-slate', 'theme-navy', 'theme-emerald', 'theme-neutral', 'theme-high-contrast', 'theme-twilight', 'theme-crimson');
    
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else if (effectiveTheme === 'light') {
      root.classList.add('light');
    } else if (effectiveTheme === 'system' || effectiveTheme === 'auto') {
      // System theme - respect OS preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    } else {
      // Custom theme
      root.classList.add(effectiveTheme);
    }
  }, [theme, useOrgDefault, orgTheme]);

  // Load preferences from Supabase on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // First check localStorage for immediate theme application
        const savedUseOrgDefault = localStorage.getItem('useOrgDefaultTheme');
        if (savedUseOrgDefault !== null) {
          setUseOrgDefault(savedUseOrgDefault === 'true');
        } else {
          // Default to true for new users
          setUseOrgDefault(true);
          localStorage.setItem('useOrgDefaultTheme', 'true');
        }
        
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
          setTheme(savedTheme);
        }
        
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user?.user_metadata?.preferences) {
          const prefs = user.user_metadata.preferences;
          if (prefs.useOrgDefaultTheme !== undefined) setUseOrgDefault(prefs.useOrgDefaultTheme);
          if (prefs.theme) setTheme(prefs.theme);
          if (prefs.language) setLanguage(prefs.language);
          if (prefs.timezone) setTimezone(prefs.timezone);
          if (prefs.dateFormat) setDateFormat(prefs.dateFormat);
          if (prefs.timeFormat) setTimeFormat(prefs.timeFormat);
          if (prefs.compactMode !== undefined) setCompactMode(prefs.compactMode);
          if (prefs.animationsEnabled !== undefined) setAnimationsEnabled(prefs.animationsEnabled);
          if (prefs.soundEnabled !== undefined) setSoundEnabled(prefs.soundEnabled);
          if (prefs.emailNotifications !== undefined) setEmailNotifications(prefs.emailNotifications);
          if (prefs.smsNotifications !== undefined) setSmsNotifications(prefs.smsNotifications);
          if (prefs.pushNotifications !== undefined) setPushNotifications(prefs.pushNotifications);
          if (prefs.minSeverity) setMinSeverity(prefs.minSeverity);
          if (prefs.quietHoursEnabled !== undefined) setQuietHoursEnabled(prefs.quietHoursEnabled);
          if (prefs.quietHoursStart) setQuietHoursStart(prefs.quietHoursStart);
          if (prefs.quietHoursEnd) setQuietHoursEnd(prefs.quietHoursEnd);
          if (prefs.muteWeekends !== undefined) setMuteWeekends(prefs.muteWeekends);
          if (prefs.temperatureUnit) {
            setTemperatureUnit(prefs.temperatureUnit);
            localStorage.setItem('temperatureUnit', prefs.temperatureUnit);
          }
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };
    
    loadPreferences();
  }, []);

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      const preferences = {
        useOrgDefaultTheme: useOrgDefault,
        theme,
        language,
        timezone,
        dateFormat,
        timeFormat,
        compactMode,
        animationsEnabled,
        soundEnabled,
        emailNotifications,
        smsNotifications,
        pushNotifications,
        minSeverity,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
        muteWeekends,
        temperatureUnit,
      };

      // Save to Supabase user metadata
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { preferences }
      });

      if (error) {
        toast.error('Failed to save preferences: ' + error.message);
        return;
      }

      // Also save to localStorage as backup
      localStorage.setItem('user_preferences', JSON.stringify(preferences));
      localStorage.setItem('temperatureUnit', temperatureUnit);
      
      toast.success('Preferences saved successfully!');
    } catch (err) {
      console.error('Error saving preferences:', err);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="w-5 h-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how the application looks and feels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Organization Default Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="use-org-theme" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Use Organization Default Theme
                </Label>
                <p className="text-sm text-muted-foreground">
                  Your organization&apos;s theme is set to: <strong className="capitalize">{orgTheme}</strong>
                </p>
              </div>
              <Switch
                id="use-org-theme"
                checked={useOrgDefault}
                onCheckedChange={setUseOrgDefault}
              />
            </div>
            
            {/* Organization Color Preview */}
            {currentOrganization?.settings?.branding && (
              <div className="p-3 bg-card border rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-2">Organization Colors:</p>
                <div className="flex gap-3">
                  {currentOrganization.settings.branding.primary_color && (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded border-2 border-border"
                        style={{ backgroundColor: currentOrganization.settings.branding.primary_color }}
                      />
                      <span className="text-xs text-muted-foreground">Primary</span>
                    </div>
                  )}
                  {currentOrganization.settings.branding.secondary_color && (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded border-2 border-border"
                        style={{ backgroundColor: currentOrganization.settings.branding.secondary_color }}
                      />
                      <span className="text-xs text-muted-foreground">Secondary</span>
                    </div>
                  )}
                  {currentOrganization.settings.branding.accent_color && (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded border-2 border-border"
                        style={{ backgroundColor: currentOrganization.settings.branding.accent_color }}
                      />
                      <span className="text-xs text-muted-foreground">Accent</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Personal Theme Override */}
          <div className="space-y-2">
            <Label htmlFor="theme" className={useOrgDefault ? 'text-muted-foreground' : ''}>
              Personal Theme {useOrgDefault && '(Override Disabled)'}
            </Label>
            <Select value={theme} onValueChange={setTheme} disabled={useOrgDefault}>
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    Light
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4" />
                    Dark
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    System
                  </div>
                </SelectItem>
                <SelectItem value="theme-slate">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Slate (Professional Dark)
                  </div>
                </SelectItem>
                <SelectItem value="theme-navy">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Navy (Corporate Blue)
                  </div>
                </SelectItem>
                <SelectItem value="theme-emerald">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Emerald (Professional Green)
                  </div>
                </SelectItem>
                <SelectItem value="theme-neutral">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Neutral (Minimal Contrast)
                  </div>
                </SelectItem>
                <SelectItem value="theme-high-contrast">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    High Contrast (Accessibility)
                  </div>
                </SelectItem>
                <SelectItem value="theme-twilight">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Twilight (Purple/Indigo)
                  </div>
                </SelectItem>
                <SelectItem value="theme-crimson">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Crimson (Executive Red)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choose your preferred color scheme
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="compact-mode">Compact Mode</Label>
              <p className="text-sm text-muted-foreground">
                Reduce spacing for a more condensed layout
              </p>
            </div>
            <Switch
              id="compact-mode"
              checked={compactMode}
              onCheckedChange={setCompactMode}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="animations">Animations</Label>
              <p className="text-sm text-muted-foreground">
                Enable smooth transitions and animations
              </p>
            </div>
            <Switch
              id="animations"
              checked={animationsEnabled}
              onCheckedChange={setAnimationsEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Language & Region */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Language & Region
          </CardTitle>
          <CardDescription>
            Set your language, timezone, and regional formats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                <SelectItem value="Europe/London">London (GMT)</SelectItem>
                <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                <SelectItem value="Australia/Sydney">Sydney (AEDT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-format">Date Format</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger id="date-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-format">Time Format</Label>
              <Select value={timeFormat} onValueChange={setTimeFormat}>
                <SelectTrigger id="time-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12 Hour</SelectItem>
                  <SelectItem value="24h">24 Hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Temperature Unit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5" />
            Temperature Unit
          </CardTitle>
          <CardDescription>
            Choose how temperatures are displayed across the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Display Temperature In</Label>
              <p className="text-sm text-muted-foreground">
                {temperatureUnit === 'F' ? 'Fahrenheit (°F)' : 'Celsius (°C)'} — applied everywhere
              </p>
            </div>
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
              <Button
                variant={temperatureUnit === 'C' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTemperatureUnit('C')}
                className="text-xs px-3"
              >
                °C
              </Button>
              <Button
                variant={temperatureUnit === 'F' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTemperatureUnit('F')}
                className="text-xs px-3"
              >
                °F
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Layout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="w-5 h-5" />
            Dashboard Layout
          </CardTitle>
          <CardDescription>
            Configure your default dashboard view
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sound">Sound Effects</Label>
              <p className="text-sm text-muted-foreground">
                Play sounds for notifications and alerts
              </p>
            </div>
            <Switch
              id="sound"
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Control how you receive alert notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notification Channels */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts via email
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sms-notifications">SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts via text message
                </p>
              </div>
              <Switch
                id="sms-notifications"
                checked={smsNotifications}
                onCheckedChange={setSmsNotifications}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive browser push notifications
                </p>
              </div>
              <Switch
                id="push-notifications"
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="min-severity">Minimum Alert Severity</Label>
              <Select value={minSeverity} onValueChange={setMinSeverity}>
                <SelectTrigger id="min-severity">
                  <SelectValue placeholder="Select minimum severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">All Alerts (Low and above)</SelectItem>
                  <SelectItem value="medium">Medium and above</SelectItem>
                  <SelectItem value="high">High and Critical only</SelectItem>
                  <SelectItem value="critical">Critical only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Only notify me for alerts at or above this severity level
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
                  <p className="text-sm text-muted-foreground">
                    Don&apos;t send notifications during specific hours
                  </p>
                </div>
                <Switch
                  id="quiet-hours"
                  checked={quietHoursEnabled}
                  onCheckedChange={setQuietHoursEnabled}
                />
              </div>

              {quietHoursEnabled && (
                <div className="ml-4 space-y-2">
                  <Label>Quiet Hours Schedule</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor="quiet-start" className="text-xs text-muted-foreground">
                        From
                      </Label>
                      <Select value={quietHoursStart} onValueChange={setQuietHoursStart}>
                        <SelectTrigger id="quiet-start">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="22:00">10:00 PM</SelectItem>
                          <SelectItem value="23:00">11:00 PM</SelectItem>
                          <SelectItem value="00:00">12:00 AM</SelectItem>
                          <SelectItem value="01:00">1:00 AM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="quiet-end" className="text-xs text-muted-foreground">
                        Until
                      </Label>
                      <Select value={quietHoursEnd} onValueChange={setQuietHoursEnd}>
                        <SelectTrigger id="quiet-end">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="06:00">6:00 AM</SelectItem>
                          <SelectItem value="07:00">7:00 AM</SelectItem>
                          <SelectItem value="08:00">8:00 AM</SelectItem>
                          <SelectItem value="09:00">9:00 AM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="mute-weekends">Mute on Weekends</Label>
                  <p className="text-sm text-muted-foreground">
                    Don&apos;t send notifications on Saturdays and Sundays
                  </p>
                </div>
                <Switch
                  id="mute-weekends"
                  checked={muteWeekends}
                  onCheckedChange={setMuteWeekends}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSavePreferences} size="lg" disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
