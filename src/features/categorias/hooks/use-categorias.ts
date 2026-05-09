/**
 * @description Hook para obtener categorías via Server Action.
 *   Reemplaza a useGetCategoriasQuery() de RTK Query.
 *
 * @returns {object} { categorias, isLoading, error }
 */
'use client'

import { useEffect, useState } from 'react'
import { getCategoriasAction } from '@/features/categorias/actions'
import type { Categoria } from '@/app/models/model'

interface UseCategoriasResult {
  categorias: Categoria[]
  isLoading: boolean
  error: unknown
}

export function useCategorias(): UseCategoriasResult {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getCategoriasAction()
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setCategorias((result.data ?? []) as unknown as Categoria[])
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

  return { categorias, isLoading, error }
}
