'use client'
import { useEffect, useState } from 'react'
import { getMonedasAction } from '@/features/contabilidad/actions-exchange'
export function useMonedas() {
  const [monedas, setMonedas] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    let c = false
    getMonedasAction().then(r => { if (!c && r.success) setMonedas(r.data ?? []) }).finally(() => { if (!c) setIsLoading(false) })
    return () => { c = true }
  }, [])
  return { monedas, isLoading }
}
