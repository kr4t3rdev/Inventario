/**
 * @description Restore dialog — 3-step wizard: details + warning, confirmation, progress.
 *
 * @module features/backups/components/restore-dialog
 */
'use client'

import { useState } from 'react'
import { AlertTriangle, RotateCcw, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { BackupLogRow } from '../hooks/use-backups'

type Step = 'confirm' | 'typing' | 'progress' | 'result'

interface RestoreDialogProps {
  backup: BackupLogRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestore: (backupLogId: string, confirmation: string) => Promise<boolean>
}

export function RestoreDialog({
  backup,
  open,
  onOpenChange,
  onRestore,
}: RestoreDialogProps) {
  const [step, setStep] = useState<Step>('confirm')
  const [typedText, setTypedText] = useState('')
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
    if (!newOpen) {
      setTimeout(() => {
        setStep('confirm')
        setTypedText('')
        setResult(null)
      }, 200)
    }
  }

  if (!backup) return null

  const expectedConfirmation = backup.type === 'full' || backup.type === 'imported' ? 'FULL RESTORE' : 'RESTORE'
  const isValid = typedText === expectedConfirmation

  const handleStartRestore = async () => {
    setStep('progress')
    const success = await onRestore(backup.backupLogId, typedText)
    setResult({
      success,
      message: success
        ? 'La restauración se completó exitosamente.'
        : 'La restauración falló. Revisá los logs del sistema.',
    })
    setStep('result')
  }

  const typeLabel = backup.type === 'full' || backup.type === 'imported' ? 'completa' : backup.type === 'tenant' ? 'de tenant' : 'de configuración'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Restaurar copia de seguridad
              </DialogTitle>
              <DialogDescription>
                Esta acción reemplazará datos existentes en la base de datos.
                Asegurate de tener una copia reciente antes de continuar.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="mb-2 font-semibold">⚠️ ADVERTENCIA</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>Se restaurará una copia {typeLabel}</li>
                <li>Los datos actuales serán reemplazados</li>
                <li>Esta operación no se puede deshacer</li>
                {backup.type === 'full' && (
                  <li className="font-semibold">TODA la base de datos será reemplazada</li>
                )}
              </ul>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep('typing')}
              >
                Entendido, continuar
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'typing' && (
          <>
            <DialogHeader>
              <DialogTitle>Confirmar restauración</DialogTitle>
              <DialogDescription>
                Escribí <strong>{expectedConfirmation}</strong> para confirmar
                que deseas restaurar esta copia de seguridad.
              </DialogDescription>
            </DialogHeader>

            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={expectedConfirmation}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              autoFocus
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('confirm')}>
                Volver
              </Button>
              <Button
                variant="destructive"
                disabled={!isValid}
                onClick={handleStartRestore}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'progress' && (
          <>
            <DialogHeader>
              <DialogTitle>Restaurando...</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center py-8">
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-violet-600" />
              <p className="text-sm text-muted-foreground">
                Restaurando copia de seguridad...
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                No cierres esta ventana
              </p>
            </div>
          </>
        )}

        {step === 'result' && result && (
          <>
            <DialogHeader>
              <DialogTitle>
                {result.success ? 'Restauración completada' : 'Error en la restauración'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center py-8">
              {result.success ? (
                <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-500" />
              ) : (
                <XCircle className="mb-4 h-12 w-12 text-red-500" />
              )}
              <p className="text-sm text-muted-foreground">{result.message}</p>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Cerrar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
