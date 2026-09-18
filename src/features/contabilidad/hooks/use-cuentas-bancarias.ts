'use client'
import { useEffect, useState } from 'react'
import type { CuentaBancaria } from '@/app/models/model'
import { fetchClientAuthJson } from '@/lib/client-auth-fetch'

export function useCuentasBancarias() {
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    fetchClientAuthJson<{ cuentas?: CuentaBancaria[] }>('/api/configuracion/cuentas-bancarias', {
      method: 'GET',
      clearState: () => {
        if (!cancelled) setCuentas([])
      },
      defaultErrorMessage: 'Error al cargar cuentas bancarias',
    })
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setCuentas(result.data.cuentas ?? [])
          setError(undefined)
        } else {
          setCuentas([])
          setError(result.error)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { cuentas, isLoading, error }
}
