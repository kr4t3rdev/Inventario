/**
 * @description Hook para obtener mermas via Server Action.
 * @returns {object} { mermas, isLoading, error }
 */
'use client'
import { useEffect, useState } from 'react'
import { getMermasAction } from '@/features/mermas/actions'

export function useMermas() {
  const [mermas, setMermas] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(undefined)
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getMermasAction()
      .then((r) => { if (!cancelled) { if (r.success) setMermas(r.data ?? []); else setError(r.error) } })
      .catch((e) => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])
  return { mermas, isLoading, error }
}
