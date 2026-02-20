'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
    filename: 'USER_QUICK_START.txt',
    description:
      'Getting started walkthrough for new platform users — login, dashboard overview, device monitoring, alerts, and common workflows.',
    icon: Rocket,
    category: 'user',
    lines: 411,
    audience: ['Viewers', 'Users'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'admin-guide',
    title: 'Administrator Guide',
    filename: 'ADMINISTRATOR_GUIDE.txt',
    description:
      'Complete admin reference — organization setup, member management, role assignments, integration configuration, alert rule management.',
    icon: ShieldCheck,
    category: 'admin',
    lines: 954,
    audience: ['Org Admins', 'Org Owners'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'api-docs',
    title: 'API Documentation',
    filename: 'API_DOCUMENTATION.txt',
    description:
      'Full REST and Edge Function API reference — authentication, endpoints, request/response schemas, error codes, rate limits.',
    icon: Code2,
    category: 'developer',
    lines: 1354,
    audience: ['Developers', 'Integrators'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'dev-setup',
    title: 'Developer Setup Guide',
    filename: 'DEVELOPER_SETUP_GUIDE.txt',
    description:
      'Local development environment setup — prerequisites, Supabase CLI, Next.js dev server, Edge Functions, VS Code debugging.',
    icon: Monitor,
    category: 'developer',
    lines: 1122,
    audience: ['Developers'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'integrations',
    title: 'Integrations Guide',
    filename: 'INTEGRATIONS_GUIDE.txt',
    description:
      'Setting up and managing integrations — MQTT brokers, webhooks, Golioth, custom endpoints, testing connections.',
    icon: Network,
    category: 'admin',
    lines: 603,
    audience: ['Org Admins', 'Developers'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting Guide',
    filename: 'troubleshooting.txt',
    description:
      'Common issues and solutions — device connectivity, alert failures, integration errors, authentication problems, performance.',
    icon: Wrench,
    category: 'operations',
    lines: 738,
    audience: ['All Roles'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'triage',
    title: 'Triage Checklist',
    filename: 'TRIAGE_CHECKLIST.txt',
    description:
      'Step-by-step triage guide for production incidents — severity classification, diagnostic steps, escalation matrix.',
    icon: AlertTriangle,
    category: 'operations',
    lines: 207,
    audience: ['Org Admins', 'Super Admins'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'monitoring',
    title: 'Monitoring Guide',
    filename: 'MONITORING.txt',
    description:
      'System monitoring and observability — edge function metrics, database health, realtime performance, Sentry integration.',
    icon: Activity,
    category: 'operations',
    lines: 657,
    audience: ['Super Admins', 'DevOps'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'video-tutorials',
    title: 'Video Tutorials Plan',
    filename: 'VIDEO_TUTORIALS_PLAN.txt',
    description:
      'Planned video tutorial series — getting started, device management, integration setup, admin workflows, advanced features.',
    icon: Video,
    category: 'user',
    lines: 854,
    audience: ['All Roles'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'changelog',
    title: 'Changelog',
    filename: 'CHANGELOG.txt',
    description:
      'Release history and version notes — features, bug fixes, breaking changes, migration steps.',
    icon: History,
    category: 'developer',
    lines: 537,
    audience: ['All Roles'],
    lastUpdated: '2026-02-18',
  },
  {
    id: 'mqtt-architecture',
    title: 'MQTT Integration Architecture',
    filename: 'MQTT_ARCHITECTURE.txt',
    description:
      'MQTT integration design — stateless Edge Functions, HTTP ingestion with PGMQ, external broker support, topic structure, security.',
    icon: Network,
    category: 'developer',
    lines: 561,
    audience: ['Developers', 'Integrators', 'Org Admins'],
    lastUpdated: '2026-02-19',
  },
  {
    id: 'azure-iot-architecture',
    title: 'Azure IoT Hub Architecture',
    filename: 'AZURE_IOT_ARCHITECTURE.txt',
    description:
      'Azure IoT Hub integration — Device Registry, Device Twin, telemetry storage options, security, customer configuration guide.',
    icon: Network,
    category: 'developer',
    lines: 131,
    audience: ['Developers', 'Integrators', 'Org Admins'],
    lastUpdated: '2026-02-19',
  },
  {
    id: 'aws-iot-architecture',
    title: 'AWS IoT Core Architecture',
    filename: 'AWS_IOT_ARCHITECTURE.txt',
    description:
      'AWS IoT Core integration — Thing management, Thing Shadows, telemetry options via IoT Analytics, security, IAM permissions.',
    icon: Network,
    category: 'developer',
    lines: 452,
    audience: ['Developers', 'Integrators', 'Org Admins'],
    lastUpdated: '2025-11-13',
  },
  {
    id: 'golioth-architecture',
    title: 'Golioth Integration Architecture',
    filename: 'GOLIOTH_INTEGRATION_ARCHITECTURE.txt',
    description:
      'Golioth IoT Platform integration — Device management, telemetry, OTA updates, webhooks, API key management, security.',
    icon: Network,
    category: 'developer',
    lines: 450,
    audience: ['Developers', 'Integrators', 'Org Admins'],
    lastUpdated: '2025-11-17',
  },
  {
    id: 'secrets-inventory',
    title: 'Secrets Inventory & Management',
    filename: 'SECRETS_INVENTORY.txt',
    description:
      'Complete catalog of all production secrets — GitHub Secrets, rotation schedules, tier classification, access audit trail.',
    icon: ShieldCheck,
    category: 'operations',
    lines: 252,
    audience: ['Super Admins', 'DevOps'],
    lastUpdated: '2026-02-16',
  },
  {
    id: 'secrets-governance',
    title: 'Secrets Governance Policy',
    filename: 'SECRETS_GOVERNANCE.txt',
    description:
      'Security policies for secrets management — 4-tier classification, rotation requirements, access control, incident response.',
    icon: ShieldCheck,
    category: 'operations',
    lines: 108,
    audience: ['Super Admins', 'DevOps', 'Security'],
    lastUpdated: '2026-02-16',
  },
  {
    id: 'sentry-setup',
    title: 'Sentry Setup & Integration',
    filename: 'SENTRY_SETUP_GUIDE.txt',
    description:
      'Error tracking and performance monitoring — Sentry configuration, Supabase integration, alert rules, dashboard setup.',
    icon: Activity,
    category: 'operations',
    lines: 560,
    audience: ['Super Admins', 'DevOps'],
    lastUpdated: '2025-09-15',
  },
  {
    id: 'soc2-compliance',
    title: 'SOC 2 Compliance Checklist',
    filename: 'SOC2_COMPLIANCE_CHECKLIST.txt',
    description:
      'SOC 2 Type II compliance requirements — Trust Service Criteria, controls, evidence, audit preparation, continuous monitoring.',
    icon: ClipboardList,
    category: 'operations',
    lines: 636,
    audience: ['Super Admins', 'Compliance Officers'],
    lastUpdated: '2025-12-15',
  },
]

const CATEGORIES = [
  { id: 'all', label: 'All Docs', count: DOCS.length },
  {
    id: 'user',
    label: 'User Guides',
    count: DOCS.filter((d) => d.category === 'user').length,
  },
  {
    id: 'admin',
    label: 'Admin',
    count: DOCS.filter((d) => d.category === 'admin').length,
  },
  {
    id: 'developer',
    label: 'Developer',
    count: DOCS.filter((d) => d.category === 'developer').length,
  },
  {
    id: 'operations',
    label: 'Operations',
    count: DOCS.filter((d) => d.category === 'operations').length,
  },
]

const categoryColors: Record<string, string> = {
  user: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  admin:
    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  developer:
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  operations:
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

export default function DocumentationTab() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const { fmt } = useDateFormatter()

  const filtered = DOCS.filter((doc) => {
    const matchesCategory =
      selectedCategory === 'all' || doc.category === selectedCategory
    const matchesSearch =
      search === '' ||
      [doc.title, doc.description, doc.filename, ...doc.audience].some((text) =>
        text.toLowerCase().includes(search.toLowerCase())
      )
    return matchesCategory && matchesSearch
  })

  const totalLines = DOCS.reduce((acc, d) => acc + d.lines, 0)

  const handleOpenDoc = (filename: string) => {
    // Link to the documentation file in the GitHub repository
    const repoUrl =
      'https://github.com/NetNeural/MonoRepo-Staging/blob/main/development/docs'
    window.open(`${repoUrl}/${filename}`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Platform Documentation
          </CardTitle>
          <CardDescription>
            {DOCS.length} documents, {totalLines.toLocaleString()} lines of
            documentation covering user guides, admin procedures, API
            references, and operational runbooks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and filter */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documentation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Category filter chips */}
          <div className="mb-6 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted'
                }`}
              >
                {cat.label}
                <span
                  className={`text-[10px] ${
                    selectedCategory === cat.id
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground'
                  }`}
                >
                  ({cat.count})
                </span>
              </button>
            ))}
          </div>

          {/* Doc cards */}
          <div className="grid gap-3">
            {filtered.map((doc) => {
              const Icon = doc.icon
              return (
                <div
                  key={doc.id}
                  className="group rounded-lg border p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex-shrink-0 rounded-lg bg-muted p-2">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-medium">{doc.title}</h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColors[doc.category]}`}
                          >
                            {doc.category}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {doc.description}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => handleOpenDoc(doc.filename)}
                            className="flex cursor-pointer items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                            title="Click to view documentation"
                          >
                            <FileText className="h-3 w-3" />
                            {doc.filename}
                            <ExternalLink className="h-3 w-3" />
                          </button>
                          <span className="text-[10px] text-muted-foreground">
                            {doc.lines} lines
                          </span>
                          <span
                            className="flex items-center gap-1 text-[10px] text-muted-foreground"
                            title={new Date(
                              doc.lastUpdated
                            ).toLocaleDateString()}
                          >
                            <Clock className="h-3 w-3" />
                            Updated {fmt.timeAgo(doc.lastUpdated)}
                          </span>
                          <div className="flex gap-1">
                            {doc.audience.map((a) => (
                              <Badge
                                key={a}
                                variant="outline"
                                className="py-0 text-[10px]"
                              >
                                {a}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0"
                      title={`View ${doc.filename}`}
                      onClick={() => handleOpenDoc(doc.filename)}
                    >
                      <ExternalLink className="mr-1 h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">No documents match your search.</p>
            </div>
          )}

          {/* Doc location info */}
          <div className="mt-6 rounded-lg bg-muted p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
              <ClipboardList className="h-4 w-4" />
              Documentation Location
            </h4>
            <p className="text-xs text-muted-foreground">
              All documentation lives in{' '}
              <code className="rounded bg-background px-1 py-0.5">
                development/docs/
              </code>{' '}
              and is version-controlled alongside the codebase. Updates to
              documentation should be made via pull requests and reviewed before
              merge.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              The changelog is maintained at{' '}
              <code className="rounded bg-background px-1 py-0.5">
                development/CHANGELOG.txt
              </code>{' '}
              following Keep a Changelog format.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
