/**
 * @description Hook para obtener venta de servicios via Server Action.
 * @returns {object} { ventaServicios, isLoading, error }
 */
'use client'

import { useEffect, useState } from 'react'
import { getVentaServiciosAction } from '@/features/venta-servicios/actions'

interface UseVentaServiciosResult {
  ventaServicios: any[]
  isLoading: boolean
  error: unknown
}

export function useVentaServicios(): UseVentaServiciosResult {
  const [ventaServicios, setVentaServicios] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getVentaServiciosAction()
      .then((result) => {
        if (cancelled) return
        if (result.success) setVentaServicios(result.data ?? [])
        else setError(result.error)
      })
      .catch((err) => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { ventaServicios, isLoading, error }
}
