/**
 * @description Hook para obtener compras de productos via Server Action.
 * @returns {object} { compras, isLoading, error, pagination }
 */
'use client'

import { useEffect, useState } from 'react'
import { getComprasProductosAction } from '@/features/compras-productos/actions'

interface CompraBasica {
  compraDocumentoId: string
  numeroFactura: string
  total: number
  estado: string
  formaPago: string
  tipoOperacion: string
  fechaCompra: string
  proveedor?: { vendorId: string; nombre: string } | null
  items?: Array<{ producto?: { id: string; nombre: string } | null }>
}

interface UseComprasProductosResult {
  compras: CompraBasica[]
  isLoading: boolean
  error: unknown
  pagination: { page: number; limit: number; total: number; totalPages: number } | null
}

export function useComprasProductos(): UseComprasProductosResult {
  const [compras, setCompras] = useState<CompraBasica[]>([])
  const [pagination, setPagination] = useState<UseComprasProductosResult['pagination']>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getComprasProductosAction({})
      .then((result) => {
        if (cancelled) return
        if (result.success && result.data) {
          setCompras((result.data.compras ?? []) as unknown as CompraBasica[])
          setPagination(result.data.pagination ?? null)
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

  return { compras, pagination, isLoading, error }
}
