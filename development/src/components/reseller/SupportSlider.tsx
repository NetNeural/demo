'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HeadphonesIcon, Users, ShieldCheck, Info } from 'lucide-react'
import type { SupportModel } from '@/types/reseller'
import { cn } from '@/lib/utils'

interface SupportOption {
  value:       SupportModel
  label:       string
  description: string
  fee_pct:     number
  icon:        React.ReactNode
  color:       string
}

const SUPPORT_OPTIONS: SupportOption[] = [
  {
    value:       'self',
    label:       'Full Self-Support',
    description: 'You handle all Tier 1–3 support tickets for your customers.',
    fee_pct:     0,
    icon:        <Users className="h-5 w-5" />,
    color:       'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  },
  {
    value:       'hybrid',
    label:       'Hybrid Support',
    description: 'You handle Tier 1; NetNeural handles Tier 2–3 escalations.',
    fee_pct:     0.05,
    icon:        <HeadphonesIcon className="h-5 w-5" />,
    color:       'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  },
  {
    value:       'netneural',
    label:       'Full NetNeural Support',
    description: 'NetNeural handles all support; fee deducted from your margin.',
    fee_pct:     0.10,
    icon:        <ShieldCheck className="h-5 w-5" />,
    color:       'text-violet-400 border-violet-500/30 bg-violet-500/10',
  },
]

interface SupportSliderProps {
  orgId:           string
  currentModel:    SupportModel
  currentMargin:   number           // e.g. 0.20 = 20%
  activeSensors:   number
  pricePerSensor:  number           // monthly subscription price per sensor
  nextBillingDate: string
  onChanged?:      (model: SupportModel) => void
  readOnly?:       boolean
}

export function SupportSlider({
  orgId,
  currentModel,
  currentMargin,
  activeSensors,
  pricePerSensor,
  nextBillingDate,
  onChanged,
  readOnly = false,
}: SupportSliderProps) {
  const [selected, setSelected]     = useState<SupportModel>(currentModel)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving]         = useState(false)

  const pendingOption = SUPPORT_OPTIONS.find(o => o.value === selected)!
  const currentOption = SUPPORT_OPTIONS.find(o => o.value === currentModel)!

  const netMargin      = currentMargin - pendingOption.fee_pct
  const monthlyCost    = pendingOption.fee_pct * pricePerSensor * activeSensors
  const hasChanged     = selected !== currentModel

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('organizations').update({
        support_model:   selected,
        support_fee_pct: pendingOption.fee_pct,
      }).eq('id', orgId)

      onChanged?.(selected)
      setConfirming(false)
    } catch (err) {
      console.error('Failed to update support model:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-white/[0.08] bg-gray-900/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Support Model</h3>
          <div className="flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1">
            <Info className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs text-gray-400">Takes effect on next billing cycle</span>
          </div>
        </div>

        <div className="space-y-2.5">
          {SUPPORT_OPTIONS.map(option => (
            <button
              key={option.value}
              disabled={readOnly}
              onClick={() => !readOnly && setSelected(option.value)}
              className={cn(
                'w-full rounded-lg border p-4 text-left transition-all',
                selected === option.value
                  ? `${option.color} ring-1 ring-inset ring-current/30`
                  : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]',
                readOnly && 'cursor-default'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={cn('mt-0.5', selected === option.value ? option.color.split(' ')[0] : 'text-gray-500')}>
                    {option.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-200">{option.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{option.description}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {option.fee_pct === 0 ? (
                    <Badge className="bg-emerald-500/15 text-emerald-400">Free</Badge>
                  ) : (
                    <Badge className="bg-gray-700 text-gray-300">
                      -{(option.fee_pct * 100).toFixed(0)}% fee
                    </Badge>
                  )}
                </div>
              </div>

              {selected === option.value && (
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-md bg-black/20 p-3 text-xs">
                  <div>
                    <p className="text-gray-500">Your Discount</p>
                    <p className="font-semibold text-gray-200">{(currentMargin * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Support Fee</p>
                    <p className="font-semibold text-gray-200">
                      -{(option.fee_pct * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Net Margin</p>
                    <p className={cn('font-bold', netMargin >= 0.10 ? 'text-emerald-400' : 'text-amber-400')}>
                      {(netMargin * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Monthly Fee Cost</p>
                    <p className="font-semibold text-gray-200">
                      ${monthlyCost.toFixed(2)}/mo
                    </p>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {!readOnly && hasChanged && (
          <Button
            className="mt-4 w-full bg-cyan-600 hover:bg-cyan-500"
            onClick={() => setConfirming(true)}
          >
            Update Support Model
          </Button>
        )}
      </div>

      {/* Confirmation dialog */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="border-white/[0.08] bg-gray-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Support Model</DialogTitle>
            <DialogDescription className="text-gray-400">
              Changing from{' '}
              <strong className="text-gray-200">{currentOption.label}</strong> to{' '}
              <strong className="text-gray-200">{pendingOption.label}</strong>.
              This will take effect on{' '}
              <strong className="text-gray-200">{new Date(nextBillingDate).toLocaleDateString()}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-white/[0.04] p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">New support fee:</span>
              <span className="font-semibold">
                {pendingOption.fee_pct === 0 ? 'None' : `${(pendingOption.fee_pct * 100).toFixed(0)}%`}
              </span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-gray-400">Est. monthly cost:</span>
              <span className="font-semibold">${monthlyCost.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-gray-400">Net margin after fee:</span>
              <span className={cn('font-bold', netMargin >= 0.10 ? 'text-emerald-400' : 'text-amber-400')}>
                {(netMargin * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-500" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Confirm Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
