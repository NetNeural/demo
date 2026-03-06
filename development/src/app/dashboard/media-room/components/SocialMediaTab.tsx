'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  RefreshCw,
  Trash2,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Linkedin,
  Twitter,
  Instagram,
  Globe,
  Wand2,
  Calendar,
  BarChart3,
  Eye,
  PenLine,
  Copy,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Hash,
  Loader2,
  MessageSquare,
  Newspaper,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// ─── Types ──────────────────────────────────────────────────────────────────

type PostStatus = 'queued' | 'approved' | 'posted' | 'trashed' | 'draft'
type Platform = 'twitter' | 'linkedin' | 'instagram' | 'all'
type ContentSource = 'knowledge-base' | 'iot-news' | 'product-update' | 'custom'

interface SocialPost {
  id: string
  content: string
  platform: Platform
  status: PostStatus
  source: ContentSource
  sourceLabel: string
  hashtags: string[]
  generatedAt: string
  scheduledFor?: string
  characterCount: number
  imageUrl?: string
}

// ─── Mock AI Content Generator ──────────────────────────────────────────────

const knowledgeBaseStories: Omit<
  SocialPost,
  'id' | 'generatedAt' | 'status' | 'characterCount'
>[] = [
  {
    content:
      '\u{1F680} Did you know? NetNeural Sentinel can monitor up to 10,000 IoT devices simultaneously with sub-second latency. Our edge computing architecture ensures real-time alerts even in low-connectivity environments.',
    platform: 'linkedin',
    source: 'knowledge-base',
    sourceLabel: 'Product Feature',
    hashtags: ['#IoT', '#EdgeComputing', '#NetNeural', '#SmartMonitoring'],
  },
  {
    content:
      '\u{1F321}\uFE0F Cold chain compliance just got easier. With FSMA Section 204 food traceability, our IoT sensors auto-capture temperature KDEs at every Critical Tracking Event \u2014 from farm to table. No manual logging required.',
    platform: 'twitter',
    source: 'knowledge-base',
    sourceLabel: 'FSMA 204 Compliance',
    hashtags: ['#FoodSafety', '#FSMA', '#ColdChain', '#IoT', '#Traceability'],
  },
  {
    content:
      '\u{1F512} Security first: NetNeural Sentinel features RBAC with 5 role tiers, Row-Level Security on every table, MFA enforcement, and NIST 800-53 aligned controls. Your IoT data is protected at every layer.',
    platform: 'linkedin',
    source: 'knowledge-base',
    sourceLabel: 'Security Feature',
    hashtags: ['#CyberSecurity', '#IoTSecurity', '#NIST', '#ZeroTrust'],
  },
  {
    content:
      '\u{1F4CA} AI-powered analytics turn raw sensor data into actionable insights. Anomaly detection, predictive maintenance alerts, and trend analysis \u2014 all built into your dashboard. No data science team needed.',
    platform: 'all',
    source: 'knowledge-base',
    sourceLabel: 'AI Analytics',
    hashtags: ['#AI', '#MachineLearning', '#PredictiveMaintenance', '#IoT'],
  },
  {
    content:
      '\u{1F3ED} From smart factories to precision agriculture \u2014 NetNeural Sentinel manages device fleets across 20+ industry verticals. One platform, every sensor, complete visibility.',
    platform: 'twitter',
    source: 'knowledge-base',
    sourceLabel: 'Platform Overview',
    hashtags: ['#SmartFactory', '#Industry40', '#AgTech', '#IoTPlatform'],
  },
  {
    content:
      '\u{1F4F1} Our mobile-first dashboard gives field technicians full device management from their phone. Scan barcodes, troubleshoot alerts, and update firmware \u2014 all from the palm of your hand.',
    platform: 'instagram',
    source: 'knowledge-base',
    sourceLabel: 'Mobile Experience',
    hashtags: ['#MobileFirst', '#FieldService', '#IoTManagement', '#TechLife'],
  },
  {
    content:
      '\u26A1 Real-time alerting that actually works. Configure custom threshold rules, escalation chains, and multi-channel notifications (email, SMS, Slack, webhook). Never miss a critical event again.',
    platform: 'linkedin',
    source: 'knowledge-base',
    sourceLabel: 'Alerting System',
    hashtags: ['#Monitoring', '#Alerting', '#DevOps', '#IoTPlatform'],
  },
  {
    content:
      '\u{1F30D} Multi-tenant architecture means each customer org gets complete data isolation with Row-Level Security. Resellers can manage hundreds of customer organizations from a single pane of glass.',
    platform: 'linkedin',
    source: 'knowledge-base',
    sourceLabel: 'Architecture',
    hashtags: ['#MultiTenant', '#SaaS', '#DataSecurity', '#IoTPlatform'],
  },
]

const iotNewsStories: Omit<
  SocialPost,
  'id' | 'generatedAt' | 'status' | 'characterCount'
>[] = [
  {
    content:
      "\u{1F4C8} The global IoT market is projected to reach $1.5 trillion by 2030. As connected devices multiply, having a robust device management platform isn't optional \u2014 it's essential. Here's how we're preparing our customers.",
    platform: 'linkedin',
    source: 'iot-news',
    sourceLabel: 'Industry Trend',
    hashtags: ['#IoTMarket', '#DigitalTransformation', '#ConnectedDevices'],
  },
  {
    content:
      '\u26A1 Matter 1.4 protocol update brings improved energy management for smart home devices. As the IoT standard evolves, platforms need to stay adaptive. NetNeural Sentinel already supports multi-protocol device onboarding.',
    platform: 'twitter',
    source: 'iot-news',
    sourceLabel: 'Protocol News',
    hashtags: ['#Matter', '#SmartHome', '#IoTProtocol', '#Interoperability'],
  },
  {
    content:
      "\u{1F30D} Sustainability meets IoT: Smart sensors are reducing energy waste by up to 30% in commercial buildings. Environmental monitoring + automated controls = lower carbon footprint. The data doesn't lie.",
    platform: 'all',
    source: 'iot-news',
    sourceLabel: 'Sustainability',
    hashtags: ['#Sustainability', '#GreenTech', '#SmartBuildings', '#ESG'],
  },
  {
    content:
      '\u{1F916} Edge AI is transforming industrial IoT. Processing data at the sensor level means faster decisions, lower bandwidth costs, and enhanced privacy. The future of IoT is decentralized intelligence.',
    platform: 'linkedin',
    source: 'iot-news',
    sourceLabel: 'Edge AI',
    hashtags: [
      '#EdgeAI',
      '#IndustrialIoT',
      '#IIoT',
      '#ArtificialIntelligence',
    ],
  },
  {
    content:
      '\u{1F50B} New low-power wide-area network (LPWAN) technologies are extending IoT device battery life to 10+ years. This changes the economics of large-scale sensor deployments dramatically.',
    platform: 'twitter',
    source: 'iot-news',
    sourceLabel: 'Hardware Innovation',
    hashtags: ['#LPWAN', '#LoRaWAN', '#BatteryLife', '#SensorNetworks'],
  },
  {
    content:
      '\u{1F6E1}\uFE0F CISA releases new IoT security guidelines for critical infrastructure. Device hardening, network segmentation, and continuous monitoring are now baseline expectations. Is your platform ready?',
    platform: 'all',
    source: 'iot-news',
    sourceLabel: 'Security News',
    hashtags: [
      '#CISA',
      '#IoTSecurity',
      '#CriticalInfrastructure',
      '#CyberResilience',
    ],
  },
  {
    content:
      '\u{1F4F1} 5G SA (Standalone) networks are finally scaling globally. For IoT deployments requiring massive device density and ultra-reliable low latency, this is a game changer.',
    platform: 'linkedin',
    source: 'iot-news',
    sourceLabel: '5G & Connectivity',
    hashtags: ['#5G', '#Connectivity', '#MassiveIoT', '#URLLC'],
  },
  {
    content:
      '\u{1F3E5} Digital twins in healthcare IoT: Real-time patient monitoring, predictive diagnostics, and operational simulation. The convergence of medical devices and cloud analytics is saving lives.',
    platform: 'all',
    source: 'iot-news',
    sourceLabel: 'Healthcare IoT',
    hashtags: [
      '#DigitalTwin',
      '#HealthTech',
      '#MedicalIoT',
      '#PatientSafety',
    ],
  },
  {
    content:
      '\u{1F69C} Precision agriculture IoT adoption grew 25% year over year. Soil moisture sensors, drone monitoring, and automated irrigation are making farming smarter and more sustainable.',
    platform: 'instagram',
    source: 'iot-news',
    sourceLabel: 'AgTech',
    hashtags: [
      '#PrecisionAg',
      '#SmartFarming',
      '#AgTech',
      '#SustainableAgriculture',
    ],
  },
  {
    content:
      '\u{1F3D7}\uFE0F Smart construction sites are using IoT sensors to monitor structural integrity, worker safety, and equipment utilization in real-time. The industry is finally going digital.',
    platform: 'linkedin',
    source: 'iot-news',
    sourceLabel: 'Construction IoT',
    hashtags: ['#ConTech', '#SmartConstruction', '#WorkerSafety', '#IoT'],
  },
]

function generateId(): string {
  return `post-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function createPost(
  template: Omit<
    SocialPost,
    'id' | 'generatedAt' | 'status' | 'characterCount'
  >
): SocialPost {
  return {
    ...template,
    id: generateId(),
    generatedAt: new Date().toISOString(),
    status: 'queued',
    characterCount: template.content.length,
  }
}

function generateDailyQueue(): SocialPost[] {
  const combined = [...knowledgeBaseStories, ...iotNewsStories]
  const shuffled = combined.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 5).map(createPost)
}

function generateSinglePost(source?: ContentSource): SocialPost {
  let pool: typeof knowledgeBaseStories
  if (source === 'knowledge-base') {
    pool = knowledgeBaseStories
  } else if (source === 'iot-news') {
    pool = iotNewsStories
  } else {
    pool = [...knowledgeBaseStories, ...iotNewsStories]
  }
  const template = pool[Math.floor(Math.random() * pool.length)]!
  return createPost(template)
}

// ─── Platform Config ────────────────────────────────────────────────────────

const platformConfig = {
  twitter: {
    label: 'X (Twitter)',
    icon: Twitter,
    color: 'bg-black text-white',
    maxChars: 280,
  },
  linkedin: {
    label: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-700 text-white',
    maxChars: 3000,
  },
  instagram: {
    label: 'Instagram',
    icon: Instagram,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    maxChars: 2200,
  },
  all: {
    label: 'All Platforms',
    icon: Globe,
    color: 'bg-emerald-600 text-white',
    maxChars: 280,
  },
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Post Card Component ────────────────────────────────────────────────────

function PostCard({
  post,
  onApprove,
  onTrash,
  onEdit,
  onPost,
  onRestore,
}: {
  post: SocialPost
  onApprove: (id: string, platforms: Platform[]) => void
  onTrash: (id: string) => void
  onEdit: (id: string, content: string) => void
  onPost: (id: string) => void
  onRestore: (id: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [expanded, setExpanded] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(
    post.platform === 'all'
      ? ['twitter', 'linkedin', 'instagram']
      : [post.platform]
  )

  const pConfig = platformConfig[post.platform]
  const PlatformIcon = pConfig.icon

  const statusBadge = {
    queued: {
      label: 'Queued',
      variant: 'outline' as const,
      color: 'text-amber-600 border-amber-300 bg-amber-50',
    },
    approved: {
      label: 'Approved',
      variant: 'outline' as const,
      color: 'text-blue-600 border-blue-300 bg-blue-50',
    },
    posted: {
      label: 'Posted',
      variant: 'outline' as const,
      color: 'text-green-600 border-green-300 bg-green-50',
    },
    trashed: {
      label: 'Trashed',
      variant: 'outline' as const,
      color: 'text-red-600 border-red-300 bg-red-50',
    },
    draft: {
      label: 'Draft',
      variant: 'outline' as const,
      color: 'text-gray-600 border-gray-300 bg-gray-50',
    },
  }

  const badge = statusBadge[post.status]

  const togglePlatform = (p: Platform) => {
    if (p === 'all') return
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const handleSaveEdit = () => {
    onEdit(post.id, editContent)
    setIsEditing(false)
  }

  const timeSinceGenerated = (() => {
    const diff = Date.now() - new Date(post.generatedAt).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h ago`
  })()

  return (
    <Card
      className={`transition-all ${post.status === 'trashed' ? 'opacity-60' : ''} ${post.status === 'approved' ? 'ring-2 ring-blue-300' : ''}`}
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${pConfig.color}`}
            >
              <PlatformIcon className="h-3 w-3" />
              {pConfig.label}
            </div>
            <Badge variant={badge.variant} className={badge.color}>
              {badge.label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {post.sourceLabel}
            </Badge>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {timeSinceGenerated}
          </span>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
            <div className="flex items-center justify-between">
              <span
                className={`text-xs ${editContent.length > platformConfig[post.platform].maxChars ? 'font-medium text-red-500' : 'text-muted-foreground'}`}
              >
                {editContent.length} /{' '}
                {platformConfig[post.platform].maxChars} characters
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditContent(post.content)
                    setIsEditing(false)
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed">
            {post.content}
          </p>
        )}

        {/* Hashtags */}
        {!isEditing && post.hashtags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {post.hashtags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Platform selector (when approving) */}
        {expanded && post.status !== 'trashed' && post.status !== 'posted' && (
          <div className="mb-3 rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Post to platforms:
            </p>
            <div className="flex flex-wrap gap-2">
              {(['twitter', 'linkedin', 'instagram'] as Platform[]).map(
                (p) => {
                  const cfg = platformConfig[p]
                  const Icon = cfg.icon
                  const selected = selectedPlatforms.includes(p)
                  return (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/30 bg-background text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </button>
                  )
                }
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex gap-1">
              {post.status === 'trashed' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRestore(post.id)}
                  className="text-xs"
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Restore
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                    className="text-xs"
                  >
                    <PenLine className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        post.content + '\n\n' + post.hashtags.join(' ')
                      )
                      toast.success('Copied to clipboard')
                    }}
                    className="text-xs"
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onTrash(post.id)}
                    className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Trash
                  </Button>
                </>
              )}
            </div>

            {post.status !== 'trashed' && post.status !== 'posted' && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs"
                >
                  {expanded ? (
                    <ChevronUp className="mr-1 h-3 w-3" />
                  ) : (
                    <ChevronDown className="mr-1 h-3 w-3" />
                  )}
                  Platforms
                </Button>
                {post.status === 'queued' && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onApprove(post.id, selectedPlatforms)}
                    className="text-xs"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Approve
                  </Button>
                )}
                {post.status === 'approved' && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                    onClick={() => onPost(post.id)}
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Post Now
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Social Media Tab ──────────────────────────────────────────────────

export function SocialMediaTab({
  organizationId,
}: {
  organizationId: string
}) {
  const [posts, setPosts] = useState<SocialPost[]>(() => generateDailyQueue())
  const [isGenerating, setIsGenerating] = useState(false)
  const [filterStatus, setFilterStatus] = useState<PostStatus | 'all'>('all')
  const [filterSource, setFilterSource] = useState<ContentSource | 'all'>('all')
  const [showTrashed, setShowTrashed] = useState(false)

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleApprove = useCallback(
    (id: string, platforms: Platform[]) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: 'approved' as PostStatus,
                platform:
                  platforms.length === 3 ? 'all' : platforms[0] || p.platform,
              }
            : p
        )
      )
      toast.success('Post approved! Ready to publish.')
    },
    []
  )

  const handleTrash = useCallback((id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: 'trashed' as PostStatus } : p
      )
    )
    toast('Post moved to trash', {
      action: {
        label: 'Undo',
        onClick: () => {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === id ? { ...p, status: 'queued' as PostStatus } : p
            )
          )
        },
      },
    })
  }, [])

  const handleRestore = useCallback((id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: 'queued' as PostStatus } : p
      )
    )
    toast.success('Post restored to queue')
  }, [])

  const handleEdit = useCallback((id: string, content: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, content, characterCount: content.length } : p
      )
    )
    toast.success('Post updated')
  }, [])

  const handlePost = useCallback((id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: 'posted' as PostStatus } : p
      )
    )
    toast.success('Post published successfully! \u{1F389}')
  }, [])

  const handleGenerateMore = useCallback(
    async (source?: ContentSource) => {
      setIsGenerating(true)
      // Simulate AI generation delay
      await new Promise((resolve) => setTimeout(resolve, 1200))
      const newPost = generateSinglePost(source)
      setPosts((prev) => [newPost, ...prev])
      setIsGenerating(false)
      toast.success('New story generated!')
    },
    []
  )

  const handleGenerateBatch = useCallback(async () => {
    setIsGenerating(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const newPosts = Array.from({ length: 5 }, () => generateSinglePost())
    setPosts((prev) => [...newPosts, ...prev])
    setIsGenerating(false)
    toast.success('5 new stories generated!')
  }, [])

  const handleApproveAll = useCallback(() => {
    setPosts((prev) =>
      prev.map((p) =>
        p.status === 'queued'
          ? { ...p, status: 'approved' as PostStatus }
          : p
      )
    )
    toast.success('All queued posts approved!')
  }, [])

  const handleTrashAll = useCallback(() => {
    const queuedCount = posts.filter((p) => p.status === 'queued').length
    setPosts((prev) =>
      prev.map((p) =>
        p.status === 'queued'
          ? { ...p, status: 'trashed' as PostStatus }
          : p
      )
    )
    toast(`${queuedCount} posts moved to trash`)
  }, [posts])

  const handleClearTrashed = useCallback(() => {
    setPosts((prev) => prev.filter((p) => p.status !== 'trashed'))
    toast.success('Trash emptied')
  }, [])

  // ─── Computed Values ──────────────────────────────────────────────────────

  const queuedCount = posts.filter((p) => p.status === 'queued').length
  const approvedCount = posts.filter((p) => p.status === 'approved').length
  const postedCount = posts.filter((p) => p.status === 'posted').length
  const trashedCount = posts.filter((p) => p.status === 'trashed').length

  const filteredPosts = posts.filter((p) => {
    if (!showTrashed && p.status === 'trashed') return false
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (filterSource !== 'all' && p.source !== filterSource) return false
    return true
  })

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Queued"
          value={queuedCount}
          icon={Clock}
          color="bg-amber-500"
        />
        <StatCard
          label="Approved"
          value={approvedCount}
          icon={CheckCircle2}
          color="bg-blue-500"
        />
        <StatCard
          label="Posted"
          value={postedCount}
          icon={Send}
          color="bg-emerald-500"
        />
        <StatCard
          label="Trashed"
          value={trashedCount}
          icon={Trash2}
          color="bg-red-500"
        />
      </div>

      {/* Action Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Generate Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => handleGenerateMore()}
                disabled={isGenerating}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate Story
              </Button>
              <Button
                variant="outline"
                onClick={() => handleGenerateMore('knowledge-base')}
                disabled={isGenerating}
                size="sm"
              >
                <Zap className="mr-1 h-3 w-3" />
                From Knowledge Base
              </Button>
              <Button
                variant="outline"
                onClick={() => handleGenerateMore('iot-news')}
                disabled={isGenerating}
                size="sm"
              >
                <Newspaper className="mr-1 h-3 w-3" />
                IoT Daily News
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerateBatch}
                disabled={isGenerating}
                size="sm"
              >
                <Plus className="mr-1 h-3 w-3" />
                Generate 5 More
              </Button>
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center gap-2">
              {queuedCount > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApproveAll}
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Approve All ({queuedCount})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTrashAll}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Trash All
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as PostStatus | 'all')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="trashed">Trashed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterSource}
          onValueChange={(v) => setFilterSource(v as ContentSource | 'all')}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="knowledge-base">Knowledge Base</SelectItem>
            <SelectItem value="iot-news">IoT News</SelectItem>
            <SelectItem value="product-update">Product Updates</SelectItem>
          </SelectContent>
        </Select>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showTrashed}
            onChange={(e) => setShowTrashed(e.target.checked)}
            className="rounded"
          />
          Show trashed ({trashedCount})
        </label>

        {trashedCount > 0 && showTrashed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearTrashed}
            className="text-xs text-red-600"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Empty Trash
          </Button>
        )}
      </div>

      {/* Post Queue */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg font-medium">No posts to show</p>
              <p className="mb-4 text-sm text-muted-foreground">
                {filterStatus !== 'all' || filterSource !== 'all'
                  ? 'Try adjusting your filters or generate new stories.'
                  : 'Generate some stories to get started!'}
              </p>
              <Button
                onClick={() => handleGenerateMore()}
                disabled={isGenerating}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Story
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onApprove={handleApprove}
              onTrash={handleTrash}
              onEdit={handleEdit}
              onPost={handlePost}
              onRestore={handleRestore}
            />
          ))
        )}
      </div>

      {/* Platform Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected Platforms</CardTitle>
          <CardDescription>
            Connect your social media accounts to enable direct posting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['twitter', 'linkedin', 'instagram'] as const).map((p) => {
              const cfg = platformConfig[p]
              const Icon = cfg.icon
              return (
                <div
                  key={p}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{cfg.label}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-600"
                  >
                    Not Connected
                  </Badge>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Platform API integrations will be configured in Settings &rarr;
            Integrations. For now, use the Copy button to manually post approved
            content.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
