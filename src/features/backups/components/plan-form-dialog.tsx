/**
 * @description Dialog for creating or editing a backup plan.
 *
 * @module features/backups/components/plan-form-dialog
 */
'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { CreatePlanInput, UpdatePlanInput } from '../schemas'

interface PlanFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSaving: boolean
  error: string | null
  initial?: CreatePlanInput
  onSubmit: (input: CreatePlanInput | UpdatePlanInput) => Promise<void>
}

const SCHEDULE_OPTIONS = [
  { value: 'hourly', label: 'Cada hora' },
  { value: 'daily', label: 'Diario (2 AM)', cron: '0 2 * * *' },
  { value: 'weekly', label: 'Semanal (domingo 2 AM)', cron: '0 2 * * 0' },
]

export function PlanFormDialog({
  open,
  onOpenChange,
  isSaving,
  error,
  initial,
  onSubmit,
}: PlanFormDialogProps) {
  const [type, setType] = useState<'full' | 'tenant' | 'config'>('full')
  const [schedule, setSchedule] = useState('daily')
  const [retention, setRetention] = useState(7)
  const [customCron, setCustomCron] = useState('')

  const isEditing = !!initial

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setType(initial?.type ?? 'full')
      setSchedule(initial?.schedule ?? 'daily')
      setRetention(initial?.retention ?? 7)
      setCustomCron('')
    }
  }, [open, initial])

  const handleSubmit = async () => {
    const resolvedSchedule = schedule === 'custom' ? customCron : schedule
    if (!resolvedSchedule) return

    const payload: CreatePlanInput = {
      type,
      schedule: resolvedSchedule,
      retention,
    }

    await onSubmit(payload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar plan' : 'Nuevo plan'}</DialogTitle>
          <DialogDescription>
            Configurá la programación automática de copias de seguridad.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tipo de copia</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="full">Completa</option>
              <option value="tenant">Por Tenant</option>
              <option value="config">Configuración</option>
            </select>
          </div>

          {/* Schedule */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Frecuencia</label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              {SCHEDULE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              <option value="custom">Cron personalizado</option>
            </select>
          </div>

          {schedule === 'custom' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Expresión Cron
              </label>
              <input
                type="text"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="0 2 * * *"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <p className="text-[0.65rem] text-muted-foreground">
                Formato: minuto hora día mes día-semana
              </p>
            </div>
          )}

          {/* Retention */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Días de retención
            </label>
            <input
              type="number"
              value={retention}
              onChange={(e) => setRetention(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={365}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <p className="text-[0.65rem] text-muted-foreground">
              Las copias más antiguas que este valor se eliminarán automáticamente
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : isEditing ? (
              'Guardar cambios'
            ) : (
              'Crear plan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
