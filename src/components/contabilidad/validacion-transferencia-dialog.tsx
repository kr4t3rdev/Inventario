"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowRightLeft, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  Building2,
  DollarSign
} from "lucide-react"
import { useGetMonedasQuery } from "@/lib/redux/services/contabilidadApi"

interface ValidacionTransferenciaDialogProps {
  isOpen: boolean
  onClose: () => void
  data: {
    cuentaOrigen: { saldo: number; moneda: string; nombreBanco: string; numeroCuenta: string }
    cuentaDestino: { saldo: number; moneda: string; nombreBanco: string; numeroCuenta: string }
    monto: number
    motivo: string
    descripcion?: string
    tasaCambio?: number
    montoConvertido?: number
    saldoSuficiente: boolean
    advertencias?: string[]
  }
  onConfirm: () => void
  isLoading?: boolean
}

export function ValidacionTransferenciaDialog({
  isOpen,
  onClose,
  data,
  onConfirm,
  isLoading = false
}: ValidacionTransferenciaDialogProps) {
  const { data: monedasData = [] } = useGetMonedasQuery()
  
  const {
    cuentaOrigen,
    cuentaDestino,
    monto,
    tasaCambio,
    montoConvertido,
    saldoSuficiente,
    advertencias = []
  } = data

  // Obtener la moneda principal desde la API
  const monedas = Array.isArray(monedasData) 
    ? monedasData 
    : Array.isArray((monedasData as { data?: unknown })?.data) 
    ? (monedasData as { data: unknown[] }).data 
    : Object.values(monedasData ?? [])
  const monedaPrincipal = (monedas as any[]).find((m: any) => m.esPrincipal)?.codigo

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ` ${currency}`
  }

  // Función helper para calcular el monto convertido según la lógica de moneda principal
  const calcularMontoConvertido = React.useCallback(() => {
    if (cuentaOrigen.moneda !== cuentaDestino.moneda) {
      // Si la moneda principal es igual a la cuenta destino: monto * tasaCambio
      return monto * (tasaCambio ?? 0)
    }
    return montoConvertido || monto
  }, [cuentaOrigen.moneda, cuentaDestino.moneda, monto, tasaCambio, montoConvertido])

  const nuevoSaldoOrigen = Number(cuentaOrigen.saldo) - monto
  
  // Calcular nuevo saldo destino según la lógica de conversión de moneda
  const nuevoSaldoDestino = React.useMemo(() => {
    const saldoActualDestino = Number(cuentaDestino.saldo)
    const montoConvertidoCalculado = calcularMontoConvertido()
    return saldoActualDestino + montoConvertidoCalculado
  }, [cuentaDestino.saldo, calcularMontoConvertido])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Confirmar Transferencia Bancaria
          </DialogTitle>
          <DialogDescription>
            Revise los detalles de la transferencia antes de proceder. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {/* Estado de validación */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            {saldoSuficiente ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700">Transferencia válida</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-700">Saldo insuficiente</span>
              </>
            )}
          </div>

          {/* Advertencias */}
          {advertencias.length > 0 && (
            <div className="space-y-2">
              {advertencias.map((advertencia, index) => (
                <div key={index} className="flex items-start gap-2 p-3 border border-yellow-40 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-yellow-800">{advertencia}</span>
                </div>
              ))}
            </div>
          )}

          {/* Detalles de la transferencia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cuenta Origen */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                CUENTA ORIGEN
              </div>
              <div className="space-y-2 p-3 border border-red-20 rounded-lg">
                <div className="font-medium">{cuentaOrigen.nombreBanco}</div>
                <div className="text-sm text-muted-foreground">{cuentaOrigen.numeroCuenta}</div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Saldo actual:</span>
                  <span className="font-medium">{formatCurrency(cuentaOrigen.saldo, cuentaOrigen.moneda)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Monto a transferir:</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(monto, cuentaOrigen.moneda)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Nuevo saldo:</span>
                  <span className={`font-medium ${nuevoSaldoOrigen < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(nuevoSaldoOrigen, cuentaOrigen.moneda)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cuenta Destino */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                CUENTA DESTINO
              </div>
              <div className="space-y-2 p-3 border border-green-20 rounded-lg">
                <div className="font-medium">{cuentaDestino.nombreBanco}</div>
                <div className="text-sm text-muted-foreground">{cuentaDestino.numeroCuenta}</div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Saldo actual:</span>
                  <span className="font-medium">{formatCurrency(cuentaDestino.saldo, cuentaDestino.moneda)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Monto a recibir:</span>
                  <span className="font-medium text-green-600">
                    +{formatCurrency(calcularMontoConvertido(), cuentaDestino.moneda)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Nuevo saldo:</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(nuevoSaldoDestino, cuentaDestino.moneda)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Conversión de moneda */}
          {tasaCambio && (
            <div className="p-4 border border-blue-20 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Conversión de Moneda</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Monto original:</span>
                  <div className="font-medium">{formatCurrency(monto, cuentaOrigen.moneda)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tasa de cambio:</span>
                  <div className="font-medium">1 {cuentaOrigen.moneda} = {tasaCambio} {cuentaDestino.moneda}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Monto convertido:</span>
                  <div className="font-medium">
                    {formatCurrency(calcularMontoConvertido(), cuentaDestino.moneda)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detalles adicionales */}
          {/* <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              DETALLES DE LA TRANSFERENCIA
            </div>
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              <div>
                <span className="text-sm text-muted-foreground">Motivo:</span>
                <div className="font-medium">{motivo}</div>
              </div>
              {descripcion && (
                <div>
                  <span className="text-sm text-muted-foreground">Descripción:</span>
                  <div className="text-sm">{descripcion}</div>
                </div>
              )}
            </div>
          </div> */}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800">
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={!saldoSuficiente || isLoading}
            className="min-w-[120px] bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-all shadow-md hover:shadow-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirmar Transferencia
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}