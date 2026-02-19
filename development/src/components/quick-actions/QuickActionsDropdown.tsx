'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Zap,
  RefreshCw,
  Download,
  Activity,
  BookOpen,
} from 'lucide-react'
import { toast } from 'sonner'

export function QuickActionsDropdown() {
  const router = useRouter()
  const pathname = usePathname()

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleExport = () => {
    // Emit a custom event that table components can listen to
    const exportEvent = new CustomEvent('export-current-view', {
      detail: { pathname }
    })
    window.dispatchEvent(exportEvent)
    
    // Show a toast if no handler was found
    setTimeout(() => {
      toast.info('Export functionality available on data pages', {
        description: 'Navigate to Devices, Alerts, or other data pages to export'
      })
    }, 100)
  }

  const handleHealthChecks = () => {
    router.push('/dashboard/support?tab=tests')
  }

  const handleDocs = () => {
    router.push('/dashboard/support?tab=documentation')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Zap className="w-4 h-4" />
          Quick Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Page
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export Current View
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleHealthChecks}>
          <Activity className="w-4 h-4 mr-2" />
          Run Health Checks
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleDocs}>
          <BookOpen className="w-4 h-4 mr-2" />
          View Documentation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
