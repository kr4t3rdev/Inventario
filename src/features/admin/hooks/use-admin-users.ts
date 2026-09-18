/**
 * @description Hook para obtener usuarios (admin) via Server Action.
 * @param {Object} options - Configuración del hook.
 * @param {boolean} [options.enabled=true] - Si el hook debe ejecutar el fetch.
 *   Cuando está deshabilitado, users es un array vacío estable y isLoading=false.
 * @returns {object} { users, isLoading, error, refetch }
 */
'use client'
import { useCallback, useEffect, useState } from 'react'
import { getUsersAction } from '@/features/admin/actions'

export function useAdminUsers({ enabled = true }: { enabled?: boolean } = {}) {
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<unknown>(undefined)

  const refetch = useCallback(() => {
    if (!enabled) {
      return
    }
    let cancelled = false
    setIsLoading(true)
    getUsersAction()
      .then((r) => {
        if (!cancelled) {
          if (r.success) setUsers(r.data ?? [])
          else setError(r.error)
        }
      })
      .catch((e) => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [enabled])

  useEffect(() => {
    if (enabled) {
      return refetch()
    }
    setIsLoading(false)
  }, [refetch, enabled])

  return { users, isLoading, error, refetch }
}
