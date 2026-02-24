'use client'

import { useState, useCallback, useRef } from 'react'
import { showInfoToast, dismissToast } from '@/components/contabilidad/toast-notifications'

export interface LoadingState {
  isLoading: boolean
  error: string | null
  data: any
}

export interface LoadingStates {
  [key: string]: LoadingState
}

export interface UseLoadingStatesReturn {
  loadingStates: LoadingStates
  setLoading: (key: string, loading: boolean, message?: string) => void
  setError: (key: string, error: string | null) => void
  setData: (key: string, data: any) => void
  clearState: (key: string) => void
  clearAllStates: () => void
  isAnyLoading: boolean
  getLoadingState: (key: string) => LoadingState
  executeWithLoading: <T>(
    key: string,
    operation: () => Promise<T>,
    options?: {
      loadingMessage?: string
      successMessage?: string
      errorMessage?: string
      showToast?: boolean
    }
  ) => Promise<T | null>
}

const defaultLoadingState: LoadingState = {
  isLoading: false,
  error: null,
  data: null,
}

export function useLoadingStates(): UseLoadingStatesReturn {
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({})
  const toastRefs = useRef<{ [key: string]: string | number }>({})

  const setLoading = useCallback((key: string, loading: boolean, message?: string) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key] || defaultLoadingState,
        isLoading: loading,
        error: loading ? null : prev[key]?.error || null,
      }
    }))

    // Handle loading toast
    if (loading && message) {
      const toastId = showInfoToast.loading(message)
      toastRefs.current[key] = toastId
    } else if (!loading && toastRefs.current[key]) {
      dismissToast(toastRefs.current[key])
      delete toastRefs.current[key]
    }
  }, [])

  const setError = useCallback((key: string, error: string | null) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key] || defaultLoadingState,
        isLoading: false,
        error,
      }
    }))

    // Dismiss loading toast if exists
    if (toastRefs.current[key]) {
      dismissToast(toastRefs.current[key])
      delete toastRefs.current[key]
    }
  }, [])

  const setData = useCallback((key: string, data: any) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key] || defaultLoadingState,
        isLoading: false,
        error: null,
        data,
      }
    }))

    // Dismiss loading toast if exists
    if (toastRefs.current[key]) {
      dismissToast(toastRefs.current[key])
      delete toastRefs.current[key]
    }
  }, [])

  const clearState = useCallback((key: string) => {
    setLoadingStates(prev => {
      const newStates = { ...prev }
      delete newStates[key]
      return newStates
    })

    // Dismiss loading toast if exists
    if (toastRefs.current[key]) {
      dismissToast(toastRefs.current[key])
      delete toastRefs.current[key]
    }
  }, [])

  const clearAllStates = useCallback(() => {
    setLoadingStates({})
    
    // Dismiss all loading toasts
    Object.values(toastRefs.current).forEach(toastId => {
      dismissToast(toastId)
    })
    toastRefs.current = {}
  }, [])

  const isAnyLoading = Object.values(loadingStates).some(state => state.isLoading)

  const getLoadingState = useCallback((key: string): LoadingState => {
    return loadingStates[key] || defaultLoadingState
  }, [loadingStates])

  const executeWithLoading = useCallback(async <T>(
    key: string,
    operation: () => Promise<T>,
    options: {
      loadingMessage?: string
      successMessage?: string
      errorMessage?: string
      showToast?: boolean
    } = {}
  ): Promise<T | null> => {
    const {
      loadingMessage = 'Procesando...',
      successMessage,
      errorMessage,
      showToast = true,
    } = options

    try {
      setLoading(key, true, showToast ? loadingMessage : undefined)
      
      const result = await operation()
      
      setData(key, result)
      
      if (showToast && successMessage) {
        // Success toast would be handled by the calling component
        // since it might need specific success toast types
      }
      
      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
      setError(key, errorMsg)
      
      if (showToast && errorMessage) {
        // Error toast would be handled by the calling component
        // since it might need specific error toast types
      }
      
      return null
    }
  }, [setLoading, setData, setError])

  return {
    loadingStates,
    setLoading,
    setError,
    setData,
    clearState,
    clearAllStates,
    isAnyLoading,
    getLoadingState,
    executeWithLoading,
  }
}

// Predefined loading keys for consistency
export const LOADING_KEYS = {
  // Account operations
  ACCOUNTS_FETCH: 'accounts_fetch',
  ACCOUNT_CREATE: 'account_create',
  ACCOUNT_UPDATE: 'account_update',
  ACCOUNT_DELETE: 'account_delete',
  
  // Reconciliation operations
  SALES_FETCH: 'sales_fetch',
  SALES_RECONCILE: 'sales_reconcile',
  SERVICES_FETCH: 'services_fetch',
  SERVICES_RECONCILE: 'services_reconcile',
  EXPENSES_FETCH: 'expenses_fetch',
  EXPENSES_RECONCILE: 'expenses_reconcile',
  
  // Exchange operations
  CURRENCIES_FETCH: 'currencies_fetch',
  CURRENCY_CREATE: 'currency_create',
  EXCHANGE_RATES_FETCH: 'exchange_rates_fetch',
  EXCHANGE_RATE_UPDATE: 'exchange_rate_update',
  CURRENCY_CONVERT: 'currency_convert',
  
  // Transfer operations
  TRANSFERS_FETCH: 'transfers_fetch',
  TRANSFER_CREATE: 'transfer_create',
  TRANSFER_VALIDATE: 'transfer_validate',
  VOUCHER_GENERATE: 'voucher_generate',
  VOUCHER_DOWNLOAD: 'voucher_download',
  
  // Adjustment operations
  ADJUSTMENTS_FETCH: 'adjustments_fetch',
  ADJUSTMENT_CREATE: 'adjustment_create',
  
  // Report operations
  REPORTS_FETCH: 'reports_fetch',
  REPORT_EXPORT: 'report_export',
  
  // Payment type operations
  PAYMENT_TYPES_FETCH: 'payment_types_fetch',
  PAYMENT_TYPE_CREATE: 'payment_type_create',
  PAYMENT_TYPE_UPDATE: 'payment_type_update',
} as const

export type LoadingKey = typeof LOADING_KEYS[keyof typeof LOADING_KEYS]