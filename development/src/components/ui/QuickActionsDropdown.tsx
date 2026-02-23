import { Button } from '@/components/ui/button'
import { Menu, ChevronDown, Zap, Settings, LogOut } from 'lucide-react'
import { useState } from 'react'

export function QuickActionsDropdown() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Quick Actions"
      >
        <Menu className="h-4 w-4" />
        Quick Actions
        <ChevronDown className="h-3 w-3" />
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border bg-background shadow-lg">
          <ul className="py-2">
            <li>
              <Button
                variant="ghost"
                size="sm"
                className="flex w-full justify-start gap-2"
              >
                <Zap className="h-4 w-4 text-yellow-500" />
                Run Diagnostics
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                size="sm"
                className="flex w-full justify-start gap-2"
              >
                <Settings className="h-4 w-4 text-blue-500" />
                Settings
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                size="sm"
                className="flex w-full justify-start gap-2"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                Log Out
              </Button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
