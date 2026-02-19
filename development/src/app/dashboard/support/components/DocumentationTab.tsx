'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import {
  BookOpen,
  FileText,
  Search,
  ExternalLink,
  Rocket,
  ShieldCheck,
  Code2,
  Monitor,
  Video,
  Wrench,
  AlertTriangle,
  Network,
  Activity,
  ClipboardList,
  History,
  Clock,
} from 'lucide-react'

interface DocEntry {
  id: string
  title: string
  filename: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  category: 'user' | 'admin' | 'developer' | 'operations'
  lines: number
  audience: string[]
  lastUpdated: string
}

const DOCS: DocEntry[] = [
  {
    id: 'quick-start',
    title: 'User Quick Start Guide',
    filename: 'USER_QUICK_START.md',
    description: 'Getting started walkthrough for new platform users — login, dashboard overview, device monitoring, alerts, and common workflows.',
    icon: Rocket,
    category: 'user',
    lines: 411,
    audience: ['Viewers', 'Users'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'admin-guide',
    title: 'Administrator Guide',
    filename: 'ADMINISTRATOR_GUIDE.md',
    description: 'Complete admin reference — organization setup, member management, role assignments, integration configuration, alert rule management.',
    icon: ShieldCheck,
    category: 'admin',
    lines: 954,
    audience: ['Org Admins', 'Org Owners'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'api-docs',
    title: 'API Documentation',
    filename: 'API_DOCUMENTATION.md',
    description: 'Full REST and Edge Function API reference — authentication, endpoints, request/response schemas, error codes, rate limits.',
    icon: Code2,
    category: 'developer',
    lines: 1354,
    audience: ['Developers', 'Integrators'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'dev-setup',
    title: 'Developer Setup Guide',
    filename: 'DEVELOPER_SETUP_GUIDE.md',
    description: 'Local development environment setup — prerequisites, Supabase CLI, Next.js dev server, Edge Functions, VS Code debugging.',
    icon: Monitor,
    category: 'developer',
    lines: 1122,
    audience: ['Developers'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'integrations',
    title: 'Integrations Guide',
    filename: 'INTEGRATIONS_GUIDE.md',
    description: 'Setting up and managing integrations — MQTT brokers, webhooks, Golioth, custom endpoints, testing connections.',
    icon: Network,
    category: 'admin',
    lines: 603,
    audience: ['Org Admins', 'Developers'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting Guide',
    filename: 'troubleshooting.md',
    description: 'Common issues and solutions — device connectivity, alert failures, integration errors, authentication problems, performance.',
    icon: Wrench,
    category: 'operations',
    lines: 738,
    audience: ['All Roles'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'triage',
    title: 'Triage Checklist',
    filename: 'TRIAGE_CHECKLIST.md',
    description: 'Step-by-step triage guide for production incidents — severity classification, diagnostic steps, escalation matrix.',
    icon: AlertTriangle,
    category: 'operations',
    lines: 207,
    audience: ['Org Admins', 'Super Admins'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'monitoring',
    title: 'Monitoring Guide',
    filename: 'MONITORING.md',
    description: 'System monitoring and observability — edge function metrics, database health, realtime performance, Sentry integration.',
    icon: Activity,
    category: 'operations',
    lines: 657,
    audience: ['Super Admins', 'DevOps'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'video-tutorials',
    title: 'Video Tutorials Plan',
    filename: 'VIDEO_TUTORIALS_PLAN.md',
    description: 'Planned video tutorial series — getting started, device management, integration setup, admin workflows, advanced features.',
    icon: Video,
    category: 'user',
    lines: 854,
    audience: ['All Roles'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'changelog',
    title: 'Changelog',
    filename: 'CHANGELOG.md',
    description: 'Release history and version notes — features, bug fixes, breaking changes, migration steps.',
    icon: History,
    category: 'developer',
    lines: 537,
    audience: ['All Roles'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'mqtt-architecture',
    title: 'MQTT Integration Architecture',
    filename: 'MQTT_ARCHITECTURE.md',
    description: 'MQTT integration design — stateless Edge Functions, HTTP ingestion with PGMQ, external broker support, topic structure, security.',
    icon: Network,
    category: 'developer',
    lines: 561,
    audience: ['Developers', 'Integrators', 'Org Admins'],
    lastUpdated: '2026-02-19',
  },
  {
    id: 'azure-iot-architecture',
    title: 'Azure IoT Hub Architecture',
    filename: 'AZURE_IOT_ARCHITECTURE.md',
    description: 'Azure IoT Hub integration — Device Registry, Device Twin, telemetry storage options, security, customer configuration guide.',
    icon: Network,
    category: 'developer',
    lines: 131,
    audience: ['Developers', 'Integrators', 'Org Admins'],
    lastUpdated: '2026-02-19',
  },
  {
    id: 'aws-iot-architecture',
    title: 'AWS IoT Core Architecture',
    filename: 'AWS_IOT_ARCHITECTURE.md',
    description: 'AWS IoT Core integration — Thing management, Thing Shadows, telemetry options via IoT Analytics, security, IAM permissions.',
    icon: Network,
    category: 'developer',
    lines: 452,
    audience: ['Developers', 'Integrators', 'Org Admins'],
    lastUpdated: '2025-11-13',
  },
  {
    id: 'golioth-architecture',
    title: 'Golioth Integration Architecture',
    filename: 'GOLIOTH_INTEGRATION_ARCHITECTURE.md',
    description: 'Golioth IoT Platform integration — Device management, telemetry, OTA updates, webhooks, API key management, security.',
    icon: Network,
    category: 'developer',
    lines: 450,
    audience: ['Developers', 'Integrators', 'Org Admins'],
    lastUpdated: '2025-11-17',
  },
  {
    id: 'secrets-inventory',
    title: 'Secrets Inventory & Management',
    filename: 'SECRETS_INVENTORY.md',
    description: 'Complete catalog of all production secrets — GitHub Secrets, rotation schedules, tier classification, access audit trail.',
    icon: ShieldCheck,
    category: 'operations',
    lines: 252,
    audience: ['Super Admins', 'DevOps'],
    lastUpdated: '2026-02-16',
  },
  {
    id: 'secrets-governance',
    title: 'Secrets Governance Policy',
    filename: 'SECRETS_GOVERNANCE.md',
    description: 'Security policies for secrets management — 4-tier classification, rotation requirements, access control, incident response.',
    icon: ShieldCheck,
    category: 'operations',
    lines: 108,
    audience: ['Super Admins', 'DevOps', 'Security'],
    lastUpdated: '2026-02-16',
  },
  {
    id: 'sentry-setup',
    title: 'Sentry Setup & Integration',
    filename: 'SENTRY_SETUP_GUIDE.md',
    description: 'Error tracking and performance monitoring — Sentry configuration, Supabase integration, alert rules, dashboard setup.',
    icon: Activity,
    category: 'operations',
    lines: 560,
    audience: ['Super Admins', 'DevOps'],
    lastUpdated: '2025-09-15',
  },
  {
    id: 'soc2-compliance',
    title: 'SOC 2 Compliance Checklist',
    filename: 'SOC2_COMPLIANCE_CHECKLIST.md',
    description: 'SOC 2 Type II compliance requirements — Trust Service Criteria, controls, evidence, audit preparation, continuous monitoring.',
    icon: ClipboardList,
    category: 'operations',
    lines: 636,
    audience: ['Super Admins', 'Compliance Officers'],
    lastUpdated: '2025-12-15',
  },
]

const CATEGORIES = [
  { id: 'all', label: 'All Docs', count: DOCS.length },
  { id: 'user', label: 'User Guides', count: DOCS.filter(d => d.category === 'user').length },
  { id: 'admin', label: 'Admin', count: DOCS.filter(d => d.category === 'admin').length },
  { id: 'developer', label: 'Developer', count: DOCS.filter(d => d.category === 'developer').length },
  { id: 'operations', label: 'Operations', count: DOCS.filter(d => d.category === 'operations').length },
]

const categoryColors: Record<string, string> = {
  user: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  developer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  operations: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

export default function DocumentationTab() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const { fmt } = useDateFormatter()

  const filtered = DOCS.filter(doc => {
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory
    const matchesSearch = search === '' || [
      doc.title,
      doc.description,
      doc.filename,
      ...doc.audience,
    ].some(text => text.toLowerCase().includes(search.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const totalLines = DOCS.reduce((acc, d) => acc + d.lines, 0)

  const handleOpenDoc = (filename: string) => {
    // Link to the documentation file in the GitHub repository
    const repoUrl = 'https://github.com/NetNeural/MonoRepo-Staging/blob/main/development/docs'
    window.open(`${repoUrl}/${filename}`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Platform Documentation
          </CardTitle>
          <CardDescription>
            {DOCS.length} documents, {totalLines.toLocaleString()} lines of documentation covering user guides, admin procedures, API references, and operational runbooks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search documentation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                }`}
              >
                {cat.label}
                <span className={`text-[10px] ${
                  selectedCategory === cat.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                }`}>
                  ({cat.count})
                </span>
              </button>
            ))}
          </div>

          {/* Doc cards */}
          <div className="grid gap-3">
            {filtered.map(doc => {
              const Icon = doc.icon
              return (
                <div
                  key={doc.id}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm">{doc.title}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${categoryColors[doc.category]}`}>
                            {doc.category}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {doc.filename}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {doc.lines} lines
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1" title={new Date(doc.lastUpdated).toLocaleDateString()}>
                            <Clock className="w-3 h-3" />
                            Updated {fmt.timeAgo(doc.lastUpdated)}
                          </span>
                          <div className="flex gap-1">
                            {doc.audience.map(a => (
                              <Badge key={a} variant="outline" className="text-[10px] py-0">
                                {a}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      title={`View ${doc.filename}`}
                      onClick={() => handleOpenDoc(doc.filename)}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No documents match your search.</p>
            </div>
          )}

          {/* Doc location info */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Documentation Location
            </h4>
            <p className="text-xs text-muted-foreground">
              All documentation lives in <code className="bg-background px-1 py-0.5 rounded">development/docs/</code> and is version-controlled alongside the codebase.
              Updates to documentation should be made via pull requests and reviewed before merge.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              The changelog is maintained at <code className="bg-background px-1 py-0.5 rounded">development/CHANGELOG.md</code> following Keep a Changelog format.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
