'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { toast } from 'sonner'
import { ArrowRight, ArrowLeft, Check } from 'lucide-react'
import type {
  AlertRule,
  CreateAlertRuleInput,
  AlertRuleCondition,
  AlertRuleDeviceScope,
  AlertRuleAction,
} from '@/lib/edge-functions/api/alert-rules'
import { RuleTypeStep } from './RuleTypeStep'
import { TelemetryRuleStep } from './TelemetryRuleStep'
import { OfflineRuleStep } from './OfflineRuleStep'
import { DeviceScopeStep } from './DeviceScopeStep'
import { ActionsStep } from './ActionsStep'
import { ReviewStep } from './ReviewStep'

interface RuleWizardProps {
  organizationId: string
  initialData?: AlertRule
  onSuccess: () => void
  onCancel: () => void
}

interface WizardState {
  name: string
  description: string
  ruleType: 'telemetry' | 'offline' | null
  condition: AlertRuleCondition
  deviceScope: AlertRuleDeviceScope
  actions: AlertRuleAction[]
  enabled: boolean
  cooldownMinutes: number
}

export function RuleWizard({
  organizationId,
  initialData,
  onSuccess,
  onCancel,
}: RuleWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [state, setState] = useState<WizardState>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    ruleType: initialData?.rule_type || null,
    condition: initialData?.condition || {},
    deviceScope: initialData?.device_scope || { type: 'all' },
    actions: initialData?.actions || [],
    enabled: initialData?.enabled ?? true,
    cooldownMinutes: initialData?.cooldown_minutes || 60,
  })

  const steps = [
    { id: 'type', title: 'Rule Type', description: 'Choose what to monitor' },
    {
      id: 'condition',
      title:
        state.ruleType === 'telemetry'
          ? 'Telemetry Conditions'
          : 'Offline Detection',
      description: 'Define when to trigger',
    },
    {
      id: 'scope',
      title: 'Device Scope',
      description: 'Select devices to monitor',
    },
    { id: 'actions', title: 'Actions', description: 'Configure notifications' },
    { id: 'review', title: 'Review', description: 'Verify and create' },
  ]

  const progress = ((currentStep + 1) / steps.length) * 100

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (!state.ruleType) {
      toast.error('Please select a rule type')
      return
    }

    if (state.actions.length === 0) {
      toast.error('Please configure at least one action')
      return
    }

    try {
      setIsSubmitting(true)

      const input: CreateAlertRuleInput = {
        organization_id: organizationId,
        name: state.name,
        description: state.description,
        rule_type: state.ruleType,
        condition: state.condition,
        device_scope: state.deviceScope,
        actions: state.actions,
        enabled: state.enabled,
        cooldown_minutes: state.cooldownMinutes,
      }

      let response
      if (initialData) {
        response = await edgeFunctions.alertRules.update(initialData.id, input)
      } else {
        response = await edgeFunctions.alertRules.create(input)
      }

      if (response.success) {
        toast.success(
          `Rule ${initialData ? 'updated' : 'created'} successfully`
        )
        onSuccess()
      } else {
        toast.error(`Failed to ${initialData ? 'update' : 'create'} rule`)
      }
    } catch (error) {
      console.error('Error saving rule:', error)
      toast.error(`Failed to ${initialData ? 'update' : 'create'} rule`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return state.ruleType !== null && state.name.trim().length > 0
      case 1:
        if (state.ruleType === 'telemetry') {
          return (
            state.condition.metric &&
            state.condition.operator &&
            state.condition.value !== undefined
          )
        } else {
          return state.condition.offline_minutes !== undefined
        }
      case 2:
        return (
          state.deviceScope.type === 'all' ||
          (state.deviceScope.values && state.deviceScope.values.length > 0)
        )
      case 3:
        return state.actions.length > 0
      case 4:
        return true
      default:
        return false
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <Progress value={progress} className="h-2" />
        <div className="mt-4 flex justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex-1 text-center ${
                index === currentStep
                  ? 'font-semibold text-primary'
                  : index < currentStep
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/50'
              }`}
            >
              <div className="text-sm">{step.title}</div>
              <div className="mt-1 text-xs">{step.description}</div>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {currentStep === 0 && (
            <RuleTypeStep state={state} updateState={updateState} />
          )}
          {currentStep === 1 && state.ruleType === 'telemetry' && (
            <TelemetryRuleStep state={state} updateState={updateState} />
          )}
          {currentStep === 1 && state.ruleType === 'offline' && (
            <OfflineRuleStep state={state} updateState={updateState} />
          )}
          {currentStep === 2 && (
            <DeviceScopeStep
              organizationId={organizationId}
              state={state}
              updateState={updateState}
            />
          )}
          {currentStep === 3 && (
            <ActionsStep state={state} updateState={updateState} />
          )}
          {currentStep === 4 && <ReviewStep state={state} />}

          <div className="mt-8 flex justify-between">
            <div className="space-x-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              {currentStep > 0 && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              )}
            </div>

            <div>
              {currentStep < steps.length - 1 ? (
                <Button onClick={handleNext} disabled={!canProceed()}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || isSubmitting}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {isSubmitting
                    ? 'Saving...'
                    : initialData
                      ? 'Update Rule'
                      : 'Create Rule'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
