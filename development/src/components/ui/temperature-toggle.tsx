'use client'

import { Button } from '@/components/ui/button'

interface TemperatureToggleProps {
  useFahrenheit: boolean
  onToggle: (value: boolean) => void
}

export function TemperatureToggle({
  useFahrenheit,
  onToggle,
}: TemperatureToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Temperature:</span>
      <div className="flex rounded-md border">
        <Button
          variant={!useFahrenheit ? 'default' : 'ghost'}
          size="sm"
          className="h-8 rounded-r-none px-3"
          onClick={() => onToggle(false)}
        >
          °C
        </Button>
        <Button
          variant={useFahrenheit ? 'default' : 'ghost'}
          size="sm"
          className="h-8 rounded-l-none px-3"
          onClick={() => onToggle(true)}
        >
          °F
        </Button>
      </div>
    </div>
  )
}
