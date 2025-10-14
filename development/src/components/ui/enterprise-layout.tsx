'use client'

import { Button } from '@/components/ui/button'

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: {
    name: string
    href?: string
    current?: boolean
  }[]
  actions?: React.ReactNode
  stats?: {
    label: string
    value: string | number
    trend?: {
      value: string
      isPositive: boolean
    }
  }[]
}

export function PageHeader({ 
  title, 
  subtitle, 
  breadcrumbs, 
  actions,
  stats 
}: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              {breadcrumbs.map((item, index) => (
                <li key={item.name} className="flex items-center">
                  {index > 0 && (
                    <span className="text-gray-400 mx-2">/</span>
                  )}
                  {item.href && !item.current ? (
                    <a 
                      href={item.href}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {item.name}
                    </a>
                  ) : (
                    <span className={`text-sm ${
                      item.current ? 'text-gray-900 font-medium' : 'text-gray-500'
                    }`}>
                      {item.name}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Header content */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-base text-gray-600">{subtitle}</p>
            )}
          </div>
          
          {actions && (
            <div className="flex flex-col sm:flex-row gap-3">
              {actions}
            </div>
          )}
        </div>

        {/* Stats row */}
        {stats && stats.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <div className="flex items-baseline space-x-2 mt-1">
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                  {stat.trend && (
                    <span className={`
                      text-sm font-medium
                      ${stat.trend.isPositive ? 'text-success-600' : 'text-error-600'}
                    `}>
                      {stat.trend.isPositive ? '↗' : '↘'} {stat.trend.value}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action, 
  secondaryAction 
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">{description}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {action && (
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button onClick={secondaryAction.onClick} variant="outline">
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  )
}

interface DataTableHeaderProps {
  title: string
  subtitle?: string
  searchPlaceholder?: string
  onSearch?: (query: string) => void
  filters?: React.ReactNode
  actions?: React.ReactNode
}

export function DataTableHeader({ 
  title, 
  subtitle, 
  searchPlaceholder = "Search...",
  onSearch,
  filters,
  actions
}: DataTableHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="mt-3 sm:mt-0 flex space-x-3">
            {actions}
          </div>
        )}
      </div>

      {(onSearch || filters) && (
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          {onSearch && (
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder={searchPlaceholder}
                onChange={(e) => onSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}
          {filters && (
            <div className="flex space-x-3">
              {filters}
            </div>
          )}
        </div>
      )}
    </div>
  )
}