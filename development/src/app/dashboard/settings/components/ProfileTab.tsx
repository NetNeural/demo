'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { User, Send, Phone, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { useAutoSave } from '@/hooks/useAutoSave'
import { AutoSaveIndicator } from '@/components/ui/auto-save-indicator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingsSection } from './shared/SettingsSection'
import { SettingsFormGroup } from './shared/SettingsFormGroup'
import { createClient } from '@/lib/supabase/client'

export function ProfileTab() {
  const { toast } = useToast()
  const [profileName, setProfileName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneNumberSecondary, setPhoneNumberSecondary] = useState('')
  const [phoneSmsEnabled, setPhoneSmsEnabled] = useState(false)
  const [phoneSecondarySmsEnabled, setPhoneSecondarySmsEnabled] =
    useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load profile from Supabase on mount
  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // Load from users table for full_name and phone numbers
      const { data: userRecord } = await supabase
        .from('users')
        .select(
          'full_name, phone_number, phone_number_secondary, phone_sms_enabled, phone_secondary_sms_enabled'
        )
        .eq('id', user.id)
        .single()

      if (userRecord) {
        if (userRecord.full_name) setProfileName(userRecord.full_name)
        if (userRecord.phone_number) setPhoneNumber(userRecord.phone_number)
        if (userRecord.phone_number_secondary)
          setPhoneNumberSecondary(userRecord.phone_number_secondary)
        setPhoneSmsEnabled(userRecord.phone_sms_enabled || false)
        setPhoneSecondarySmsEnabled(
          userRecord.phone_secondary_sms_enabled || false
        )
      }

      // Load other profile fields from user_metadata
      const metadata = user.user_metadata
      if (metadata) {
        if (metadata.job_title) setJobTitle(metadata.job_title)
        if (metadata.department) setDepartment(metadata.department)
      }

      // Email comes from auth
      if (user.email) setEmail(user.email)

      // Mark loaded so auto-save starts watching
      setLoaded(true)
    }

    loadProfile()
  }, [])

  // Data object for auto-save — includes all profile fields except email
  const profileData = useMemo(
    () => ({
      profileName,
      jobTitle,
      department,
      phoneNumber,
      phoneNumberSecondary,
      phoneSmsEnabled,
      phoneSecondarySmsEnabled,
    }),
    [
      profileName,
      jobTitle,
      department,
      phoneNumber,
      phoneNumberSecondary,
      phoneSmsEnabled,
      phoneSecondarySmsEnabled,
    ]
  )

  const saveProfile = useCallback(async (data: typeof profileData) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not logged in')

    // Update full_name and phone numbers in users table
    const { error: userError } = await supabase
      .from('users')
      .update({
        full_name: data.profileName,
        phone_number: data.phoneNumber || null,
        phone_number_secondary: data.phoneNumberSecondary || null,
        phone_sms_enabled: data.phoneSmsEnabled,
        phone_secondary_sms_enabled: data.phoneSecondarySmsEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (userError) throw userError

    // Store other profile fields in user_metadata
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        job_title: data.jobTitle,
        department: data.department,
      },
    })

    if (metadataError) throw metadataError
  }, [])

  const { status: autoSaveStatus } = useAutoSave({
    data: profileData,
    onSave: saveProfile,
    delay: 1200,
    enabled: loaded,
  })

  // Manual email update (requires confirmation flow)
  const handleEmailChange = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in',
          variant: 'destructive',
        })
        return
      }

      if (email === user.email) return

      const { error } = await supabase.auth.updateUser({ email })
      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update email: ' + error.message,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Confirmation sent',
        description: 'Check your new email to confirm the change.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update email: ' + (error as Error).message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <SettingsSection
        icon={<User className="h-5 w-5" />}
        title="Personal Information"
        description="Manage your personal details and contact information"
        actions={<AutoSaveIndicator status={autoSaveStatus} />}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SettingsFormGroup label="Full Name" required>
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Enter your full name"
            />
          </SettingsFormGroup>

          <SettingsFormGroup label="Email Address" required>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@company.com"
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleEmailChange}
                disabled={isLoading}
              >
                <Send className="mr-1 h-3 w-3" />
                Update
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Email changes require confirmation via email.
            </p>
          </SettingsFormGroup>

          <SettingsFormGroup label="Job Title">
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., IoT Engineer, Operations Manager"
            />
          </SettingsFormGroup>

          <SettingsFormGroup label="Department">
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engineering">Engineering</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="management">Management</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </SettingsFormGroup>
        </div>
      </SettingsSection>

      {/* Contact Information */}
      <SettingsSection
        icon={<Phone className="h-5 w-5" />}
        title="Contact Information"
        description="Manage your phone numbers and SMS notification preferences"
        actions={<AutoSaveIndicator status={autoSaveStatus} />}
      >
        <div className="space-y-6">
          {/* Primary Phone Number */}
          <div className="space-y-3">
            <SettingsFormGroup label="Primary Phone Number">
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                E.164 format preferred (e.g., +15551234567)
              </p>
            </SettingsFormGroup>

            <div className="flex items-center space-x-2 pl-1">
              <Checkbox
                id="sms-primary"
                checked={phoneSmsEnabled}
                onCheckedChange={(checked) =>
                  setPhoneSmsEnabled(checked as boolean)
                }
                disabled={!phoneNumber}
              />
              <label
                htmlFor="sms-primary"
                className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Enable SMS notifications for alerts and system messages
              </label>
            </div>
          </div>

          {/* Secondary Phone Number */}
          <div className="space-y-3">
            <SettingsFormGroup label="Secondary Phone Number">
              <div className="flex gap-2">
                <Input
                  type="tel"
                  value={phoneNumberSecondary}
                  onChange={(e) => setPhoneNumberSecondary(e.target.value)}
                  placeholder="+1 (555) 987-6543"
                  className="flex-1"
                />
                {phoneNumberSecondary && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPhoneNumberSecondary('')
                      setPhoneSecondarySmsEnabled(false)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional backup contact number
              </p>
            </SettingsFormGroup>

            {phoneNumberSecondary && (
              <div className="flex items-center space-x-2 pl-1">
                <Checkbox
                  id="sms-secondary"
                  checked={phoneSecondarySmsEnabled}
                  onCheckedChange={(checked) =>
                    setPhoneSecondarySmsEnabled(checked as boolean)
                  }
                />
                <label
                  htmlFor="sms-secondary"
                  className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Enable SMS notifications on secondary number
                </label>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>SMS Notifications:</strong> When enabled, you&apos;ll
              receive critical alerts and system notifications via SMS. Standard
              message and data rates may apply. Your phone numbers are used
              solely for notifications and are never shared.
            </p>
          </div>
        </div>
      </SettingsSection>

      <p className="text-center text-xs text-muted-foreground">
        Changes are saved automatically.
      </p>
    </div>
  )
}
