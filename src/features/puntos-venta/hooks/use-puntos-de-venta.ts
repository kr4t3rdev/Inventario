/**
 * @description Hook para obtener puntos de venta via Server Action.
 *   Reemplaza a useGetPuntosDeVentaQuery() de RTK Query.
 *
 * @returns {object} { puntosDeVenta, isLoading, error }
 */
'use client'

import { useEffect, useState } from 'react'
import { getPuntosDeVentaAction } from '@/features/puntos-venta/actions'

interface PuntoVentaOption {
  pvId: string
  nombre: string
}

interface UsePuntosDeVentaResult {
  puntosDeVenta: PuntoVentaOption[]
  isLoading: boolean
  error: unknown
}

export function usePuntosDeVenta(): UsePuntosDeVentaResult {
  const [puntosDeVenta, setPuntosDeVenta] = useState<PuntoVentaOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getPuntosDeVentaAction()
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setPuntosDeVenta((result.data ?? []).map(p => ({ pvId: p.pvId, nombre: p.nombre })))
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

  return { puntosDeVenta, isLoading, error }
}
