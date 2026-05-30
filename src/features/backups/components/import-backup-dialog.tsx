/**
 * @description Dialog for importing an external .sql.gz backup file.
 * Two tabs: file upload (via API route) and URL (via Server Action).
 *
 * @module features/backups/components/import-backup-dialog
 */
'use client'

import { useState, useRef } from 'react'
import {
  Upload,
  Link,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HardDrive,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { importBackupAction } from '../actions'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

interface ImportBackupDialogProps {
  children?: React.ReactNode
  onSuccess?: () => void
}

export function ImportBackupDialog({
  children,
  onSuccess,
}: ImportBackupDialogProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('upload')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(false)

  // URL tab state
  const [url, setUrl] = useState('')

  const reset = () => {
    setSelectedFile(null)
    setUrl('')
    setError(null)
    setUploadProgress(false)
    setActiveTab('upload')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    setOpen(false)
    reset()
  }

  // ─── File Upload ─────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file) {
      // Client-side validation
      if (!file.name.endsWith('.sql.gz') && !file.name.endsWith('.gz')) {
        setError('El archivo debe tener extensión .sql.gz')
        setSelectedFile(null)
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setError('El archivo excede el tamaño máximo de 100 MB')
        setSelectedFile(null)
        return
      }
      setSelectedFile(file)
      setError(null)
    }
  }

  const handleFileSubmit = async () => {
    if (!selectedFile) return

    setIsSubmitting(true)
    setError(null)
    setUploadProgress(true)

    try {
      const token = sessionStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/backups/import', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Error al importar el archivo')
      }

      toast.success('Salva importada correctamente')
      onSuccess?.()
      handleClose()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Error inesperado al importar'
      setError(msg)
    } finally {
      setIsSubmitting(false)
      setUploadProgress(false)
    }
  }

  // ─── URL Import ──────────────────────────────────────────

  const handleUrlSubmit = async () => {
    if (!url.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await importBackupAction({ url: url.trim() })

      if (!result.success) {
        throw new Error(
          result.error?.message ?? 'Error al importar desde URL',
        )
      }

      toast.success('Salva importada correctamente desde URL')
      onSuccess?.()
      handleClose()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Error inesperado al importar'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar salva externa</DialogTitle>
          <DialogDescription>
            Importá un archivo .sql.gz existente al sistema de copias de
            seguridad para poder restaurarlo después.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Subir archivo
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Desde URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4 space-y-4">
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 transition-colors hover:border-violet-400 hover:bg-violet-50/30 dark:border-slate-600 dark:bg-slate-800/20 dark:hover:border-violet-500 dark:hover:bg-violet-950/20"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <>
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  <div className="text-center">
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <HardDrive className="h-10 w-10 text-slate-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      Hacé clic para seleccionar un archivo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      .sql.gz hasta 100 MB
                    </p>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql.gz,.gz"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {selectedFile && (
              <Button
                onClick={handleFileSubmit}
                disabled={isSubmitting}
                className="w-full bg-violet-600 hover:bg-violet-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Subir e importar
                  </>
                )}
              </Button>
            )}

            {uploadProgress && !error && (
              <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Subiendo y validando archivo...</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="url" className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                URL del archivo .sql.gz
              </label>
              <Input
                type="url"
                placeholder="https://ejemplo.com/backup-2024.sql.gz"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                La URL debe apuntar a un archivo .sql.gz accesible públicamente
              </p>
            </div>

            <Button
              onClick={handleUrlSubmit}
              disabled={isSubmitting || !url.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Importar desde URL
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
