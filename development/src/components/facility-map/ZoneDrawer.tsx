'use client'

/**
 * ZoneDrawer — Modal panel for creating / editing a zone on the map.
 * User picks a name, color, then clicks on the map to add polygon points.
 */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X, Check, Undo2 } from 'lucide-react'

const ZONE_COLORS = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Orange', value: '#f97316' },
]

interface ZoneDrawerProps {
  points: Array<{ x: number; y: number }>
  onCancel: () => void
  onSave: (name: string, color: string, opacity: number, points: Array<{ x: number; y: number }>) => void
  onUndo: () => void
}

export function ZoneDrawer({ points, onCancel, onSave, onUndo }: ZoneDrawerProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(ZONE_COLORS[0]!.value)
  const [opacity, setOpacity] = useState(0.25)

  const handleSave = useCallback(() => {
    if (!name.trim() || points.length < 3) return
    onSave(name.trim(), color, opacity, points)
  }, [name, color, opacity, points, onSave])

  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">New Zone</h4>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-xs">Zone Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Server Room"
            className="h-8 text-xs"
          />
        </div>

        <div>
          <Label className="text-xs">Color</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {ZONE_COLORS.map((c) => (
              <button
                key={c.value}
                className={`h-6 w-6 rounded-full border-2 transition-all ${
                  color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c.value }}
                onClick={() => setColor(c.value)}
                title={c.label}
              />
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs">Opacity: {Math.round(opacity * 100)}%</Label>
          <input
            type="range"
            min="0.1"
            max="0.6"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-full h-1.5 mt-1 accent-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {points.length} point{points.length !== 1 ? 's' : ''} — need at least 3
        </Badge>
        {points.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onUndo}>
            <Undo2 className="mr-1 h-3 w-3" />
            Undo
          </Button>
        )}
      </div>

      {/* Live preview */}
      {points.length >= 2 && (
        <div className="relative h-16 rounded border bg-muted/30 overflow-hidden">
          <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
            <polygon
              points={points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={color}
              fillOpacity={opacity}
              stroke={color}
              strokeWidth="0.5"
            />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="white" stroke={color} strokeWidth="0.3" />
            ))}
          </svg>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={handleSave}
          disabled={!name.trim() || points.length < 3}
        >
          <Check className="mr-1 h-3 w-3" />
          Save Zone
        </Button>
      </div>
    </div>
  )
}
