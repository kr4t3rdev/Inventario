/**
 * @description Hook para obtener almacenes via Server Action.
 *   Reemplaza a useGetAlmacenesQuery() de RTK Query.
 *
 * @returns {object} { almacenes, isLoading, error }
 */
'use client'

import { useEffect, useState } from 'react'
import { getAlmacenesAction } from '@/features/almacenes/actions'

interface AlmacenOption {
  almacenId: string
  nombre: string
}

interface UseAlmacenesResult {
  almacenes: AlmacenOption[]
  isLoading: boolean
  error: unknown
}

export function useAlmacenes(): UseAlmacenesResult {
  const [almacenes, setAlmacenes] = useState<AlmacenOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getAlmacenesAction()
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setAlmacenes((result.data ?? []) as AlmacenOption[])
        } else {
          setError(result.error)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { almacenes, isLoading, error }
}
