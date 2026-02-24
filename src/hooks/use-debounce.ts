import { useState, useEffect } from 'react'

/**
 * @description Hook personalizado para implementar debounce en valores de estado
 * @param {T} value - El valor a debouncing
 * @param {number} delay - El tiempo de retraso en milisegundos (default: 500ms)
 * @returns {T} El valor debounced
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
