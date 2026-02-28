'use client'

interface EnterpriseCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}

export function EnterpriseCard({
  children,
  className = '',
  hover = true,
  padding = 'lg',
  shadow = 'md',
}: EnterpriseCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  }

  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  }

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white ${shadowClasses[shadow]} ${hover ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl' : ''} ${paddingClasses[padding]} ${className} `}
    >
      {children}
    </div>
  )
}

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: {
    value: string
    isPositive: boolean
  }
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info'
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'primary',
}: StatsCardProps) {
  const colorClasses = {
    primary: {
      bg: 'bg-primary-50',
      text: 'text-primary-600',
      trend: 'text-primary-600',
    },
    success: {
      bg: 'bg-success-50',
      text: 'text-success-600',
      trend: 'text-success-600',
    },
    warning: {
      bg: 'bg-warning-50',
      text: 'text-warning-600',
      trend: 'text-warning-600',
    },
    error: {
      bg: 'bg-error-50',
      text: 'text-error-600',
      trend: 'text-error-600',
    },
    info: {
      bg: 'bg-info-50',
      text: 'text-info-600',
      trend: 'text-info-600',
    },
  }

  return (
    <EnterpriseCard>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="mb-2 text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {trend && (
              <span
                className={`text-sm font-medium ${trend.isPositive ? 'text-success-600' : 'text-error-600'} `}
              >
                {trend.isPositive ? '↗' : '↘'} {trend.value}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {icon && (
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg ${colorClasses[color].bg} ${colorClasses[color].text} `}
          >
            {icon}
          </div>
        )}
      </div>
    </EnterpriseCard>
  )
}

interface StatusCardProps {
  title: string
  status: 'online' | 'offline' | 'warning' | 'error'
  count?: number
  description?: string
  onClick?: () => void
}

export function StatusCard({
  title,
  status,
  count,
  description,
  onClick,
}: StatusCardProps) {
  const statusConfig = {
    online: {
      color: 'text-success-700',
      bg: 'bg-success-50',
      border: 'border-success-200',
      dot: 'bg-success-500',
    },
    offline: {
      color: 'text-gray-700',
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      dot: 'bg-gray-400',
    },
    warning: {
      color: 'text-warning-700',
      bg: 'bg-warning-50',
      border: 'border-warning-200',
      dot: 'bg-warning-500',
    },
    error: {
      color: 'text-error-700',
      bg: 'bg-error-50',
      border: 'border-error-200',
      dot: 'bg-error-500',
    },
  }

  return (
    <div
      className={`relative cursor-pointer rounded-xl border-2 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${statusConfig[status].bg} ${statusConfig[status].border} ${onClick ? 'cursor-pointer' : 'cursor-default'} `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`h-3 w-3 rounded-full ${statusConfig[status].dot} shadow-lg`}
          />
          <h3 className={`text-lg font-semibold ${statusConfig[status].color}`}>
            {title}
          </h3>
        </div>
        {count !== undefined && (
          <span className={`text-2xl font-bold ${statusConfig[status].color} `}>
            {count}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-2 text-sm text-gray-600">{description}</p>
      )}
    </div>
  )
}

interface ActionCardProps {
  title: string
  description: string
  icon: React.ReactNode
  action: {
    label: string
    onClick: () => void
  }
  variant?: 'primary' | 'secondary'
}

export function ActionCard({
  title,
  description,
  icon,
  action,
  variant = 'primary',
}: ActionCardProps) {
  return (
    <EnterpriseCard className="group cursor-pointer" hover>
      <div className="text-center">
        <div
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${
            variant === 'primary'
              ? 'bg-primary-100 text-primary-600 group-hover:bg-primary-200'
              : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
          } transition-colors duration-200`}
        >
          {icon}
        </div>
        <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mb-6 text-sm text-gray-600">{description}</p>
        <button
          onClick={action.onClick}
          className={`rounded-lg px-6 py-2 text-sm font-medium transition-colors ${
            variant === 'primary'
              ? 'bg-primary-600 hover:bg-primary-700 text-white'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          } `}
        >
          {action.label}
        </button>
      </div>
    </EnterpriseCard>
  )
}
