/**
 * @description Hook para obtener clientes via Server Action.
 * @returns {object} { clientes, isLoading, error }
 */
'use client'
import { useEffect, useState } from 'react'
import { getClientesAction } from '@/features/clientes/actions'

export function useClientes() {
  const [clientes, setClientes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getClientesAction()
      .then((r) => { if (!cancelled) { if (r.success) setClientes(r.data ?? []); else setError(r.error) } })
      .catch((e) => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])
  return { clientes, isLoading, error }
}
