/**
 * @description Hook para obtener unidades via Server Action.
 *   Reemplaza a useGetUnidadesQuery() de RTK Query.
 *
 * @returns {object} { unidades, isLoading, error }
 */
'use client'

import { useEffect, useState } from 'react'
import { getUnidadesAction } from '@/features/unidades/actions'

interface UnidadOption {
  unidadId: string
  nombre: string
  simbolo: string
}

interface UseUnidadesResult {
  unidades: UnidadOption[]
  isLoading: boolean
  error: unknown
}

export function useUnidades(): UseUnidadesResult {
  const [unidades, setUnidades] = useState<UnidadOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getUnidadesAction()
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setUnidades((result.data ?? []) as UnidadOption[])
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

  return { unidades, isLoading, error }
}
