'use client'

export function AlertsHeader() {
  return (
    <div className="flex items-center justify-between space-y-2">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Alert Management</h2>
        <p className="text-muted-foreground">
          Monitor and respond to active alerts from your organization
        </p>
      </div>
    </div>
  )
}