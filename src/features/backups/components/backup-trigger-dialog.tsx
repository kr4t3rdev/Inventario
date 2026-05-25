/**
 * @description Dialog for triggering a new backup (full, per-tenant, or config).
 *
 * @module features/backups/components/backup-trigger-dialog
 */
'use client'

import { useState } from 'react'
import { Database, Building2, Settings, Loader2, AlertCircle } from 'lucide-react'
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

interface BackupTriggerDialogProps {
  isCreating: boolean
  error: string | null
  onCreateBackup: (type: 'full' | 'tenant' | 'config', tenantId?: string) => void
  children?: React.ReactNode
}

const BACKUP_TYPES = [
  {
    id: 'full' as const,
    label: 'Base de datos completa',
    description: 'Copia de seguridad de todas las tablas del sistema',
    icon: Database,
    color: 'from-violet-600 to-purple-600',
  },
  {
    id: 'tenant' as const,
    label: 'Por Tenant',
    description: 'Respaldar solo los datos de un tenant específico',
    icon: Building2,
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'config' as const,
    label: 'Solo configuración',
    description: 'Respaldar únicamente la configuración del sistema (tenants, usuarios, licencias)',
    icon: Settings,
    color: 'from-emerald-500 to-teal-500',
  },
]

export function BackupTriggerDialog({
  isCreating,
  error,
  onCreateBackup,
  children,
}: BackupTriggerDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<'full' | 'tenant' | 'config'>('full')

  const handleSubmit = () => {
    onCreateBackup(selectedType)
    setOpen(false)
    setSelectedType('full')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva copia de seguridad</DialogTitle>
          <DialogDescription>
            Seleccioná el tipo de copia de seguridad que querés crear.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {BACKUP_TYPES.map((type) => {
            const Icon = type.icon
            const isSelected = selectedType === type.id

            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-violet-300 bg-violet-50 shadow-sm dark:border-violet-700 dark:bg-violet-950/30'
                    : 'border-border hover:border-slate-300 hover:bg-muted/50'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br ${type.color} shadow-sm`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="mb-0.5 text-sm font-semibold">{type.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {type.description}
                  </div>
                </div>
                <div
                  className={`mt-1 h-4 w-4 rounded-full border-2 ${
                    isSelected
                      ? 'border-violet-600 bg-violet-600'
                      : 'border-slate-300'
                  }`}
                >
                  {isSelected && (
                    <div className="h-full w-full rounded-full bg-white scale-40" />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              'Iniciar copia'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
