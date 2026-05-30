/**
 * @description Backup history table with filters, sorting, and row actions.
 *
 * @module features/backups/components/backup-history-table
 */
'use client'

import { useState } from 'react'
import {
  Database,
  Building2,
  Settings,
  Download,
  Trash2,
  RotateCcw,
  Loader2,
  HardDrive,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { BackupLogRow } from '../hooks/use-backups'

interface BackupHistoryTableProps {
  logs: BackupLogRow[]
  isLoading: boolean
  total: number
  onDelete: (id: string) => void
  onDownload: (id: string) => void
  onRestore: (log: BackupLogRow) => void
  onRefresh: () => void
  typeFilter: string
  statusFilter: string
  onTypeFilterChange: (val: string) => void
  onStatusFilterChange: (val: string) => void
}

const TYPE_LABELS: Record<string, { label: string; icon: typeof Database; color: string }> = {
  full: { label: 'Completo', icon: Database, color: 'text-violet-600' },
  tenant: { label: 'Por Tenant', icon: Building2, color: 'text-amber-600' },
  config: { label: 'Config', icon: Settings, color: 'text-emerald-600' },
  imported: { label: 'Importada', icon: HardDrive, color: 'text-sky-600' },
}

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  running: { label: 'En progreso', variant: 'default' },
  completed: { label: 'Completado', variant: 'secondary' },
  failed: { label: 'Fallido', variant: 'destructive' },
  pruned: { label: 'Podado', variant: 'outline' },
  deleted: { label: 'Eliminado', variant: 'outline' },
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(date: Date | string | null): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function BackupHistoryTable({
  logs,
  isLoading,
  total,
  onDelete,
  onDownload,
  onRestore,
  onRefresh,
  typeFilter,
  statusFilter,
  onTypeFilterChange,
  onStatusFilterChange,
}: BackupHistoryTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await onDelete(id)
    setDeletingId(null)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todos</option>
            <option value="full">Completo</option>
            <option value="tenant">Por Tenant</option>
            <option value="config">Config</option>
            <option value="imported">Importada</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Estado</label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todos</option>
            <option value="running">En progreso</option>
            <option value="completed">Completado</option>
            <option value="failed">Fallido</option>
          </select>
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          {total} registro{total !== 1 ? 's' : ''}
        </div>

        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <Loader2 className={`mr-1 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tamaño</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Creado</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  <p className="mt-2 text-xs">Cargando copias de seguridad...</p>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  <HardDrive className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm">No se encontraron copias de seguridad</p>
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const typeMeta = TYPE_LABELS[log.type] ?? TYPE_LABELS.full
                const TypeIcon = typeMeta.icon
                const statusMeta = STATUS_BADGES[log.status] ?? {
                  label: log.status,
                  variant: 'outline' as const,
                }
                const isRunning = log.status === 'running'

                return (
                  <tr key={log.backupLogId} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon className={`h-4 w-4 ${typeMeta.color}`} />
                        <span className="font-medium">{typeMeta.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isRunning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                        ) : log.status === 'completed' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : log.status === 'failed' ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        <Badge variant={statusMeta.variant} className="text-[0.7rem]">
                          {statusMeta.label}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatSize(log.fileSize)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {log.status === 'completed' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Descargar"
                              onClick={() => onDownload(log.backupLogId)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700"
                              title="Restaurar"
                              onClick={() => onRestore(log)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {log.status !== 'running' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            title="Eliminar"
                            disabled={deletingId === log.backupLogId}
                            onClick={() => handleDelete(log.backupLogId)}
                          >
                            {deletingId === log.backupLogId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
