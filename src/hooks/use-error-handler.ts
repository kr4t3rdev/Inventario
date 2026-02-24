'use client'

import { useCallback } from 'react'
import { showErrorToast } from '@/components/contabilidad/toast-notifications'

export interface ErrorContext {
  operation: string
  component?: string
  userId?: string
  timestamp?: Date
  additionalData?: Record<string, any>
}

export interface ErrorHandlerOptions {
  showToast?: boolean
  logError?: boolean
  retryAction?: () => void
  fallbackAction?: () => void
}

export interface UseErrorHandlerReturn {
  handleError: (error: Error | unknown, context: ErrorContext, options?: ErrorHandlerOptions) => void
  handleApiError: (error: any, operation: string, options?: ErrorHandlerOptions) => void
  handleValidationError: (errors: Record<string, string>, options?: ErrorHandlerOptions) => void
  handleNetworkError: (operation: string, options?: ErrorHandlerOptions) => void
  handleCurrencyError: (error: Error, operation: string, options?: ErrorHandlerOptions) => void
  handleTransferError: (error: Error, operation: string, options?: ErrorHandlerOptions) => void
}

// Error type detection utilities
const isNetworkError = (error: Error): boolean => {
  const message = error.message.toLowerCase()
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    error.name === 'NetworkError' ||
    error.name === 'TypeError'
  )
}

const isCurrencyError = (error: Error): boolean => {
  const message = error.message.toLowerCase()
  return (
    message.includes('currency') ||
    message.includes('exchange') ||
    message.includes('rate') ||
    message.includes('conversion') ||
    message.includes('moneda') ||
    message.includes('tasa')
  )
}

const isTransferError = (error: Error): boolean => {
  const message = error.message.toLowerCase()
  return (
    message.includes('transfer') ||
    message.includes('transferencia') ||
    message.includes('voucher') ||
    message.includes('comprobante') ||
    message.includes('balance') ||
    message.includes('saldo')
  )
}

const isValidationError = (error: Error): boolean => {
  const message = error.message.toLowerCase()
  return (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required') ||
    message.includes('validación') ||
    message.includes('inválido') ||
    message.includes('requerido')
  )
}

const isAuthError = (error: Error): boolean => {
  const message = error.message.toLowerCase()
  return (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('authentication') ||
    message.includes('token') ||
    message.includes('session')
  )
}

// Extract error details from different error types
const extractErrorDetails = (error: any): { message: string; code?: string; details?: any } => {
  if (typeof error === 'string') {
    return { message: error }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as any).code,
      details: (error as any).details,
    }
  }

  // API error response
  if (error?.response?.data) {
    return {
      message: error.response.data.error || error.response.data.message || 'Error desconocido',
      code: error.response.data.code,
      details: error.response.data.details,
    }
  }

  // RTK Query error
  if (error?.data) {
    return {
      message: error.data.error || error.data.message || 'Error desconocido',
      code: error.data.code,
      details: error.data.details,
    }
  }

  return {
    message: error?.message || 'Error desconocido',
    code: error?.code,
    details: error,
  }
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const logError = useCallback((error: Error, context: ErrorContext) => {
    const errorLog = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server',
    }

    console.error('Error logged:', errorLog)

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error reporting service
      // errorReportingService.captureException(error, errorLog)
    }
  }, [])

  const handleError = useCallback((
    error: Error | unknown,
    context: ErrorContext,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      logError: shouldLog = true,
      retryAction,
      fallbackAction,
    } = options

    const errorObj = error instanceof Error ? error : new Error(String(error))
    const { message, code, details } = extractErrorDetails(error)

    // Log error if requested
    if (shouldLog) {
      logError(errorObj, context)
    }

    // Show appropriate toast notification
    if (showToast) {
      const toastOptions = {
        action: retryAction ? {
          label: 'Reintentar',
          onClick: retryAction,
        } : undefined,
      }

      if (isNetworkError(errorObj)) {
        showErrorToast.networkError(context.operation, toastOptions)
      } else if (isCurrencyError(errorObj)) {
        if (message.includes('rate') || message.includes('tasa')) {
          showErrorToast.exchangeRateNotFound('', '', toastOptions)
        } else {
          showErrorToast.currencyNotFound(details?.currency || 'desconocida', toastOptions)
        }
      } else if (isTransferError(errorObj)) {
        if (message.includes('balance') || message.includes('saldo')) {
          showErrorToast.insufficientBalance(
            details?.accountName || 'Cuenta',
            details?.available || 0,
            details?.required || 0,
            details?.currency || 'CUP',
            toastOptions
          )
        } else if (message.includes('voucher') || message.includes('comprobante')) {
          showErrorToast.voucherGenerationFailed(details?.transferId || '', toastOptions)
        } else {
          showErrorToast.transferValidationFailed(message, toastOptions)
        }
      } else if (isValidationError(errorObj)) {
        showErrorToast.validationError(details?.field || 'Campo', message, toastOptions)
      } else if (isAuthError(errorObj)) {
        showErrorToast.generic('Sesión expirada. Por favor inicie sesión nuevamente.', toastOptions)
      } else {
        showErrorToast.generic(message, toastOptions)
      }
    }

    // Execute fallback action if provided
    if (fallbackAction) {
      fallbackAction()
    }
  }, [logError])

  const handleApiError = useCallback((
    error: any,
    operation: string,
    options: ErrorHandlerOptions = {}
  ) => {
    const { message, code, details } = extractErrorDetails(error)
    
    // Create context for API errors
    const context: ErrorContext = {
      operation,
      component: 'API',
      timestamp: new Date(),
      additionalData: {
        statusCode: error?.status || error?.response?.status,
        endpoint: error?.config?.url || error?.endpoint,
        method: error?.config?.method || error?.method,
        code,
        details,
      },
    }

    const errorObj = new Error(message)
    handleError(errorObj, context, options)
  }, [handleError])

  const handleValidationError = useCallback((
    errors: Record<string, string>,
    options: ErrorHandlerOptions = {}
  ) => {
    const firstError = Object.entries(errors)[0]
    if (!firstError) return

    const [field, message] = firstError
    const context: ErrorContext = {
      operation: 'Validación de formulario',
      component: 'Form',
      timestamp: new Date(),
      additionalData: { allErrors: errors, field },
    }

    const errorObj = new Error(message)
    handleError(errorObj, context, {
      ...options,
      showToast: options.showToast !== false,
    })
  }, [handleError])

  const handleNetworkError = useCallback((
    operation: string,
    options: ErrorHandlerOptions = {}
  ) => {
    const context: ErrorContext = {
      operation,
      component: 'Network',
      timestamp: new Date(),
    }

    const errorObj = new Error('Error de conexión de red')
    handleError(errorObj, context, options)
  }, [handleError])

  const handleCurrencyError = useCallback((
    error: Error,
    operation: string,
    options: ErrorHandlerOptions = {}
  ) => {
    const context: ErrorContext = {
      operation: `Operación de moneda: ${operation}`,
      component: 'Currency',
      timestamp: new Date(),
      additionalData: {
        errorType: 'currency',
        originalError: error.message,
      },
    }

    handleError(error, context, options)
  }, [handleError])

  const handleTransferError = useCallback((
    error: Error,
    operation: string,
    options: ErrorHandlerOptions = {}
  ) => {
    const context: ErrorContext = {
      operation: `Transferencia bancaria: ${operation}`,
      component: 'Transfer',
      timestamp: new Date(),
      additionalData: {
        errorType: 'transfer',
        originalError: error.message,
      },
    }

    handleError(error, context, options)
  }, [handleError])

  return {
    handleError,
    handleApiError,
    handleValidationError,
    handleNetworkError,
    handleCurrencyError,
    handleTransferError,
  }
}

// Predefined error contexts for common operations
export const ERROR_CONTEXTS = {
  ACCOUNT_CREATE: 'Crear cuenta bancaria',
  ACCOUNT_UPDATE: 'Actualizar cuenta bancaria',
  ACCOUNT_DELETE: 'Eliminar cuenta bancaria',
  ACCOUNT_FETCH: 'Obtener cuentas bancarias',
  
  SALES_RECONCILE: 'Reconciliar ventas',
  SERVICES_RECONCILE: 'Reconciliar servicios',
  EXPENSES_RECONCILE: 'Reconciliar gastos',
  
  CURRENCY_CREATE: 'Crear moneda',
  EXCHANGE_RATE_UPDATE: 'Actualizar tasa de cambio',
  CURRENCY_CONVERT: 'Convertir moneda',
  
  TRANSFER_CREATE: 'Crear transferencia',
  TRANSFER_VALIDATE: 'Validar transferencia',
  VOUCHER_GENERATE: 'Generar comprobante',
  
  ADJUSTMENT_CREATE: 'Crear ajuste bancario',
  
  REPORT_GENERATE: 'Generar reporte',
  REPORT_EXPORT: 'Exportar reporte',
  
  PAYMENT_TYPE_CREATE: 'Crear tipo de pago',
  PAYMENT_TYPE_UPDATE: 'Actualizar tipo de pago',
} as const