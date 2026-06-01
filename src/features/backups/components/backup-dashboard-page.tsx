/**
 * @description Backup dashboard page — main admin view combining manual backups,
 *   history table, plan management, and restore flows.
 *
 * @module features/backups/components/backup-dashboard-page
 */
'use client'

import { useState, useCallback } from 'react'
import {
  Database,
  Loader2,
  HardDrive,
  RefreshCw,
  AlertCircle,
  Plus,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBackups } from '../hooks/use-backups'
import { useBackupPlans } from '../hooks/use-backup-plans'
import { BackupHistoryTable } from './backup-history-table'
import { BackupTriggerDialog } from './backup-trigger-dialog'
import { ImportBackupDialog } from './import-backup-dialog'
import { RestoreDialog } from './restore-dialog'
import { PlanList } from './plan-list'
import { PlanFormDialog } from './plan-form-dialog'
import {
  createBackupAction,
  deleteBackupAction,
  downloadBackupAction,
  restoreBackupAction,
} from '../actions'
import { createPlanAction, updatePlanAction, deletePlanAction } from '../actions-plans'
import type { BackupLogRow } from '../hooks/use-backups'
import type { CreatePlanInput, UpdatePlanInput } from '../schemas'

export function BackupDashboardPage() {
  const [backupError, setBackupError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const {
    logs,
    isLoading: logsLoading,
    total,
    refresh: refreshLogs,
    typeFilter,
    statusFilter,
    setTypeFilter,
    setStatusFilter,
  } = useBackups()

  const {
    plans,
    isLoading: plansLoading,
    refresh: refreshPlans,
  } = useBackupPlans()

  const [restoreTarget, setRestoreTarget] = useState<BackupLogRow | null>(null)

  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [planSaving, setPlanSaving] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)

  // --- Manual backup ---
  const handleCreateBackup = useCallback(
    async (type: 'full' | 'tenant' | 'config') => {
      setIsCreating(true)
      setBackupError(null)
      try {
        const res = await createBackupAction({ type })
        if (!res.success) {
          const msg = res.error?.message ?? 'No se pudo iniciar la copia de seguridad'
          setBackupError(msg)
          toast.error(msg)
          return
        }
        toast.success('Copia de seguridad iniciada en segundo plano')
        refreshLogs()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error inesperado'
        setBackupError(msg)
        toast.error(msg)
      } finally {
        setIsCreating(false)
      }
    },
    [refreshLogs]
  )

  // --- Delete backup ---
  const handleDeleteBackup = useCallback(
    async (backupLogId: string) => {
      try {
        const res = await deleteBackupAction({ backupLogId })
        if (!res.success) {
          toast.error(res.error?.message ?? 'No se pudo eliminar la copia')
          return
        }
        toast.success('Copia eliminada correctamente')
        refreshLogs()
      } catch {
        toast.error('Error inesperado al eliminar la copia')
      }
    },
    [refreshLogs]
  )

  // --- Download ---
  const handleDownload = useCallback(
    async (backupLogId: string) => {
      try {
        const res = await downloadBackupAction({ backupLogId })
        if (!res.success || !res.data?.downloadUrl) {
          toast.error(res.error?.message ?? 'No se pudo descargar la copia')
          return
        }

        const url = res.data.downloadUrl
        const fileName = res.data.fileName ?? `backup-${backupLogId}.sql.gz`

        if (url.startsWith('/')) {
          // LocalFS: fetch via API route with auth token, then download as blob
          const token = ''
          const response = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Error al descargar' }))
            throw new Error(err.error ?? 'Error al descargar')
          }
          const blob = await response.blob()
          const blobUrl = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = blobUrl
          a.download = fileName
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(blobUrl)
        } else {
          // Vercel Blob: signed URL, open directly
          window.open(url, '_blank', 'noopener,noreferrer')
        }
      } catch {
        toast.error('Error inesperado al descargar')
      }
    },
    []
  )

  // --- Restore ---
  const handleRestore = useCallback(
    async (backupLogId: string, confirmation: string): Promise<boolean> => {
      try {
        const res = await restoreBackupAction({ backupLogId, confirmation })
        if (!res.success) {
          toast.error(res.error?.message ?? 'La restauración falló')
          return false
        }
        toast.success('Base de datos restaurada correctamente')
        refreshLogs()
        return true
      } catch {
        toast.error('Error inesperado durante la restauración')
        return false
      }
    },
    [refreshLogs]
  )

  // --- Plans ---
  const handleCreatePlan = useCallback(
    async (input: CreatePlanInput) => {
      setPlanSaving(true)
      setPlanError(null)
      try {
        const res = await createPlanAction(input)
        if (!res.success) {
          setPlanError(res.error?.message ?? 'Error al crear el plan')
          return
        }
        toast.success('Plan creado correctamente')
        refreshPlans()
      } catch {
        setPlanError('Error inesperado')
      } finally {
        setPlanSaving(false)
      }
    },
    [refreshPlans]
  )

  const handleTogglePlan = useCallback(
    async (input: UpdatePlanInput): Promise<boolean> => {
      const res = await updatePlanAction(input)
      if (!res.success) {
        toast.error(res.error?.message ?? 'No se pudo actualizar el plan')
        return false
      }
      refreshPlans()
      return true
    },
    [refreshPlans]
  )

  const handleDeletePlan = useCallback(
    async (planId: string): Promise<boolean> => {
      const res = await deletePlanAction({ planId })
      if (!res.success) {
        toast.error(res.error?.message ?? 'No se pudo eliminar el plan')
        return false
      }
      toast.success('Plan eliminado')
      refreshPlans()
      return true
    },
    [refreshPlans]
  )

  // Quick status stats
  const lastCompleted = logs
    .filter((l) => l.status === 'completed')
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0] ?? null

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Copias de seguridad</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrá las copias de seguridad de la base de datos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportBackupDialog onSuccess={refreshLogs}>
            <Button variant="outline" className="border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/30">
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
          </ImportBackupDialog>
          <BackupTriggerDialog
            isCreating={isCreating}
            error={backupError}
            onCreateBackup={handleCreateBackup}
          >
            <Button className="bg-violet-600 hover:bg-violet-700">
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Nueva copia
                </>
              )}
            </Button>
          </BackupTriggerDialog>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Última copia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastCompleted ? (
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-emerald-500" />
                <span className="text-lg font-bold">
                  {lastCompleted.createdAt
                    ? new Date(lastCompleted.createdAt).toLocaleDateString('es-AR')
                    : '—'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Sin copias</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total copias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-lg font-bold">{total}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Planes activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-lg font-bold">
              {plans.filter((p) => p.enabled).length}
            </span>
            <span className="ml-1 text-sm text-muted-foreground">
              / {plans.length}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: History | Plans */}
      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Planes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4">
          <BackupHistoryTable
            logs={logs}
            isLoading={logsLoading}
            total={total}
            onDelete={handleDeleteBackup}
            onDownload={handleDownload}
            onRestore={(log) => setRestoreTarget(log)}
            onRefresh={refreshLogs}
            typeFilter={typeFilter}
            statusFilter={statusFilter}
            onTypeFilterChange={setTypeFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </TabsContent>

        <TabsContent value="plans" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Programá copias automáticas con retención configurable
            </p>
            <Button variant="outline" size="sm" onClick={() => setPlanFormOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Nuevo plan
            </Button>
          </div>
          <PlanList
            plans={plans}
            isLoading={plansLoading}
            onToggle={handleTogglePlan}
            onDelete={handleDeletePlan}
            onCreateNew={() => setPlanFormOpen(true)}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <RestoreDialog
        backup={restoreTarget}
        open={!!restoreTarget}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null)
        }}
        onRestore={handleRestore}
      />

      <PlanFormDialog
        open={planFormOpen}
        onOpenChange={setPlanFormOpen}
        isSaving={planSaving}
        error={planError}
        onSubmit={handleCreatePlan}
      />
    </div>
  )
}
