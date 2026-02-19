'use client'

import { cn } from "@/lib/utils"
import { useOrganization } from '@/contexts/OrganizationContext'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, action, icon, className }: PageHeaderProps) {
  const { currentOrganization } = useOrganization()

  return (
    <div className={cn("", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={currentOrganization?.settings}
            name={currentOrganization?.name || 'NetNeural'}
            size="xl"
          />
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="ml-4">{action}</div>}
      </div>
    </div>
  )
}
