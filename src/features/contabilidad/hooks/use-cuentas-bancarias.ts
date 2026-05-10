'use client'
import { useEffect, useState } from 'react'
import { getCuentasBancariasAction } from '@/features/contabilidad/actions-cuentas-bancarias'
export function useCuentasBancarias() {
  const [cuentas, setCuentas] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    let c = false
    getCuentasBancariasAction().then(r => { if (!c && r.success) setCuentas(r.data?.cuentas ?? r.data ?? []) }).finally(() => { if (!c) setIsLoading(false) })
    return () => { c = true }
  }, [])
  return { cuentas, isLoading }
}
