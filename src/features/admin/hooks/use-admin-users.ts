/**
 * @description Hook para obtener usuarios (admin) via Server Action.
 * @returns {object} { users, isLoading, error, refetch }
 */
'use client'
import { useCallback, useEffect, useState } from 'react'
import { getUsersAction } from '@/features/admin/actions'

export function useAdminUsers() {
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)

  const refetch = useCallback(() => {
    let cancelled = false
    setIsLoading(true)
    getUsersAction()
      .then((r) => { if (!cancelled) { if (r.success) setUsers(r.data ?? []); else setError(r.error) } })
      .catch((e) => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => refetch(), [refetch])

  return { users, isLoading, error, refetch }
}
