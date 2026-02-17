'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, TrendingUp, ArrowRight, Shield } from 'lucide-react'

export default function ReportsIndexPage() {
  const router = useRouter()

  const reports = [
    {
      title: 'Alert History Report',
      description: 'View historical alert data with filtering, statistics, and response time analysis',
      icon: FileText,
      href: '/dashboard/reports/alerts',
      features: ['Date range filtering', 'Severity breakdown', 'Response time tracking', 'CSV export'],
    },
    {
      title: 'Telemetry Trends Report',
      description: 'Compare sensor data across multiple devices over time with threshold overlays',
      icon: TrendingUp,
      href: '/dashboard/reports/telemetry',
      features: ['Multi-device comparison', 'Threshold visualization', 'Statistics dashboard', 'Chart & table views'],
    },
    {
      title: 'User Activity Audit Log',
      description: 'Track all user actions in the system for compliance and troubleshooting (Admin only)',
      icon: Shield,
      href: '/dashboard/reports/audit-log',
      features: ['Complete activity tracking', 'Advanced filtering', 'Before/after changes', 'CSV export'],
      adminOnly: true,
    },
  ]

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-2">
          Analyze your IoT data with comprehensive reporting tools
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon
          return (
            <Card key={report.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Icon className="w-10 h-10 text-primary mb-2" />
                  {report.adminOnly && (
                    <Badge variant="secondary" className="ml-auto">
                      <Shield className="w-3 h-3 mr-1" />
                      Admin Only
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {report.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => router.push(report.href)}
                  className="w-full"
                  variant="default"
                >
                  Open Report
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
