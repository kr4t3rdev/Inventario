/**
 * @description List of backup plans with enabled toggle, schedule info, retention, and delete.
 *
 * @module features/backups/components/plan-list
 */
'use client'

import { useState } from 'react'
import {
  Database,
  Building2,
  Settings,
  Trash2,
  Loader2,
  Clock,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { BackupPlanRow } from '../hooks/use-backup-plans'
import type { UpdatePlanInput } from '../schemas'

interface PlanListProps {
  plans: BackupPlanRow[]
  isLoading: boolean
  tenantNames?: Record<string, string>
  onToggle: (input: UpdatePlanInput) => Promise<boolean>
  onDelete: (planId: string) => Promise<boolean>
  onCreateNew: () => void
}

const TYPE_META: Record<string, { label: string; icon: typeof Database; color: string }> = {
  full: { label: 'Completo', icon: Database, color: 'text-violet-600' },
  tenant: { label: 'Por Tenant', icon: Building2, color: 'text-amber-600' },
  config: { label: 'Config', icon: Settings, color: 'text-emerald-600' },
}

function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function scheduleLabel(cron: string): string {
  switch (cron) {
    case 'hourly':
    case '0 * * * *':
      return 'Cada hora'
    case 'daily':
    case '0 2 * * *':
      return 'Diario (2 AM)'
    case 'weekly':
    case '0 2 * * 0':
      return 'Semanal (domingo 2 AM)'
    default:
      return cron
  }
}

export function PlanList({
  plans,
  isLoading,
  tenantNames = {},
  onToggle,
  onDelete,
  onCreateNew,
}: PlanListProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleToggle = async (plan: BackupPlanRow) => {
    setTogglingId(plan.backupPlanId)
    await onToggle({ planId: plan.backupPlanId, enabled: !plan.enabled })
    setTogglingId(null)
  }

  const handleDelete = async (planId: string) => {
    setDeletingId(planId)
    await onDelete(planId)
    setDeletingId(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Clock className="h-8 w-8 text-slate-300" />
        <p className="text-sm text-muted-foreground">No hay planes programados</p>
        <Button variant="outline" size="sm" onClick={onCreateNew}>
          <Plus className="mr-1 h-4 w-4" />
          Crear plan
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {plans.map((plan) => {
        const meta = TYPE_META[plan.type] ?? TYPE_META.full
        const Icon = meta.icon

        return (
          <div
            key={plan.backupPlanId}
            className="flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-muted/30"
          >
            {/* Type icon */}
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${meta.color}`}>
              <Icon className="h-4 w-4" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{meta.label}</span>
                <Badge
                  variant={plan.enabled ? 'default' : 'outline'}
                  className="text-[0.65rem]"
                >
                  {plan.enabled ? 'Activo' : 'Inactivo'}
                </Badge>
                <Badge variant="secondary" className="text-[0.65rem]">
                  {plan.retention} días
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {plan.type === 'tenant' && plan.tenantId ? (
                  <span>Tenant: {tenantNames[plan.tenantId] ?? plan.tenantId}</span>
                ) : null}
                <span>{scheduleLabel(plan.schedule)}</span>
                <span>Último: {formatDate(plan.lastRunAt)}</span>
                <span>Próximo: {formatDate(plan.nextRunAt)}</span>
              </div>
            </div>

            {/* Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={plan.enabled}
              disabled={togglingId === plan.backupPlanId}
              onClick={() => handleToggle(plan)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                plan.enabled
                  ? 'bg-violet-600'
                  : 'bg-slate-200 dark:bg-slate-700'
              } ${
                togglingId === plan.backupPlanId
                  ? 'opacity-50'
                  : ''
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  plan.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600"
              disabled={deletingId === plan.backupPlanId}
              onClick={() => handleDelete(plan.backupPlanId)}
            >
              {deletingId === plan.backupPlanId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
