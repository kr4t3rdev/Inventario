"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  CheckCircle2,
  DollarSign,
  Calendar,
  Building2,
  CreditCard,
  FileText
} from "lucide-react"
import type { ReconciliacionVenta, ReconciliacionServicio } from "@/app/models/model"

type ReconciliacionBase = ReconciliacionVenta | ReconciliacionServicio

interface ResumenReconciliacionProps {
  reconciliaciones: ReconciliacionBase[]
  tipo?: 'ventas' | 'servicios'
  onClose?: () => void
  titulo?: string
}

const MONEDA_SIMBOLOS: Record<string, string> = {
  CUP: "CUP",
  USD: "$",
  EUR: "€",
}

export function ResumenReconciliacion({
  reconciliaciones,
  tipo = 'ventas',
  onClose,
  titulo = "Resumen de Reconciliación"
}: ResumenReconciliacionProps) {

  const formatCurrency = (amount: number | string, currency: string = "CUP") => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    const symbol = MONEDA_SIMBOLOS[currency] || currency
    return `${symbol} ${numAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate totals by currency
  const totalesPorMoneda = (reconciliaciones || []).reduce((acc, rec) => {
    const moneda = rec.moneda
    if (!acc[moneda]) {
      acc[moneda] = {
        monto: 0,
        cantidad: 0
      }
    }
    const monto = typeof rec.monto === 'string' ? parseFloat(rec.monto) : rec.monto
    acc[moneda].monto += monto
    acc[moneda].cantidad += 1
    return acc
  }, {} as Record<string, { monto: number; cantidad: number }>)

  // Calculate totals by account
  const totalesPorCuenta = (reconciliaciones || []).reduce((acc, rec) => {
    const cuentaId = rec.cuentaId
    const nombreCuenta = rec.cuentaBancaria?.nombreBanco || `Cuenta ${cuentaId.slice(-8)}`

    if (!acc[cuentaId]) {
      acc[cuentaId] = {
        nombre: nombreCuenta,
        numeroCuenta: rec.cuentaBancaria?.numeroCuenta || "",
        monto: 0,
        cantidad: 0,
        moneda: rec.cuentaBancaria?.moneda || "CUP"
      }
    }

    // Convert to account currency if needed
    const montoEnCuentaMoneda = rec.montoConvertido || rec.monto
    const monto = typeof montoEnCuentaMoneda === 'string' ? parseFloat(montoEnCuentaMoneda) : montoEnCuentaMoneda
    acc[cuentaId].monto += monto
    acc[cuentaId].cantidad += 1
    return acc
  }, {} as Record<string, { nombre: string; numeroCuenta: string; monto: number; cantidad: number; moneda: string }>)

  // Calculate totals by payment type
  const totalesPorTipoPago = (reconciliaciones || []).reduce((acc, rec) => {
    const tipoId = rec.tipoPagoId
    const nombreTipo = rec.tipoPago?.nombre || `Tipo ${tipoId.slice(-8)}`

    if (!acc[tipoId]) {
      acc[tipoId] = {
        nombre: nombreTipo,
        monto: 0,
        cantidad: 0
      }
    }

    const monto = typeof rec.monto === 'string' ? parseFloat(rec.monto) : rec.monto
    acc[tipoId].monto += monto
    acc[tipoId].cantidad += 1
    return acc
  }, {} as Record<string, { nombre: string; monto: number; cantidad: number }>)

  const totalReconciliaciones = (reconciliaciones || []).length
  const fechaReconciliacion = (reconciliaciones || [])[0]?.fechaReconciliacion

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            {titulo}
          </CardTitle>
          <Badge variant="default" className="gap-1">
            <FileText className="h-3 w-3" />
            {totalReconciliaciones} reconciliaciones
          </Badge>
        </div>
        {fechaReconciliacion && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Procesado el {formatDate(fechaReconciliacion)}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Totales por Moneda */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Totales por Moneda
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(totalesPorMoneda).map(([moneda, datos]: [string, { monto: number; cantidad: number }]) => (
              <Card key={moneda} className="">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {datos.cantidad} {tipo === 'servicios' ? 'servicios' : 'ventas'} en {moneda}
                      </p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(datos.monto, moneda)}
                      </p>
                    </div>
                    <Badge variant="secondary">{moneda}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* Totales por Cuenta Bancaria */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Distribución por Cuenta Bancaria
          </h3>
          <div className="space-y-3">
            {Object.entries(totalesPorCuenta).map(([cuentaId, datos]: [string, { nombre: string; numeroCuenta: string; monto: number; cantidad: number; moneda: string }]) => (
              <Card key={cuentaId} className="">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium">{datos.nombre}</span>
                        <Badge variant="outline" className="text-xs">
                          {datos.numeroCuenta}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {datos.cantidad} reconciliaciones
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">
                        {formatCurrency(datos.monto, datos.moneda)}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {datos.moneda}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* Totales por Tipo de Pago */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Distribución por Tipo de Pago
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(totalesPorTipoPago).map(([tipoId, datos]: [string, { nombre: string; monto: number; cantidad: number }]) => (
              <Card key={tipoId} className="">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span className="font-medium">{datos.nombre}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {datos.cantidad} transacciones
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">
                        {formatCurrency(datos.monto)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Detalles de Reconciliaciones */}
        {(reconciliaciones || []).length <= 10 && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Detalle de Reconciliaciones
              </h3>
              <div className="space-y-2">
                {(reconciliaciones || []).map((rec, index) => {
                  // Type-safe way to get the reference ID
                  const getReferenciaId = (reconciliacion: ReconciliacionBase) => {
                    if ('ventaId' in reconciliacion) {
                      return (reconciliacion as ReconciliacionVenta).venta?.ventaId?.slice(-8) || `Venta ${index + 1}`
                    } else if ('ventaServicioId' in reconciliacion) {
                      return (reconciliacion as ReconciliacionServicio).ventaServicioId?.slice(-8) || `Servicio ${index + 1}`
                    }
                    return `Item ${index + 1}`
                  }

                  return (
                    <div key={rec.reconciliacionId || index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {getReferenciaId(rec)}
                        </Badge>
                        <span className="text-sm">
                          {rec.cuentaBancaria?.nombreBanco || "Cuenta"}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {rec.tipoPago?.nombre || "Tipo de pago"}
                        </Badge>
                        {/* Mostrar idTransferencia si existe */}
                        {(rec as any).idTransferencia && (
                          <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                            Ref: {(rec as any).idTransferencia}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(rec.monto, rec.moneda)}
                        </p>
                        {rec.tasaCambio && rec.montoConvertido && (
                          <p className="text-xs text-muted-foreground">
                            → {formatCurrency(rec.montoConvertido, rec.cuentaBancaria?.moneda || "CUP")}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {onClose && (
          <div className="flex justify-end pt-4">
            <Button onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}