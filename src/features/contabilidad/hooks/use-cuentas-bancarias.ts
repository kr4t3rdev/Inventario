'use client'
import { useEffect, useState } from 'react'
import { getCuentasBancariasAction } from '@/features/contabilidad/actions-cuentas-bancarias'
import type { CuentaBancaria } from '@/app/models/model'
export function useCuentasBancarias() {
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    let c = false
    getCuentasBancariasAction().then(r => {
      if (!c && r.success) setCuentas(r.data?.cuentas ?? [])
    }).finally(() => { if (!c) setIsLoading(false) })
    return () => { c = true }
  }, [])
  return { cuentas, isLoading }
}
