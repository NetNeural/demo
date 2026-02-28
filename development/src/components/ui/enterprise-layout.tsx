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
  stats,
}: PageHeaderProps) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-4 flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              {breadcrumbs.map((item, index) => (
                <li key={item.name} className="flex items-center">
                  {index > 0 && <span className="mx-2 text-gray-400">/</span>}
                  {item.href && !item.current ? (
                    <a
                      href={item.href}
                      className="text-sm text-gray-500 transition-colors hover:text-gray-700"
                    >
                      {item.name}
                    </a>
                  ) : (
                    <span
                      className={`text-sm ${
                        item.current
                          ? 'font-medium text-gray-900'
                          : 'text-gray-500'
                      }`}
                    >
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
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-base text-gray-600">{subtitle}</p>
            )}
          </div>

          {actions && (
            <div className="flex flex-col gap-3 sm:flex-row">{actions}</div>
          )}
        </div>

        {/* Stats row */}
        {stats && stats.length > 0 && (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={index} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-600">
                  {stat.label}
                </p>
                <div className="mt-1 flex items-baseline space-x-2">
                  <p className="text-xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  {stat.trend && (
                    <span
                      className={`text-sm font-medium ${stat.trend.isPositive ? 'text-success-600' : 'text-error-600'} `}
                    >
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
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 h-16 w-16 text-gray-400">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mx-auto mb-6 max-w-md text-sm text-gray-600">
        {description}
      </p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        {action && <Button onClick={action.onClick}>{action.label}</Button>}
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
  searchPlaceholder = 'Search...',
  onSearch,
  filters,
  actions,
}: DataTableHeaderProps) {
  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>
        {actions && (
          <div className="mt-3 flex space-x-3 sm:mt-0">{actions}</div>
        )}
      </div>

      {(onSearch || filters) && (
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
          {onSearch && (
            <div className="max-w-md flex-1">
              <input
                type="text"
                placeholder={searchPlaceholder}
                onChange={(e) => onSearch(e.target.value)}
                className="focus:ring-primary-500 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2"
              />
            </div>
          )}
          {filters && <div className="flex space-x-3">{filters}</div>}
        </div>
      )}
    </div>
  )
}
