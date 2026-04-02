'use client'

import { sileo } from 'sileo'
import { CheckCircle, XCircle, AlertCircle, Info, DollarSign, ArrowRightLeft } from 'lucide-react'

export interface ToastOptions {
  duration?: number
}

// Success notifications
export const showSuccessToast = {
  // Account operations
  accountCreated: (accountName: string, options?: ToastOptions) => {
    sileo.success({
      title: `Cuenta bancaria "${accountName}" creada exitosamente`,
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },

  accountUpdated: (accountName: string, options?: ToastOptions) => {
    sileo.success({
      title: `Cuenta bancaria "${accountName}" actualizada exitosamente`,
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },

  accountDeleted: (accountName: string, options?: ToastOptions) => {
    sileo.success({
      title: `Cuenta bancaria "${accountName}" eliminada exitosamente`,
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },

  // Reconciliation operations
  salesReconciled: (count: number, amount: number, currency: string, options?: ToastOptions) => {
    sileo.success({
      title: `${count} venta(s) reconciliada(s) por ${amount.toLocaleString()} ${currency}`,
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
    })
  },

  servicesReconciled: (count: number, amount: number, currency: string, options?: ToastOptions) => {
    sileo.success({
      title: `${count} servicio(s) reconciliado(s) por ${amount.toLocaleString()} ${currency}`,
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
    })
  },

  expensesReconciled: (count: number, amount: number, currency: string, options?: ToastOptions) => {
    sileo.success({
      title: `${count} gasto(s) reconciliado(s) por ${amount.toLocaleString()} ${currency}`,
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
    })
  },

  // Currency operations
  currencyCreated: (currencyName: string, options?: ToastOptions) => {
    sileo.success({
      title: `Moneda "${currencyName}" agregada exitosamente`,
      icon: <DollarSign className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },

  exchangeRateUpdated: (fromCurrency: string, toCurrency: string, rate: number, options?: ToastOptions) => {
    sileo.success({
      title: `Tasa de cambio ${fromCurrency}/${toCurrency} actualizada: ${rate}`,
      icon: <DollarSign className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },

  currencyConverted: (amount: number, fromCurrency: string, toAmount: number, toCurrency: string, options?: ToastOptions) => {
    sileo.success({
      title: `Convertido: ${amount} ${fromCurrency} = ${toAmount.toLocaleString()} ${toCurrency}`,
      icon: <ArrowRightLeft className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },

  // Transfer operations
  transferCompleted: (amount: number, fromAccount: string, toAccount: string, voucherNumber: string, options?: ToastOptions) => {
    sileo.success({
      title: `Transferencia completada: ${amount.toLocaleString()} de ${fromAccount} a ${toAccount}`,
      description: `Comprobante: ${voucherNumber}`,
      icon: <ArrowRightLeft className="h-4 w-4" />,
      duration: options?.duration || 6000,
    })
  },

  voucherGenerated: (voucherNumber: string, options?: ToastOptions) => {
    sileo.success({
      title: `Comprobante ${voucherNumber} generado exitosamente`,
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },

  // Adjustment operations
  adjustmentCreated: (amount: number, accountName: string, type: string, options?: ToastOptions) => {
    const typeText = type === 'ingreso' ? 'Ingreso' : 'Egreso'
    sileo.success({
      title: `${typeText} de ${amount.toLocaleString()} registrado en ${accountName}`,
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },

  // Payment type operations
  paymentTypeCreated: (typeName: string, options?: ToastOptions) => {
    sileo.success({
      title: `Tipo de pago "${typeName}" creado exitosamente`,
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },

  paymentTypeUpdated: (typeName: string, options?: ToastOptions) => {
    sileo.success({
      title: `Tipo de pago "${typeName}" actualizado exitosamente`,
      icon: <CheckCircle className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },
}

// Error notifications
export const showErrorToast = {
  // Generic errors
  generic: (message: string, options?: ToastOptions) => {
    sileo.error({
      title: message,
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
    })
  },

  // Network errors
  networkError: (operation: string, options?: ToastOptions) => {
    sileo.error({
      title: `Error de conexión al ${operation}`,
      description: 'Verifique su conexión a internet e intente nuevamente',
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
    })
  },

  // Account errors
  accountNotFound: (accountId: string, options?: ToastOptions) => {
    sileo.error({
      title: 'Cuenta bancaria no encontrada',
      description: `ID: ${accountId}`,
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
    })
  },

  accountHasMovements: (accountName: string, options?: ToastOptions) => {
    sileo.error({
      title: `No se puede eliminar la cuenta "${accountName}"`,
      description: 'La cuenta tiene movimientos asociados',
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
    })
  },

  insufficientBalance: (accountName: string, available: number, required: number, currency: string, options?: ToastOptions) => {
    sileo.error({
      title: 'Saldo insuficiente',
      description: `${accountName}: Disponible ${available.toLocaleString()} ${currency}, Requerido ${required.toLocaleString()} ${currency}`,
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
    })
  },

  // Currency errors
  invalidExchangeRate: (rate: number, options?: ToastOptions) => {
    sileo.error({
      title: 'Tasa de cambio inválida',
      description: `La tasa ${rate} debe ser mayor que 0`,
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
    })
  },

  exchangeRateNotFound: (fromCurrency: string, toCurrency: string, options?: ToastOptions) => {
    sileo.error({
      title: 'Tasa de cambio no disponible',
      description: `No hay tasa definida para ${fromCurrency}/${toCurrency}`,
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
    })
  },

  currencyNotFound: (currencyCode: string, options?: ToastOptions) => {
    sileo.error({
      title: `Moneda "${currencyCode}" no encontrada`,
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
    })
  },

  // Transfer errors
  transferValidationFailed: (reason: string, options?: ToastOptions) => {
    sileo.error({
      title: 'Error en validación de transferencia',
      description: reason,
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
    })
  },

  voucherGenerationFailed: (transferId: string, options?: ToastOptions) => {
    sileo.error({
      title: 'Error al generar comprobante',
      description: `Transferencia ID: ${transferId}`,
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
    })
  },

  sameAccountTransfer: (options?: ToastOptions) => {
    sileo.error({
      title: 'Error en transferencia',
      description: 'La cuenta origen y destino deben ser diferentes',
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
    })
  },

  // Reconciliation errors
  alreadyReconciled: (type: string, id: string, options?: ToastOptions) => {
    sileo.error({
      title: `${type} ya reconciliado`,
      description: `ID: ${id}`,
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
    })
  },

  reconciliationFailed: (type: string, reason: string, options?: ToastOptions) => {
    sileo.error({
      title: `Error al reconciliar ${type}`,
      description: reason,
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
    })
  },

  // Validation errors
  validationError: (field: string, message: string, options?: ToastOptions) => {
    sileo.error({
      title: `Error de validación: ${field}`,
      description: message,
      icon: <XCircle className="h-4 w-4" />,
      duration: options?.duration || 5000,
    })
  },
}

// Warning notifications
export const showWarningToast = {
  // Balance warnings
  negativeBalance: (accountName: string, balance: number, currency: string, options?: ToastOptions) => {
    sileo.warning({
      title: `Saldo negativo en ${accountName}`,
      description: `Saldo actual: ${balance.toLocaleString()} ${currency}`,
      icon: <AlertCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
    })
  },

  lowBalance: (accountName: string, balance: number, currency: string, threshold: number, options?: ToastOptions) => {
    sileo.warning({
      title: `Saldo bajo en ${accountName}`,
      description: `Saldo: ${balance.toLocaleString()} ${currency} (Límite: ${threshold.toLocaleString()})`,
      icon: <AlertCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
    })
  },

  // Exchange rate warnings
  outdatedExchangeRate: (currency: string, lastUpdate: string, options?: ToastOptions) => {
    sileo.warning({
      title: `Tasa de cambio desactualizada para ${currency}`,
      description: `Última actualización: ${lastUpdate}`,
      icon: <AlertCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
    })
  },

  significantRateChange: (currency: string, oldRate: number, newRate: number, changePercent: number, options?: ToastOptions) => {
    sileo.warning({
      title: `Cambio significativo en tasa de ${currency}`,
      description: `${oldRate} → ${newRate} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`,
      icon: <AlertCircle className="h-4 w-4" />,
      duration: options?.duration || 8000,
    })
  },

  // Transfer warnings
  largeTransfer: (amount: number, currency: string, threshold: number, options?: ToastOptions) => {
    sileo.warning({
      title: 'Transferencia de monto elevado',
      description: `Monto: ${amount.toLocaleString()} ${currency} (Límite: ${threshold.toLocaleString()})`,
      icon: <AlertCircle className="h-4 w-4" />,
      duration: options?.duration || 6000,
    })
  },
}

// Info notifications
export const showInfoToast = {
  // Loading states
  loading: (message: string, _options?: ToastOptions) => {
    return sileo.info({ title: message })
  },

  // Exchange rate info
  exchangeRateApplied: (fromCurrency: string, toCurrency: string, rate: number, options?: ToastOptions) => {
    sileo.info({
      title: `Tasa aplicada: ${fromCurrency}/${toCurrency} = ${rate}`,
      icon: <Info className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },

  // General info
  operationQueued: (operation: string, options?: ToastOptions) => {
    sileo.info({
      title: `${operation} en cola de procesamiento`,
      icon: <Info className="h-4 w-4" />,
      duration: options?.duration || 4000,
    })
  },

  dataRefreshed: (dataType: string, options?: ToastOptions) => {
    sileo.info({
      title: `${dataType} actualizado`,
      icon: <Info className="h-4 w-4" />,
      duration: options?.duration || 3000,
    })
  },
}

// Utility function to dismiss all toasts
export const dismissAllToasts = () => {
  sileo.clear()
}

// Utility function to dismiss a specific toast
export const dismissToast = (toastId: string | number) => {
  sileo.dismiss(String(toastId))
}
