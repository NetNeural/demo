'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { useToast } from '@/hooks/use-toast'
import {
  Upload,
  Download,
  Trash2,
  FileText,
  FilePlus,
  AlertCircle,
  Loader2,
  FolderOpen,
  Eye,
  EyeOff,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type DocumentCategory =
  | 'investor_summary'
  | 'corporate_matters'
  | 'financial_matters'
  | 'financing_cap_table'
  | 'founders_employees_vendors'
  | 'market_research'
  | 'product_ip'
  | 'sales_marketing'
  | 'operating_contracts'
  | 'insurance'
  | 'dod_nih'

interface OrgDocument {
  id: string
  organization_id: string
  uploaded_by: string
  file_name: string
  file_size: number
  file_type: string
  storage_path: string
  category: DocumentCategory
  description: string | null
  is_visible_to_members: boolean
  created_at: string
  uploader_name?: string
  uploader_email?: string
}

interface DocumentsTabProps {
  organizationId: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  investor_summary: 'A - Investor Summary',
  corporate_matters: 'B - Corporate Matters',
  financial_matters: 'C - Financial Matters',
  financing_cap_table: 'D - Financing and Cap Table',
  founders_employees_vendors: 'E - Founders, Employees, Key Vendors',
  market_research: 'F - Market Research',
  product_ip: 'G - Product & IP',
  sales_marketing: 'H - Sales & Marketing',
  operating_contracts: 'I - Operating Contracts',
  insurance: 'J - Insurance',
  dod_nih: 'K - DoD/NIH',
}

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  investor_summary: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  corporate_matters: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  financial_matters: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  financing_cap_table: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  founders_employees_vendors: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  market_research: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  product_ip: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  sales_marketing: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  operating_contracts: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  insurance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  dod_nih: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function fileIcon(fileType: string) {
  return <FileText className="h-4 w-4 text-muted-foreground" />
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DocumentsTab({ organizationId }: DocumentsTabProps) {
  const supabase = createClient()
  const { isOwner, isAdmin, userRole } = useOrganization()
  const { user } = useUser()
  const { fmt } = useDateFormatter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isSuperAdmin = user?.isSuperAdmin || false
  const canManage = isSuperAdmin || isOwner || isAdmin
  const canUpload = isSuperAdmin || isOwner || isAdmin || userRole === 'billing'

  // ── State ─────────────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState<OrgDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState<
    DocumentCategory | 'all'
  >('all')

  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadCategory, setUploadCategory] =
    useState<DocumentCategory>('investor_summary')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadVisibleToMembers, setUploadVisibleToMembers] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<OrgDocument | null>(
    null
  )

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    if (!organizationId) {
      setDocuments([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('org_documents')
        .select(
          `
          *,
          uploader:uploaded_by (
            full_name,
            email
          )
        `
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDocuments(
        (data || []).map((d: any) => ({
          ...d,
          uploader_name: d.uploader?.full_name || null,
          uploader_email: d.uploader?.email || null,
        }))
      )
    } catch (err) {
      console.error('Failed to fetch documents:', err)
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [organizationId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setSelectedFile(file)
    setUploadError('')
  }

  const handleUpload = async () => {
    if (!selectedFile || !user) return

    try {
      setUploading(true)
      setUploadError('')

      // Sanitise filename: replace spaces and special chars
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${organizationId}/${Date.now()}-${safeName}`

      // 1. Upload file to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('org-documents')
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`)
      }

      // 2. Save metadata row
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbError } = await (supabase as any)
        .from('org_documents')
        .insert({
          organization_id: organizationId,
          uploaded_by: user.id,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          file_type: selectedFile.type || 'application/octet-stream',
          storage_path: storagePath,
          category: uploadCategory,
          description: uploadDescription.trim() || null,
          is_visible_to_members: uploadVisibleToMembers,
        })

      if (dbError) {
        // Clean up storage if metadata insert fails
        await supabase.storage.from('org-documents').remove([storagePath])
        throw new Error(`Failed to save document metadata: ${dbError.message}`)
      }

      toast({
        title: 'Document Uploaded',
        description: `${selectedFile.name} has been added to the data room.`,
      })

      // Reset form
      setShowUploadDialog(false)
      setSelectedFile(null)
      setUploadCategory('investor_summary')
      setUploadDescription('')
      setUploadVisibleToMembers(false)
      if (fileInputRef.current) fileInputRef.current.value = ''

      await fetchDocuments()
    } catch (err) {
      console.error('Upload error:', err)
      setUploadError(
        err instanceof Error ? err.message : 'Upload failed. Please try again.'
      )
    } finally {
      setUploading(false)
    }
  }

  // ── Download (signed URL) ────────────────────────────────────────────────
  const handleDownload = async (doc: OrgDocument) => {
    try {
      setDownloadingId(doc.id)

      const { data, error } = await supabase.storage
        .from('org-documents')
        .createSignedUrl(doc.storage_path, 300) // 5-minute signed URL

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Failed to generate download link')
      }

      // Log the download for audit trail
      if (user) {
        // Check if user is a data room guest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: guestRecord } = await (supabase as any)
          .from('data_room_guests')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('data_room_access_log')
          .insert({
            organization_id: organizationId,
            user_id: user.id,
            guest_id: guestRecord?.id || null,
            document_id: doc.id,
            document_name: doc.file_name,
            action: 'download',
          })
      }

      // Open in new tab (browser handles PDF inline, others download)
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to download file',
        variant: 'destructive',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (doc: OrgDocument) => {
    try {
      setDeletingId(doc.id)

      // 1. Delete from storage
      const { error: storageError } = await supabase.storage
        .from('org-documents')
        .remove([doc.storage_path])

      if (storageError) {
        console.warn('Storage delete warning:', storageError.message)
        // Continue — metadata should still be removed
      }

      // 2. Delete metadata row
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbError } = await (supabase as any)
        .from('org_documents')
        .delete()
        .eq('id', doc.id)

      if (dbError) throw new Error(dbError.message)

      toast({
        title: 'Document Deleted',
        description: `${doc.file_name} has been removed.`,
      })

      setConfirmDeleteDoc(null)
      await fetchDocuments()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Delete failed',
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  // ── Filtered view ─────────────────────────────────────────────────────────
  const filteredDocs =
    filterCategory === 'all'
      ? documents
      : documents.filter((d) => d.category === filterCategory)

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setSelectedFile(file)
      setUploadError('')
      setShowUploadDialog(true)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Data Room
                <Badge variant="outline" className="text-xs font-normal">
                  {documents.length} {documents.length === 1 ? 'file' : 'files'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Secure document storage organized by category.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Category filter */}
              <Select
                value={filterCategory}
                onValueChange={(v) =>
                  setFilterCategory(v as DocumentCategory | 'all')
                }
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {(Object.keys(CATEGORY_LABELS) as DocumentCategory[]).map(
                    (cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>

              {canUpload && (
                <Button onClick={() => setShowUploadDialog(true)}>
                  <FilePlus className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-14 transition-colors ${
                canUpload && dragging
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-muted'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                if (canUpload) setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={canUpload ? handleDrop : undefined}
            >
              <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {filterCategory === 'all'
                  ? 'No documents yet'
                  : `No ${CATEGORY_LABELS[filterCategory]} documents`}
              </p>
              {canUpload && (
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Drag & drop a file here, or click Upload above
                </p>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                if (canUpload) setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={canUpload ? handleDrop : undefined}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Uploaded by</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {fileIcon(doc.file_type)}
                          <div>
                            <p className="text-sm font-medium leading-none">
                              {doc.file_name}
                            </p>
                            {doc.description && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                {doc.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[doc.category]}`}
                        >
                          {CATEGORY_LABELS[doc.category]}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatBytes(doc.file_size)}
                      </TableCell>
                      <TableCell>
                        {doc.is_visible_to_members ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <Eye className="h-3 w-3" /> All members
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <EyeOff className="h-3 w-3" /> Admins only
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.uploader_name || doc.uploader_email || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmt.dateOnly(doc.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            title="Download"
                          >
                            {downloadingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteDoc(doc)}
                              disabled={deletingId === doc.id}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Upload Dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={showUploadDialog}
        onOpenChange={(open) => {
          if (!uploading) {
            setShowUploadDialog(open)
            if (!open) {
              setSelectedFile(null)
              setUploadError('')
              if (fileInputRef.current) fileInputRef.current.value = ''
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a file to this organisation&apos;s data room.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* File picker */}
            <div className="space-y-2">
              <Label>File</Label>
              <div
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                  selectedFile
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0]
                  if (file) {
                    setSelectedFile(file)
                    setUploadError('')
                  }
                }}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-1 text-center">
                    <FileText className="h-8 w-8 text-primary" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(selectedFile.size)}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-center text-muted-foreground">
                    <Upload className="h-8 w-8" />
                    <p className="text-sm font-medium">
                      Click or drag to select
                    </p>
                    <p className="text-xs">
                      PDF, Word, Excel, CSV, ZIP — up to 50 MB
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.gif,.zip"
                onChange={handleFileSelect}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={uploadCategory}
                onValueChange={(v) => setUploadCategory(v as DocumentCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as DocumentCategory[]).map(
                    (cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>
                Description{' '}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Brief description of this document…"
                rows={2}
                maxLength={300}
              />
            </div>

            {/* Visibility */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Visible to all members</p>
                <p className="text-xs text-muted-foreground">
                  When off, only admins and owners can see this file
                </p>
              </div>
              <Switch
                checked={uploadVisibleToMembers}
                onCheckedChange={setUploadVisibleToMembers}
              />
            </div>

            {uploadError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────────────────────── */}
      <Dialog
        open={!!confirmDeleteDoc}
        onOpenChange={(open) => {
          if (!open && !deletingId) setConfirmDeleteDoc(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{confirmDeleteDoc?.file_name}</strong>?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteDoc(null)}
              disabled={!!deletingId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteDoc && handleDelete(confirmDeleteDoc)}
              disabled={!!deletingId}
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
