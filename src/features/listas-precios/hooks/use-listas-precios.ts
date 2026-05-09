/**
 * @description Hook para obtener listas de precios via Server Action.
 *   Reemplaza a useGetListasPreciosQuery() de RTK Query.
 *
 * @returns {object} { listasPrecios, isLoading, error }
 */
'use client'

import { useEffect, useState } from 'react'
import { getListasPreciosAction } from '@/features/listas-precios/actions'

interface ListaPrecioOption {
  id: string
  nombre: string
}

interface UseListasPreciosResult {
  listasPrecios: ListaPrecioOption[]
  isLoading: boolean
  error: unknown
}

export function useListasPrecios(): UseListasPreciosResult {
  const [listasPrecios, setListasPrecios] = useState<ListaPrecioOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getListasPreciosAction()
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setListasPrecios((result.data ?? []).map(l => ({ id: l.id, nombre: l.nombre })))
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

  return { listasPrecios, isLoading, error }
}
