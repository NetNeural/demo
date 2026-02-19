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
    <div className={cn("mb-8 pl-6", className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <OrganizationLogo
            settings={currentOrganization?.settings}
            name={currentOrganization?.name || 'NetNeural'}
            size="xl"
            className="mt-1"
          />
          {icon && <div className="flex-shrink-0 mt-1">{icon}</div>}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
            {description && (
              <p className="text-gray-600">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="ml-4">{action}</div>}
      </div>
    </div>
  )
}
