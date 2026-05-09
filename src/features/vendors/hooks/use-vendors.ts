/**
 * @description Hook para obtener proveedores via Server Action.
 *   Reemplaza a useGetVendorsQuery() de RTK Query.
 *
 * @returns {object} { vendors, isLoading, error }
 */
'use client'

import { useEffect, useState } from 'react'
import { getVendorsAction } from '@/features/vendors/actions'
import type { Vendor } from '@/app/models/model'

type VendorWithCode = Vendor & { vendorCode?: string | null }

interface UseVendorsResult {
  vendors: VendorWithCode[]
  isLoading: boolean
  error: unknown
}

export function useVendors(): UseVendorsResult {
  const [vendors, setVendors] = useState<VendorWithCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getVendorsAction()
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setVendors((result.data ?? []) as unknown as VendorWithCode[])
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

  return { vendors, isLoading, error }
}
