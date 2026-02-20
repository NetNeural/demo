'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
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
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'

export function QuickActionsDropdown() {
  const router = useRouter()
  const pathname = usePathname()
  const { currentOrganization } = useOrganization()
  const supabase = createClient()
  const [runningHealthChecks, setRunningHealthChecks] = useState(false)

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

  const handleHealthChecks = async () => {
    if (runningHealthChecks) return
    
    setRunningHealthChecks(true)
    const toastId = toast.loading('Running health checks...', {
      description: 'Testing API, database, and authentication'
    })
    
    try {
      let passed = 0
      let failed = 0
      const results: string[] = []
      
      // Check 1: Supabase API Health
      try {
        const { data, error } = await supabase.from('organizations').select('id').limit(1)
        if (!error) {
          passed++
          results.push('✅ Supabase API')
        } else {
          failed++
          results.push('❌ Supabase API')
        }
      } catch {
        failed++
        results.push('❌ Supabase API')
      }
      
      // Check 2: Auth Status
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!error && data.session) {
          passed++
          results.push('✅ Authentication')
        } else {
          failed++
          results.push('❌ Authentication')
        }
      } catch {
        failed++
        results.push('❌ Authentication')
      }
      
      // Check 3: Database Read
      if (currentOrganization?.id) {
        try {
          const { count, error } = await supabase
            .from('devices')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', currentOrganization.id)
          if (!error) {
            passed++
            results.push(`✅ Database (${count ?? 0} devices)`)
          } else {
            failed++
            results.push('❌ Database')
          }
        } catch {
          failed++
          results.push('❌ Database')
        }
      }
      
      // Show results
      toast.dismiss(toastId)
      if (failed === 0) {
        toast.success(`Health checks passed (${passed}/${passed})`, {
          description: results.join(' • ')
        })
      } else {
        toast.warning(`Health checks: ${passed} passed, ${failed} failed`, {
          description: results.join(' • ')
        })
      }
    } catch (error) {
      toast.dismiss(toastId)
      toast.error('Health checks failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setRunningHealthChecks(false)
    }
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
        
        <DropdownMenuItem onClick={handleHealthChecks} disabled={runningHealthChecks}>
          {runningHealthChecks ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Activity className="w-4 h-4 mr-2" />
          )}
          {runningHealthChecks ? 'Running...' : 'Run Health Checks'}
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleDocs}>
          <BookOpen className="w-4 h-4 mr-2" />
          View Documentation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
