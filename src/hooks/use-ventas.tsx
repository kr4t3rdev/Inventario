"use client"
import { useState, useEffect } from "react"

export function useVentas() {
  const [data, setData] = useState<any[] | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const token = sessionStorage.getItem('token');
        const response = await fetch("/api/ventas", {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`)
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, isLoading, error }
}
