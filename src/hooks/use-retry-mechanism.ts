'use client'

import { useState, useCallback, useRef } from 'react'
import { showErrorToast, showWarningToast, showInfoToast } from '@/components/contabilidad/toast-notifications'

export interface RetryConfig {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryCondition?: (error: Error) => boolean
  onRetry?: (attempt: number, error: Error) => void
  onMaxAttemptsReached?: (error: Error) => void
}

export interface RetryState {
  attempts: number
  isRetrying: boolean
  lastError: Error | null
  canRetry: boolean
}

export interface UseRetryMechanismReturn {
  retryState: RetryState
  executeWithRetry: <T>(
    operation: () => Promise<T>,
    config?: RetryConfig
  ) => Promise<T>
  manualRetry: () => Promise<void>
  resetRetry: () => void
}

const defaultConfig: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryCondition: (error: Error) => {
    // Retry on network errors, timeout errors, and server errors
    const message = error.message.toLowerCase()
    return (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    )
  },
  onRetry: () => {},
  onMaxAttemptsReached: () => {},
}

export function useRetryMechanism(): UseRetryMechanismReturn {
  const [retryState, setRetryState] = useState<RetryState>({
    attempts: 0,
    isRetrying: false,
    lastError: null,
    canRetry: true,
  })

  const lastOperationRef = useRef<{
    operation: () => Promise<any>
    config: Required<RetryConfig>
  } | null>(null)

  const resetRetry = useCallback(() => {
    setRetryState({
      attempts: 0,
      isRetrying: false,
      lastError: null,
      canRetry: true,
    })
    lastOperationRef.current = null
  }, [])

  const delay = useCallback((ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms))
  }, [])

  const calculateDelay = useCallback((attempt: number, config: Required<RetryConfig>): number => {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)
    return Math.min(exponentialDelay, config.maxDelay)
  }, [])

  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    userConfig: RetryConfig = {}
  ): Promise<T> => {
    const config = { ...defaultConfig, ...userConfig }
    lastOperationRef.current = { operation, config }

    setRetryState(prev => ({
      ...prev,
      attempts: 0,
      isRetrying: false,
      lastError: null,
      canRetry: true,
    }))

    let lastError: Error

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        setRetryState(prev => ({
          ...prev,
          attempts: attempt,
          isRetrying: attempt > 1,
        }))

        if (attempt > 1) {
          const delayMs = calculateDelay(attempt - 1, config)
          
          showInfoToast.loading(`Reintentando operación... (${attempt}/${config.maxAttempts})`)
          
          await delay(delayMs)
          
          config.onRetry(attempt, lastError!)
        }

        const result = await operation()

        // Success - reset state
        setRetryState(prev => ({
          ...prev,
          isRetrying: false,
          lastError: null,
        }))

        return result

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        setRetryState(prev => ({
          ...prev,
          lastError,
          isRetrying: false,
        }))

        // Check if we should retry this error
        if (!config.retryCondition(lastError)) {
          setRetryState(prev => ({
            ...prev,
            canRetry: false,
          }))
          
          // Don't retry this type of error
          throw lastError
        }

        // If this is the last attempt, don't continue
        if (attempt === config.maxAttempts) {
          setRetryState(prev => ({
            ...prev,
            canRetry: false,
          }))
          
          config.onMaxAttemptsReached(lastError)
          
          // Show specific error messages based on error type
          if (lastError.message.includes('exchange') || lastError.message.includes('currency')) {
            showErrorToast.exchangeRateNotFound('', '', {
              action: {
                label: 'Reintentar',
                onClick: () => {
                  void manualRetry()
                },
              },
            })
          } else if (lastError.message.includes('transfer') || lastError.message.includes('transferencia')) {
            showErrorToast.transferValidationFailed(lastError.message, {
              action: {
                label: 'Reintentar',
                onClick: () => {
                  void manualRetry()
                },
              },
            })
          } else {
            showErrorToast.networkError('completar la operación', {
              action: {
                label: 'Reintentar',
                onClick: () => {
                  void manualRetry()
                },
              },
            })
          }
          
          throw lastError
        }

        // Show warning for retry
        if (attempt < config.maxAttempts) {
          const nextDelay = calculateDelay(attempt, config)
          showWarningToast.outdatedExchangeRate(
            'operación',
            `Reintentando en ${Math.round(nextDelay / 1000)} segundos...`
          )
        }
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError!
  }, [calculateDelay, delay])

  const manualRetry = useCallback(async (): Promise<void> => {
    if (!lastOperationRef.current || retryState.isRetrying) {
      return
    }

    const { operation, config } = lastOperationRef.current

    try {
      await executeWithRetry(operation, config)
    } catch (error) {
      // Error is already handled in executeWithRetry
      console.error('Manual retry failed:', error)
    }
  }, [executeWithRetry, retryState.isRetrying])

  return {
    retryState,
    executeWithRetry,
    manualRetry,
    resetRetry,
  }
}

// Predefined retry configurations for different operations
export const RETRY_CONFIGS = {
  // Network operations - more aggressive retry
  NETWORK_OPERATION: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 1.5,
  },

  // Exchange rate operations - moderate retry with specific conditions
  EXCHANGE_RATE_OPERATION: {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 6000,
    backoffMultiplier: 2,
    retryCondition: (error: Error) => {
      const message = error.message.toLowerCase()
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('rate') ||
        message.includes('exchange')
      )
    },
  },

  // Transfer operations - conservative retry
  TRANSFER_OPERATION: {
    maxAttempts: 2,
    baseDelay: 3000,
    maxDelay: 5000,
    backoffMultiplier: 1.5,
    retryCondition: (error: Error) => {
      const message = error.message.toLowerCase()
      // Only retry on network errors, not validation errors
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503')
      )
    },
  },

  // Voucher generation - specific retry for file operations
  VOUCHER_GENERATION: {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    retryCondition: (error: Error) => {
      const message = error.message.toLowerCase()
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('file') ||
        message.includes('pdf') ||
        message.includes('generation')
      )
    },
  },

  // Database operations - quick retry
  DATABASE_OPERATION: {
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    retryCondition: (error: Error) => {
      const message = error.message.toLowerCase()
      return (
        message.includes('connection') ||
        message.includes('timeout') ||
        message.includes('deadlock') ||
        message.includes('lock')
      )
    },
  },
} as const