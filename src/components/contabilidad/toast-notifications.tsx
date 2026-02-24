'use client'

import { toast } from 'sonner'
import { CheckCircle, XCircle, AlertCircle, Info, DollarSign, ArrowRightLeft } from 'lucide-react'

export interface ToastOptions {
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

// Success notifications
export const showSuccessToast = {
  // Account operations
  accountCreated: (accountName: string, options?: ToastOptions) => {
    toast.success(`Cuenta bancaria "${accountName}" creada exitosamente`, {
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  accountUpdated: (accountName: string, options?: ToastOptions) => {
    toast.success(`Cuenta bancaria "${accountName}" actualizada exitosamente`, {
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  accountDeleted: (accountName: string, options?: ToastOptions) => {
    toast.success(`Cuenta bancaria "${accountName}" eliminada exitosamente`, {
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  // Reconciliation operations
  salesReconciled: (count: number, amount: number, currency: string, options?: ToastOptions) => {
    toast.success(`${count} venta(s) reconciliada(s) por ${amount.toLocaleString()} ${currency}`, {
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
      action: options?.action,
    })
  },

  servicesReconciled: (count: number, amount: number, currency: string, options?: ToastOptions) => {
    toast.success(`${count} servicio(s) reconciliado(s) por ${amount.toLocaleString()} ${currency}`, {
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
      action: options?.action,
    })
  },

  expensesReconciled: (count: number, amount: number, currency: string, options?: ToastOptions) => {
    toast.success(`${count} gasto(s) reconciliado(s) por ${amount.toLocaleString()} ${currency}`, {
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
      action: options?.action,
    })
  },

  // Currency operations
  currencyCreated: (currencyName: string, options?: ToastOptions) => {
    toast.success(`Moneda "${currencyName}" agregada exitosamente`, {
      icon: <DollarSign className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  exchangeRateUpdated: (fromCurrency: string, toCurrency: string, rate: number, options?: ToastOptions) => {
    toast.success(`Tasa de cambio ${fromCurrency}/${toCurrency} actualizada: ${rate}`, {
      icon: <DollarSign className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  currencyConverted: (amount: number, fromCurrency: string, toAmount: number, toCurrency: string, options?: ToastOptions) => {
    toast.success(`Convertido: ${amount} ${fromCurrency} = ${toAmount.toLocaleString()} ${toCurrency}`, {
      icon: <ArrowRightLeft className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  // Transfer operations
  transferCompleted: (amount: number, fromAccount: string, toAccount: string, voucherNumber: string, options?: ToastOptions) => {
    toast.success(`Transferencia completada: ${amount.toLocaleString()} de ${fromAccount} a ${toAccount}`, {
      icon: <ArrowRightLeft className="h-4 w-4" />,
      duration: options?.duration || 6000,
      description: `Comprobante: ${voucherNumber}`,
      action: options?.action,
    })
  },

  voucherGenerated: (voucherNumber: string, options?: ToastOptions) => {
    toast.success(`Comprobante ${voucherNumber} generado exitosamente`, {
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  // Adjustment operations
  adjustmentCreated: (amount: number, accountName: string, type: string, options?: ToastOptions) => {
    const typeText = type === 'ingreso' ? 'Ingreso' : 'Egreso'
    toast.success(`${typeText} de ${amount.toLocaleString()} registrado en ${accountName}`, {
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  // Payment type operations
  paymentTypeCreated: (typeName: string, options?: ToastOptions) => {
    toast.success(`Tipo de pago "${typeName}" creado exitosamente`, {
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  paymentTypeUpdated: (typeName: string, options?: ToastOptions) => {
    toast.success(`Tipo de pago "${typeName}" actualizado exitosamente`, {
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },


}

// Error notifications
export const showErrorToast = {
  // Generic errors
  generic: (message: string, options?: ToastOptions) => {
    toast.error(message, {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
      action: options?.action,
    })
  },

  // Network errors
  networkError: (operation: string, options?: ToastOptions) => {
    toast.error(`Error de conexión al ${operation}`, {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
      description: 'Verifique su conexión a internet e intente nuevamente',
      action: options?.action,
    })
  },

  // Account errors
  accountNotFound: (accountId: string, options?: ToastOptions) => {
    toast.error('Cuenta bancaria no encontrada', {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
      description: `ID: ${accountId}`,
      action: options?.action,
    })
  },

  accountHasMovements: (accountName: string, options?: ToastOptions) => {
    toast.error(`No se puede eliminar la cuenta "${accountName}"`, {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
      description: 'La cuenta tiene movimientos asociados',
      action: options?.action,
    })
  },

  insufficientBalance: (accountName: string, available: number, required: number, currency: string, options?: ToastOptions) => {
    toast.error('Saldo insuficiente', {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
      description: `${accountName}: Disponible ${available.toLocaleString()} ${currency}, Requerido ${required.toLocaleString()} ${currency}`,
      action: options?.action,
    })
  },

  // Currency errors
  invalidExchangeRate: (rate: number, options?: ToastOptions) => {
    toast.error('Tasa de cambio inválida', {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
      description: `La tasa ${rate} debe ser mayor que 0`,
      action: options?.action,
    })
  },

  exchangeRateNotFound: (fromCurrency: string, toCurrency: string, options?: ToastOptions) => {
    toast.error('Tasa de cambio no disponible', {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
      description: `No hay tasa definida para ${fromCurrency}/${toCurrency}`,
      action: options?.action,
    })
  },

  currencyNotFound: (currencyCode: string, options?: ToastOptions) => {
    toast.error(`Moneda "${currencyCode}" no encontrada`, {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
      action: options?.action,
    })
  },

  // Transfer errors
  transferValidationFailed: (reason: string, options?: ToastOptions) => {
    toast.error('Error en validación de transferencia', {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
      description: reason,
      action: options?.action,
    })
  },

  voucherGenerationFailed: (transferId: string, options?: ToastOptions) => {
    toast.error('Error al generar comprobante', {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
      description: `Transferencia ID: ${transferId}`,
      action: options?.action,
    })
  },

  sameAccountTransfer: (options?: ToastOptions) => {
    toast.error('Error en transferencia', {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
      description: 'La cuenta origen y destino deben ser diferentes',
      action: options?.action,
    })
  },

  // Reconciliation errors
  alreadyReconciled: (type: string, id: string, options?: ToastOptions) => {
    toast.error(`${type} ya reconciliado`, {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
      description: `ID: ${id}`,
      action: options?.action,
    })
  },

  reconciliationFailed: (type: string, reason: string, options?: ToastOptions) => {
    toast.error(`Error al reconciliar ${type}`, {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
      description: reason,
      action: options?.action,
    })
  },

  // Validation errors
  validationError: (field: string, message: string, options?: ToastOptions) => {
    toast.error(`Error de validación: ${field}`, {
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
      description: message,
      action: options?.action,
    })
  },
}

// Warning notifications
export const showWarningToast = {
  // Balance warnings
  negativeBalance: (accountName: string, balance: number, currency: string, options?: ToastOptions) => {
    toast.warning(`Saldo negativo en ${accountName}`, {
      icon: <AlertCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
      description: `Saldo actual: ${balance.toLocaleString()} ${currency}`,
      action: options?.action,
    })
  },

  lowBalance: (accountName: string, balance: number, currency: string, threshold: number, options?: ToastOptions) => {
    toast.warning(`Saldo bajo en ${accountName}`, {
      icon: <AlertCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
      description: `Saldo: ${balance.toLocaleString()} ${currency} (Límite: ${threshold.toLocaleString()})`,
      action: options?.action,
    })
  },

  // Exchange rate warnings
  outdatedExchangeRate: (currency: string, lastUpdate: string, options?: ToastOptions) => {
    toast.warning(`Tasa de cambio desactualizada para ${currency}`, {
      icon: <AlertCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
      description: `Última actualización: ${lastUpdate}`,
      action: options?.action,
    })
  },

  significantRateChange: (currency: string, oldRate: number, newRate: number, changePercent: number, options?: ToastOptions) => {
    toast.warning(`Cambio significativo en tasa de ${currency}`, {
      icon: <AlertCircle className="h-4 w-4" />,
      duration: options?.duration || 8000,
      description: `${oldRate} → ${newRate} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`,
      action: options?.action,
    })
  },

  // Transfer warnings
  largeTransfer: (amount: number, currency: string, threshold: number, options?: ToastOptions) => {
    toast.warning('Transferencia de monto elevado', {
      icon: <AlertCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
      description: `Monto: ${amount.toLocaleString()} ${currency} (Límite: ${threshold.toLocaleString()})`,
      action: options?.action,
    })
  },
}

// Info notifications
export const showInfoToast = {
  // Loading states
  loading: (message: string, options?: ToastOptions) => {
    return toast.loading(message, {
      icon: <Info className="h-4 w-4" />,
      duration: options?.duration || Infinity,
    })
  },

  // Exchange rate info
  exchangeRateApplied: (fromCurrency: string, toCurrency: string, rate: number, options?: ToastOptions) => {
    toast.info(`Tasa aplicada: ${fromCurrency}/${toCurrency} = ${rate}`, {
      icon: <Info className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  // General info
  operationQueued: (operation: string, options?: ToastOptions) => {
    toast.info(`${operation} en cola de procesamiento`, {
      icon: <Info className="h-4 w-4" />,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  dataRefreshed: (dataType: string, options?: ToastOptions) => {
    toast.info(`${dataType} actualizado`, {
      icon: <Info className="h-4 w-4" />,
      duration: options?.duration || 3000,
      action: options?.action,
    })
  },
}

// Utility function to dismiss all toasts
export const dismissAllToasts = () => {
  toast.dismiss()
}

// Utility function to dismiss a specific toast
export const dismissToast = (toastId: string | number) => {
  toast.dismiss(toastId)
}