/**
 * @description Hook para obtener ofertas via Server Action.
 * @returns {object} { ofertas, isLoading, error }
 */
'use client'
import { useEffect, useState } from 'react'
import { getOfertasAction } from '@/features/ofertas/actions'

export function useOfertas() {
  const [ofertas, setOfertas] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getOfertasAction()
      .then((r) => { if (!cancelled) { if (r.success) setOfertas(r.data ?? []); else setError(r.error) } })
      .catch((e) => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])
  return { ofertas, isLoading, error }
}
