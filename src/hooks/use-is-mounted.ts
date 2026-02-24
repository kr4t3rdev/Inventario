'use client'

import { useEffect, useState } from 'react'

/**
 * @description Hook que indica si el componente se ha montageado en el cliente
 * @returns {boolean} true después de que el componente se monte en el cliente
 */
export function useIsMounted(): boolean {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  return isMounted
}
