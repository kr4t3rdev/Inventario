'use client'

import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  AlertTriangle, 
  ArrowRightLeft, 
  DollarSign, 
  CreditCard,
  Calculator,
  FileText,
  Banknote
} from 'lucide-react'

// Base confirmation dialog props
interface BaseConfirmationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onCancel?: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
}

// Base confirmation dialog component
function BaseConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'destructive',
  loading = false,
  children,
}: BaseConfirmationProps & { children?: React.ReactNode }) {
  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader className="pb-2">
          <AlertDialogTitle className="flex items-center gap-2 text-lg">
            {variant === 'destructive' && (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {children && (
          <div className="py-2">
            {children}
          </div>
        )}
        
        <AlertDialogFooter className="pt-2">
          <AlertDialogCancel onClick={handleCancel} disabled={loading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className={variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {loading ? 'Procesando...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Account deletion confirmation
interface DeleteAccountConfirmationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  accountName: string
  accountNumber: string
  currentBalance: number
  currency: string
  hasMovements: boolean
  loading?: boolean
}

export function DeleteAccountConfirmation({
  open,
  onOpenChange,
  onConfirm,
  accountName,
  accountNumber,
  currentBalance,
  currency,
  hasMovements,
  loading = false,
}: DeleteAccountConfirmationProps) {
  return (
    <BaseConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Eliminar Cuenta Bancaria"
      description={
        hasMovements
          ? 'Esta cuenta tiene movimientos asociados y no puede ser eliminada.'
          : 'Esta acción no se puede deshacer. La cuenta será eliminada permanentemente.'
      }
      confirmText={hasMovements ? undefined : 'Eliminar Cuenta'}
      variant="destructive"
      loading={loading}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-gray-500" />
          <span className="font-medium">{accountName}</span>
        </div>
        
        <div className="text-sm text-gray-600">
          <div>Número: {accountNumber}</div>
          <div className="flex items-center gap-2 mt-1">
            Saldo actual: 
            <Badge variant={currentBalance < 0 ? 'destructive' : 'secondary'}>
              {currentBalance.toLocaleString()} {currency}
            </Badge>
          </div>
        </div>

        {hasMovements && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-800 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">No se puede eliminar</span>
            </div>
            <p className="text-red-700 text-sm mt-1">
              La cuenta tiene transacciones, reconciliaciones o transferencias asociadas.
            </p>
          </div>
        )}

        {!hasMovements && currentBalance !== 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center gap-2 text-yellow-800 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Saldo pendiente</span>
            </div>
            <p className="text-yellow-700 text-sm mt-1">
              La cuenta tiene un saldo de {currentBalance.toLocaleString()} {currency}.
            </p>
          </div>
        )}
      </div>
    </BaseConfirmationDialog>
  )
}

// Transfer confirmation
interface TransferConfirmationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  fromAccount: string
  toAccount: string
  amount: number
  fromCurrency: string
  toCurrency?: string
  exchangeRate?: number
  convertedAmount?: number
  reason: string
  loading?: boolean
}

export function TransferConfirmation({
  open,
  onOpenChange,
  onConfirm,
  fromAccount,
  toAccount,
  amount,
  fromCurrency,
  toCurrency,
  exchangeRate,
  convertedAmount,
  reason,
  loading = false,
}: TransferConfirmationProps) {
  const isDifferentCurrency = toCurrency && toCurrency !== fromCurrency

  return (
    <BaseConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Confirmar Transferencia"
      description="Revise los detalles de la transferencia antes de confirmar."
      confirmText="Ejecutar Transferencia"
      loading={loading}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-blue-500" />
            <span className="font-medium text-sm">Transferencia</span>
          </div>
          <Badge variant="outline" className="bg-transparent border-gray-300">
            {amount.toLocaleString()} {fromCurrency}
          </Badge>
        </div>

        <Separator className="my-2" />

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Cuenta origen:</span>
            <span className="font-medium">{fromAccount}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Cuenta destino:</span>
            <span className="font-medium">{toAccount}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Monto:</span>
            <span className="font-medium">
              {amount.toLocaleString()} {fromCurrency}
            </span>
          </div>

          {isDifferentCurrency && exchangeRate && convertedAmount && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600">Tasa de cambio:</span>
                <span className="font-medium">
                  1 {fromCurrency} = {exchangeRate} {toCurrency}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Monto convertido:</span>
                <span className="font-medium text-green-600">
                  {convertedAmount.toLocaleString()} {toCurrency}
                </span>
              </div>
            </>
          )}
          
          <div className="flex justify-between">
            <span className="text-gray-600">Motivo:</span>
            <span className="font-medium">{reason}</span>
          </div>
        </div>

        {isDifferentCurrency && (
          <div className="p-2 bg-blue-50/50 border border-blue-200/50 rounded-md">
            <div className="flex items-center gap-2 text-blue-800 text-xs">
              <DollarSign className="h-3 w-3" />
              <span className="font-medium">Conversión de moneda</span>
            </div>
            <p className="text-blue-700 text-xs mt-0.5">
              Se aplicará la tasa de cambio actual para la conversión.
            </p>
          </div>
        )}
      </div>
    </BaseConfirmationDialog>
  )
}

// Currency conversion confirmation
interface CurrencyConversionConfirmationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  fromAmount: number
  fromCurrency: string
  toAmount: number
  toCurrency: string
  exchangeRate: number
  operation: string
  loading?: boolean
}

export function CurrencyConversionConfirmation({
  open,
  onOpenChange,
  onConfirm,
  fromAmount,
  fromCurrency,
  toAmount,
  toCurrency,
  exchangeRate,
  operation,
  loading = false,
}: CurrencyConversionConfirmationProps) {
  return (
    <BaseConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Confirmar Conversión de Moneda"
      description={`Confirme la tasa de cambio para ${operation}.`}
      confirmText="Aplicar Conversión"
      loading={loading}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold">
                {fromAmount.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">{fromCurrency}</div>
            </div>
            
            <ArrowRightLeft className="h-5 w-5 text-gray-400" />
            
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {toAmount.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">{toCurrency}</div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Tasa de cambio:</span>
            <span className="font-medium">
              1 {fromCurrency} = {exchangeRate} {toCurrency}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Operación:</span>
            <span className="font-medium">{operation}</span>
          </div>
        </div>

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center gap-2 text-yellow-800 text-sm">
            <Calculator className="h-4 w-4" />
            <span className="font-medium">Verificar tasa</span>
          </div>
          <p className="text-yellow-700 text-sm mt-1">
            Asegúrese de que la tasa de cambio sea correcta antes de continuar.
          </p>
        </div>
      </div>
    </BaseConfirmationDialog>
  )
}

// Bulk reconciliation confirmation
interface BulkReconciliationConfirmationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  itemCount: number
  totalAmount: number
  currency: string
  itemType: 'ventas' | 'servicios' | 'gastos'
  accountName: string
  paymentType: string
  loading?: boolean
}

export function BulkReconciliationConfirmation({
  open,
  onOpenChange,
  onConfirm,
  itemCount,
  totalAmount,
  currency,
  itemType,
  accountName,
  paymentType,
  loading = false,
}: BulkReconciliationConfirmationProps) {
  const getItemTypeText = () => {
    switch (itemType) {
      case 'ventas': return 'ventas'
      case 'servicios': return 'servicios'
      case 'gastos': return 'gastos'
      default: return 'elementos'
    }
  }

  const getIcon = () => {
    switch (itemType) {
      case 'ventas': return <Banknote className="h-4 w-4 text-green-500" />
      case 'servicios': return <FileText className="h-4 w-4 text-blue-500" />
      case 'gastos': return <CreditCard className="h-4 w-4 text-red-500" />
      default: return <Calculator className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <BaseConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Confirmar Reconciliación Masiva"
      description={`Se reconciliarán ${itemCount} ${getItemTypeText()} por un total de ${totalAmount.toLocaleString()} ${currency}.`}
      confirmText="Reconciliar Todo"
      loading={loading}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getIcon()}
            <span className="font-medium">Reconciliación Masiva</span>
          </div>
          <Badge variant="secondary">
            {itemCount} {getItemTypeText()}
          </Badge>
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Cantidad:</span>
            <span className="font-medium">{itemCount} {getItemTypeText()}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Monto total:</span>
            <span className="font-medium">
              {totalAmount.toLocaleString()} {currency}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Cuenta destino:</span>
            <span className="font-medium">{accountName}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Tipo de pago:</span>
            <span className="font-medium">{paymentType}</span>
          </div>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center gap-2 text-blue-800 text-sm">
            <Calculator className="h-4 w-4" />
            <span className="font-medium">Reconciliación automática</span>
          </div>
          <p className="text-blue-700 text-sm mt-1">
            Todos los {getItemTypeText()} seleccionados se reconciliarán con la misma cuenta y tipo de pago.
          </p>
        </div>
      </div>
    </BaseConfirmationDialog>
  )
}

// Negative balance warning
interface NegativeBalanceWarningProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  accountName: string
  currentBalance: number
  operationAmount: number
  resultingBalance: number
  currency: string
  operation: string
  loading?: boolean
}

export function NegativeBalanceWarning({
  open,
  onOpenChange,
  onConfirm,
  accountName,
  currentBalance,
  operationAmount,
  resultingBalance,
  currency,
  operation,
  loading = false,
}: NegativeBalanceWarningProps) {
  return (
    <BaseConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Advertencia: Saldo Negativo"
      description="Esta operación resultará en un saldo negativo. ¿Desea continuar?"
      confirmText="Continuar de Todas Formas"
      variant="destructive"
      loading={loading}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-gray-500" />
          <span className="font-medium">{accountName}</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Saldo actual:</span>
            <Badge variant={currentBalance < 0 ? 'destructive' : 'secondary'}>
              {currentBalance.toLocaleString()} {currency}
            </Badge>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Operación:</span>
            <span className="font-medium">{operation}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Monto:</span>
            <span className="font-medium">
              {operationAmount.toLocaleString()} {currency}
            </span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between">
            <span className="text-gray-600">Saldo resultante:</span>
            <Badge variant="destructive">
              {resultingBalance.toLocaleString()} {currency}
            </Badge>
          </div>
        </div>

        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2 text-red-800 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">Saldo insuficiente</span>
          </div>
          <p className="text-red-700 text-sm mt-1">
            La cuenta quedará con saldo negativo después de esta operación.
          </p>
        </div>
      </div>
    </BaseConfirmationDialog>
  )
}