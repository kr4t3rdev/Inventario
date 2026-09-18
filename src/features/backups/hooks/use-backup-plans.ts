/**
 * @description Hook for backup plan operations: list, create, update, delete.
 *
 * @module features/backups/hooks/use-backup-plans
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  createPlanAction,
  updatePlanAction,
  deletePlanAction,
  getPlansAction,
} from '@/features/backups/actions-plans'
import type { CreatePlanInput, UpdatePlanInput } from '@/features/backups/schemas'

export interface BackupPlanRow {
  backupPlanId: string
  type: 'full' | 'tenant' | 'config'
  tenantId: string | null
  schedule: string
  enabled: boolean
  retention: number
  lastRunAt: Date | null
  nextRunAt: Date | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

interface PlansState {
  plans: BackupPlanRow[]
  isLoading: boolean
  error: string | null
}

export function useBackupPlans() {
  const [state, setState] = useState<PlansState>({
    plans: [],
    isLoading: true,
    error: null,
  })

  const [actionLoading, setActionLoading] = useState(false)

  const fetchPlans = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const result = await getPlansAction()
      if (result.success && result.data) {
        setState({
          plans: result.data as BackupPlanRow[],
          isLoading: false,
          error: null,
        })
      } else if (!result.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error?.message ?? 'Error al cargar planes',
        }))
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      }))
    }
  }, [])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const createPlan = useCallback(
    async (input: CreatePlanInput): Promise<boolean> => {
      setActionLoading(true)
      try {
        const result = await createPlanAction(input)
        if (result.success) {
          fetchPlans()
          return true
        }
        return false
      } catch {
        return false
      } finally {
        setActionLoading(false)
      }
    },
    [fetchPlans],
  )

  const updatePlan = useCallback(
    async (input: UpdatePlanInput): Promise<boolean> => {
      setActionLoading(true)
      try {
        const result = await updatePlanAction(input)
        if (result.success) {
          fetchPlans()
          return true
        }
        return false
      } catch {
        return false
      } finally {
        setActionLoading(false)
      }
    },
    [fetchPlans],
  )

  const deletePlan = useCallback(
    async (planId: string): Promise<boolean> => {
      setActionLoading(true)
      try {
        const result = await deletePlanAction({ planId })
        if (result.success) {
          fetchPlans()
          return true
        }
        return false
      } catch {
        return false
      } finally {
        setActionLoading(false)
      }
    },
    [fetchPlans],
  )

  return {
    ...state,
    actionLoading,
    createPlan,
    updatePlan,
    deletePlan,
    refresh: fetchPlans,
  }
}
