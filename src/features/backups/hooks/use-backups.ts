/**
 * @description Hook for backup operations: list, trigger, delete, download, status polling.
 *
 * @module features/backups/hooks/use-backups
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getBackupsAction,
  createBackupAction,
  deleteBackupAction,
  downloadBackupAction,
  getBackupStatusAction,
} from '@/features/backups/actions'
import type { GetBackupsInput } from '@/features/backups/schemas'

export interface BackupLogRow {
  backupLogId: string
  type: 'full' | 'tenant' | 'config'
  tenantId: string | null
  status: string
  fileUrl: string | null
  fileName: string | null
  fileSize: number | null
  startedAt: Date
  completedAt: Date | null
  errorMessage: string | null
  createdBy: string
  createdAt: Date
}

interface BackupsState {
  logs: BackupLogRow[]
  total: number
  isLoading: boolean
  error: string | null
}

interface CreateBackupState {
  isCreating: boolean
  error: string | null
}

export function useBackups(initialFilters?: Partial<GetBackupsInput>) {
  const [filters, setFilters] = useState<GetBackupsInput>({
    limit: 50,
    offset: 0,
    ...initialFilters,
  })

  const [state, setState] = useState<BackupsState>({
    logs: [],
    total: 0,
    isLoading: true,
    error: null,
  })

  const [createState, setCreateState] = useState<CreateBackupState>({
    isCreating: false,
    error: null,
  })

  // Track running backups for polling
  const [runningIds, setRunningIds] = useState<string[]>([])
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch backups list
  const fetchBackups = useCallback(async (overrides?: Partial<GetBackupsInput>) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const mergedFilters = { ...filters, ...overrides }
      const result = await getBackupsAction(mergedFilters)
      if (result.success && result.data) {
        setState({
          logs: result.data.logs as BackupLogRow[],
          total: result.data.total,
          isLoading: false,
          error: null,
        })
      } else if (!result.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error?.message ?? 'Error al cargar backups',
        }))
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      }))
    }
  }, [filters])

  // Initial fetch
  useEffect(() => {
    fetchBackups()
  }, [fetchBackups])

  // Poll running backups
  useEffect(() => {
    if (runningIds.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    pollingRef.current = setInterval(async () => {
      const stillRunning: string[] = []

      for (const id of runningIds) {
        try {
          const result = await getBackupStatusAction({ backupLogId: id })
          if (result.success && result.data) {
            if (result.data.status === 'running') {
              stillRunning.push(id)
            }
          }
        } catch {
          stillRunning.push(id)
        }
      }

      setRunningIds(stillRunning)

      // Refresh list when any backup completes
      if (stillRunning.length < runningIds.length) {
        fetchBackups()
      }
    }, 3000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [runningIds, fetchBackups])

  // Trigger backup
  const createBackup = useCallback(
    async (type: 'full' | 'tenant' | 'config', tenantId?: string) => {
      setCreateState({ isCreating: true, error: null })
      try {
        const result = await createBackupAction({ type, tenantId })
        if (result.success) {
          const logId = result.data?.backupLogId
          if (logId) {
            setRunningIds((prev) => [...prev, logId])
          }
          setCreateState({ isCreating: false, error: null })
          fetchBackups()
          return logId ?? null
        } else {
          setCreateState({
            isCreating: false,
            error: result.error?.message ?? 'Error al crear backup',
          })
          return null
        }
      } catch (err) {
        setCreateState({
          isCreating: false,
          error: err instanceof Error ? err.message : 'Error desconocido',
        })
        return null
      }
    },
    [fetchBackups],
  )

  // Delete backup
  const deleteBackup = useCallback(
    async (backupLogId: string) => {
      try {
        const result = await deleteBackupAction({ backupLogId })
        if (result.success) {
          fetchBackups()
          return true
        }
        return false
      } catch {
        return false
      }
    },
    [fetchBackups],
  )

  // Download backup
  const downloadBackup = useCallback(async (backupLogId: string) => {
    try {
      const result = await downloadBackupAction({ backupLogId })
      if (result.success && result.data) {
        window.open(result.data.downloadUrl, '_blank')
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  // Update filters and refetch
  const updateFilters = useCallback(
    (newFilters: Partial<GetBackupsInput>) => {
      setFilters((prev) => ({ ...prev, ...newFilters }))
    },
    [],
  )

  // Convenience filter setters for external use
  const setTypeFilter = useCallback(
    (value: string) => {
      const type = value === '' ? undefined : (value as 'full' | 'tenant' | 'config')
      updateFilters({ type, offset: 0 })
    },
    [updateFilters],
  )

  const setStatusFilter = useCallback(
    (value: string) => {
      const status = value === '' ? undefined : (value as 'running' | 'completed' | 'failed')
      updateFilters({ status, offset: 0 })
    },
    [updateFilters],
  )

  return {
    ...state,
    typeFilter: filters.type ?? '',
    statusFilter: filters.status ?? '',
    setTypeFilter,
    setStatusFilter,
    createState,
    runningIds,
    createBackup,
    deleteBackup,
    downloadBackup,
    refresh: fetchBackups,
    updateFilters,
  }
}
