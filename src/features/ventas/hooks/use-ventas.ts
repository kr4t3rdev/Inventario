/**
 * @description Hook para obtener ventas via Server Action.
 *   Reemplaza a useGetVentasQuery() de RTK Query.
 *
 * @returns {object} { ventas, isLoading, error }
 */
'use client'

import { useEffect, useState } from 'react'
import { getVentasAction } from '@/features/ventas/actions'

interface VentaBasica {
  ventaId: string
  total: number
  createdAt: string
  puntoDeVenta?: { pvId: string; nombre: string } | null
  cliente?: { clienteId: string; nombre: string } | null
}

interface UseVentasResult {
  ventas: VentaBasica[]
  isLoading: boolean
  error: unknown
}

export function useVentas(): UseVentasResult {
  const [ventas, setVentas] = useState<VentaBasica[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getVentasAction()
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setVentas((result.data ?? []) as unknown as VentaBasica[])
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

  return { ventas, isLoading, error }
}
