'use client'

import { useReducedMotion } from 'framer-motion'

import { useIsMounted } from '@/hooks/use-is-mounted'

/**
 * @description Returns the reduced-motion preference only after client mount to keep SSR and first client render aligned.
 * @returns {boolean} True only when the component is mounted and the user prefers reduced motion.
 */
export function useHydrationSafeReducedMotion(): boolean {
  const isMounted = useIsMounted()
  const prefersReducedMotion = !!useReducedMotion()

  return isMounted && prefersReducedMotion
}
