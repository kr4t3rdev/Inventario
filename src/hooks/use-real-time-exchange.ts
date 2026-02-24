import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface ExchangeRateUpdate {
  monedaOrigenId: string
  tasa: number
  fechaVigencia: string
  creadoPor: string
}

interface RealTimeExchangeConfig {
  pollInterval: number // milliseconds
  enableNotifications: boolean
  autoUpdate: boolean
}

export function useRealTimeExchange(config: RealTimeExchangeConfig = {
  pollInterval: 30000, // 30 seconds
  enableNotifications: true,
  autoUpdate: true
}) {
  const [rates, setRates] = useState<ExchangeRateUpdate[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  const fetchLatestRates = useCallback(async () => {
    try {
      const response = await fetch('/api/contabilidad/exchange/tasas')
      if (!response.ok) throw new Error('Failed to fetch rates')
      
      const newRates = await response.json()
      
      // Check for rate changes
      setRates(prevRates => {
        if (prevRates.length > 0 && config.enableNotifications) {
          const changedRates = newRates.filter((newRate: ExchangeRateUpdate) => {
            const oldRate = prevRates.find(r => r.monedaOrigenId === newRate.monedaOrigenId)
            return oldRate && oldRate.tasa !== newRate.tasa
          })

          if (changedRates.length > 0) {
            toast.success(`Se actualizaron ${changedRates.length} tasa(s) de cambio`)
          }
        }
        return newRates
      })
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
      if (config.enableNotifications) {
        toast.error("No se pudieron obtener las tasas de cambio actualizadas")
      }
    }
  }, [config.enableNotifications])

  const startPolling = useCallback(() => {
    if (isPolling) return

    setIsPolling(true)
    const interval = setInterval(fetchLatestRates, config.pollInterval)

    return () => {
      clearInterval(interval)
      setIsPolling(false)
    }
  }, [fetchLatestRates, config.pollInterval, isPolling])

  const stopPolling = useCallback(() => {
    setIsPolling(false)
  }, [])

  const manualUpdate = useCallback(async () => {
    await fetchLatestRates()
    if (config.enableNotifications) {
      toast.success("Las tasas de cambio han sido actualizadas manualmente")
    }
  }, [fetchLatestRates, config.enableNotifications])

  // Auto-start polling if enabled
  useEffect(() => {
    if (config.autoUpdate) {
      const cleanup = startPolling()
      return cleanup
    }
  }, [config.autoUpdate, startPolling])

  // Initial fetch
  useEffect(() => {
    fetchLatestRates()
  }, [fetchLatestRates])

  return {
    rates,
    lastUpdate,
    isPolling,
    startPolling,
    stopPolling,
    manualUpdate,
    refresh: fetchLatestRates
  }
}

// Hook for exchange rate notifications
export function useExchangeRateNotifications() {
  const [watchedCurrencies, setWatchedCurrencies] = useState<string[]>([])

  const addWatchedCurrency = useCallback((currencyCode: string) => {
    setWatchedCurrencies(prev => 
      prev.includes(currencyCode) ? prev : [...prev, currencyCode]
    )
  }, [])

  const removeWatchedCurrency = useCallback((currencyCode: string) => {
    setWatchedCurrencies(prev => prev.filter(code => code !== currencyCode))
  }, [])

  const notifyRateChange = useCallback((
    currencyCode: string,
    oldRate: number,
    newRate: number
  ) => {
    if (!watchedCurrencies.includes(currencyCode)) return

    const changePercent = ((newRate - oldRate) / oldRate * 100).toFixed(2)
    const isIncrease = newRate > oldRate

    toast(`${isIncrease ? '↗️' : '↘️'} ${oldRate} → ${newRate} (${isIncrease ? '+' : ''}${changePercent}%)`)
  }, [watchedCurrencies])

  return {
    watchedCurrencies,
    addWatchedCurrency,
    removeWatchedCurrency,
    notifyRateChange
  }
}