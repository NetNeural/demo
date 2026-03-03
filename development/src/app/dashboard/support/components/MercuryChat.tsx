'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Bot,
  Send,
  Ticket,
  Clock,
  LogIn,
  LogOut,
  User,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────

interface ChatMessage {
  id?: string
  sender_type: 'user' | 'mercury' | 'admin' | 'system'
  content: string
  created_at?: string
}

interface DutyStatus {
  duty_admins_online: number
  active_session: { id: string; status: string } | null
  open_ticket_count: number
  is_super_admin: boolean
  user_name: string
}

interface Ticket {
  id: string
  subject: string
  status: string
  priority: string
  created_at: string
}

// ─── Mercury welcome message ──────────────────────────────────────

const WELCOME_MSG: ChatMessage = {
  sender_type: 'mercury',
  content:
    "Hi, I'm Mercury — NetNeural's AI support assistant. I can help with devices, alerts, integrations, billing, the Hydra reseller program, and more. What can I help you with today?",
}

// ─── Helpers ──────────────────────────────────────────────────────

function invoke(supabase: ReturnType<typeof createClient>, action: string, extra: Record<string, unknown> = {}) {
  return supabase.functions.invoke('mercury-chat', { body: { action, ...extra } })
}

// ─── Component ────────────────────────────────────────────────────

interface MercuryChatProps {
  organizationId: string
}

export default function MercuryChat({ organizationId }: MercuryChatProps) {
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [status, setStatus] = useState<DutyStatus | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [showTickets, setShowTickets] = useState(false)

  // Ticket creation dialog
  const [showTicketDialog, setShowTicketDialog] = useState(false)
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketDescription, setTicketDescription] = useState('')
  const [ticketPriority, setTicketPriority] = useState('normal')
  const [submittingTicket, setSubmittingTicket] = useState(false)

  // Admin duty state
  const [clockingIn, setClockingIn] = useState(false)
  const [clockingOut, setClockingOut] = useState(false)
  const [onDuty, setOnDuty] = useState(false)

  // ─── Auto-scroll ──────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ─── Load status on mount ─────────────────────────────────────

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const { data: raw } = await invoke(supabase, 'get_status')
      const data = raw?.data as DutyStatus | null
      if (data) {
        setStatus(data)
        // Restore active session
        if (data.active_session?.id) {
          setSessionId(data.active_session.id)
          // Load existing messages
          const { data: msgRaw } = await invoke(supabase, 'get_messages', {
            sessionId: data.active_session.id,
          })
          const msgs: ChatMessage[] = msgRaw?.data?.messages || []
          setMessages(msgs.length > 0 ? msgs : [WELCOME_MSG])
        }
      }
    } catch (e) {
      console.error('[MercuryChat] loadStatus error', e)
    } finally {
      setLoadingStatus(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadStatus() }, [loadStatus])

  // ─── Send message ─────────────────────────────────────────────

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')

    // Add user message (clear welcome-only state on first chat)
    const userMsg: ChatMessage = { sender_type: 'user', content: text }
    const typingMsg: ChatMessage = { sender_type: 'mercury', content: '…', id: '__typing__' }
    setMessages((prev) => {
      const base =
        prev.length === 1 && prev[0] === WELCOME_MSG ? [] : prev
      return [...base, userMsg, typingMsg]
    })

    try {
      const { data: raw, error } = await invoke(supabase, 'chat', {
        message: text,
        sessionId,
      })

      if (error || !raw?.data) {
        setMessages((prev) => prev.filter((m) => m.id !== '__typing__'))
        toast.error('Mercury is unavailable. Please try again.')
        return
      }

      const { session_id: newSessionId, mercury_message } = raw.data as {
        session_id: string
        mercury_message: ChatMessage
      }

      if (newSessionId && !sessionId) setSessionId(newSessionId)

      setMessages((prev) =>
        prev
          .filter((m) => m.id !== '__typing__')
          .concat(mercury_message)
      )
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== '__typing__'))
      toast.error('Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ─── Create ticket ─────────────────────────────────────────────

  const handleCreateTicket = async () => {
    if (!ticketSubject.trim() || !ticketDescription.trim()) {
      toast.error('Please fill in subject and description.')
      return
    }
    setSubmittingTicket(true)
    try {
      const { data: raw } = await invoke(supabase, 'create_ticket', {
        subject: ticketSubject,
        description: ticketDescription,
        priority: ticketPriority,
        sessionId,
      })

      if (raw?.data?.ticket) {
        toast.success('Support ticket created! A NetNeural engineer will follow up via email.')
        setShowTicketDialog(false)
        setTicketSubject('')
        setTicketDescription('')
        setTicketPriority('normal')

        // Add system message to chat
        const sysMsg: ChatMessage = {
          sender_type: 'system',
          content: `Ticket #${(raw.data.ticket.id as string).slice(0, 8).toUpperCase()} created. A NetNeural engineer will respond via email.`,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, sysMsg])
        loadStatus()
      } else {
        toast.error('Failed to create ticket.')
      }
    } catch {
      toast.error('Failed to create ticket.')
    } finally {
      setSubmittingTicket(false)
    }
  }

  // ─── Load tickets ─────────────────────────────────────────────

  const loadTickets = async () => {
    const { data: raw } = await invoke(supabase, 'list_tickets')
    setTickets((raw?.data?.tickets as Ticket[]) || [])
    setShowTickets(true)
  }

  // ─── Admin duty ────────────────────────────────────────────────

  const handleClockIn = async () => {
    setClockingIn(true)
    try {
      const { data: raw } = await invoke(supabase, 'clock_in')
      if (raw?.data) {
        toast.success(raw.data.message || 'You are now on support duty.')
        setOnDuty(true)
        loadStatus()
      }
    } catch { toast.error('Failed to clock in.') }
    finally { setClockingIn(false) }
  }

  const handleClockOut = async () => {
    setClockingOut(true)
    try {
      const { data: raw } = await invoke(supabase, 'clock_out')
      if (raw?.data) {
        toast.success(raw.data.message || 'You have clocked out of support duty.')
        setOnDuty(false)
        loadStatus()
      }
    } catch { toast.error('Failed to clock out.') }
    finally { setClockingOut(false) }
  }

  // ─── Render ────────────────────────────────────────────────────

  const dutyOnline = (status?.duty_admins_online ?? 0) > 0

  return (
    <div className="space-y-4">
      {/* ── Mercury Chat Card ── */}
      <Card>
        {/* Header */}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/10 ring-2 ring-cyan-500/20">
                <Bot className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="font-semibold leading-none">Mercury</p>
                <p className="mt-0.5 text-xs text-muted-foreground">NetNeural AI Support</p>
              </div>
              {!loadingStatus && (
                <Badge
                  variant="outline"
                  className={cn(
                    'ml-1 text-xs',
                    dutyOnline
                      ? 'border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  )}
                >
                  {dutyOnline ? (
                    <><CheckCircle2 className="mr-1 h-3 w-3" />{status!.duty_admins_online} admin{status!.duty_admins_online !== 1 ? 's' : ''} on duty</>
                  ) : (
                    <><AlertCircle className="mr-1 h-3 w-3" />No admin on duty</>
                  )}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Super admin: clock in/out */}
              {status?.is_super_admin && (
                onDuty ? (
                  <Button size="sm" variant="outline" onClick={handleClockOut} disabled={clockingOut} className="gap-1.5 text-xs">
                    {clockingOut ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
                    Clock Out
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleClockIn} disabled={clockingIn} className="gap-1.5 border-green-500/40 text-xs text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30">
                    {clockingIn ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-3 w-3" />}
                    Go On Duty
                  </Button>
                )
              )}

              {/* Open tickets badge */}
              {(status?.open_ticket_count ?? 0) > 0 && (
                <Button size="sm" variant="ghost" onClick={loadTickets} className="gap-1.5 text-xs">
                  <Ticket className="h-3.5 w-3.5" />
                  {status!.open_ticket_count} ticket{status!.open_ticket_count !== 1 ? 's' : ''}
                </Button>
              )}

              <Button size="sm" variant="ghost" onClick={loadStatus} className="h-7 w-7 p-0">
                <RefreshCw className={cn('h-3.5 w-3.5', loadingStatus && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {/* Messages area */}
          <div className="flex h-[340px] flex-col gap-3 overflow-y-auto rounded-lg border bg-muted/20 p-3">
            {messages.map((msg, idx) => {
              if (msg.sender_type === 'system') {
                return (
                  <div key={msg.id || idx} className="flex justify-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      {msg.content}
                    </span>
                  </div>
                )
              }

              const isMercury = msg.sender_type === 'mercury' || msg.sender_type === 'admin'
              const isTyping = msg.id === '__typing__'

              return (
                <div key={msg.id || idx} className={cn('flex gap-2', isMercury ? 'justify-start' : 'justify-end')}>
                  {isMercury && (
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10">
                      <Bot className="h-3.5 w-3.5 text-cyan-500" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      isMercury
                        ? 'rounded-tl-sm bg-card text-foreground ring-1 ring-border'
                        : 'rounded-tr-sm bg-cyan-500 text-white',
                      isTyping && 'animate-pulse'
                    )}
                  >
                    {isTyping ? (
                      <span className="tracking-widest text-muted-foreground">●●●</span>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {!isMercury && (
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="flex gap-2">
            <Input
              placeholder="Ask Mercury anything about NetNeural…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {dutyOnline ? 'Admins online — escalate anytime' : 'AI support active · No live agents on duty'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTicketSubject('')
                setTicketDescription(
                  messages
                    .filter((m) => m.sender_type !== 'system' && m.id !== '__typing__')
                    .slice(-6)
                    .map((m) => `${m.sender_type === 'user' ? 'User' : 'Mercury'}: ${m.content}`)
                    .join('\n')
                )
                setShowTicketDialog(true)
              }}
              className="gap-1.5 text-xs"
            >
              <Ticket className="h-3.5 w-3.5" />
              Create Support Ticket
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Open Tickets panel ── */}
      {showTickets && tickets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-muted-foreground" />
                <p className="font-semibold text-sm">Your Support Tickets</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowTickets(false)}>
                Hide
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      #{t.id.slice(0, 8).toUpperCase()} · {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        t.priority === 'urgent' && 'border-red-500/40 text-red-500',
                        t.priority === 'high'   && 'border-orange-500/40 text-orange-500',
                        t.priority === 'normal' && 'border-blue-500/40 text-blue-500',
                        t.priority === 'low'    && 'text-muted-foreground'
                      )}
                    >
                      {t.priority}
                    </Badge>
                    <Badge
                      className={cn(
                        'text-xs',
                        t.status === 'open'        && 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
                        t.status === 'in_progress' && 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
                        t.status === 'resolved'    && 'bg-green-500/15 text-green-600 dark:text-green-400',
                        t.status === 'closed'      && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Ticket creation dialog ── */}
      <Dialog open={showTicketDialog} onOpenChange={setShowTicketDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Create Support Ticket
            </DialogTitle>
            <DialogDescription>
              A NetNeural engineer will review your ticket and respond via email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                placeholder="Brief description of your issue…"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the issue in detail…"
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                rows={5}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={ticketPriority} onValueChange={setTicketPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low — general question or feedback</SelectItem>
                  <SelectItem value="normal">Normal — issue affecting workflow</SelectItem>
                  <SelectItem value="high">High — significant impact on operations</SelectItem>
                  <SelectItem value="urgent">Urgent — system down or data loss</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTicketDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTicket}
              disabled={submittingTicket || !ticketSubject.trim() || !ticketDescription.trim()}
            >
              {submittingTicket ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ticket className="mr-2 h-4 w-4" />
              )}
              Submit Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
