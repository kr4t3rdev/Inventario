"use client"

import { useRef } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { 
  Printer, 
  Building2, 
  Calendar, 
  FileText, 
  DollarSign,
  ArrowRightLeft,
  CheckCircle
} from "lucide-react"
import { useReactToPrint } from "react-to-print"

export interface ComprobanteTransferenciaData {
  transferenciaId: string
  numeroComprobante: string
  fechaTransferencia: string
  cuentaOrigen: {
    nombreBanco: string
    numeroCuenta: string
    tipoCuenta: string
  }
  cuentaDestino: {
    nombreBanco: string
    numeroCuenta: string
    tipoCuenta: string
  }
  montoOrigen: number
  monedaOrigen: string
  montoDestino: number
  monedaDestino: string
  tasaCambio?: number
  motivo: string
  descripcion?: string
  realizadoPor: string
  comprobanteGenerado: boolean
}

interface ComprobanteTransferenciaProps {
  transferencia: ComprobanteTransferenciaData
  isOpen: boolean
  onClose: () => void
}

export function ComprobanteTransferencia({ 
  transferencia, 
  isOpen, 
  onClose 
}: ComprobanteTransferenciaProps) {
  const componentRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Comprobante-Transferencia-${transferencia.numeroComprobante}`,
  })

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ` ${currency}`
  }

  const formatDate = (date: string) => {
    return format(new Date(date), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Comprobante de Transferencia
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Botones de acción */}
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>

          {/* Comprobante */}
          <div ref={componentRef} className="p-8 space-y-6">
            {/* Encabezado */}
            <div className="text-center space-y-2 border-b pb-6">
              <h1 className="text-2xl font-bold">
                COMPROBANTE DE TRANSFERENCIA BANCARIA
              </h1>
              <div className="flex items-center justify-center gap-2">
                <Badge variant="default" className="text-lg px-4 py-1">
                  N° {transferencia.numeroComprobante}
                </Badge>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {formatDate(transferencia.fechaTransferencia)}
              </div>
            </div>

            {/* Estado */}
            <div className="flex justify-center">
              <div className="flex items-center gap-2 px-4 py-2  border border-green-20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700">Transferencia Completada</span>
              </div>
            </div>

            {/* Detalles de las cuentas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Cuenta Origen */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-red-700 border-b border-red-20 pb-2">
                  <Building2 className="h-5 w-5" />
                  CUENTA ORIGEN
                </div>
                <div className="space-y-3 p-4 border border-red-20 rounded-lg">
                  <div>
                    <span className="text-sm text-muted-foreground">Banco:</span>
                    <div className="font-semibold text-lg">{transferencia.cuentaOrigen.nombreBanco}</div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Número de Cuenta:</span>
                    <div className="font-mono text-lg">{transferencia.cuentaOrigen.numeroCuenta}</div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Tipo de Cuenta:</span>
                    <div className="capitalize">{transferencia.cuentaOrigen.tipoCuenta}</div>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Monto Debitado:</span>
                    <div className="text-xl font-bold text-red-600">
                      -{formatCurrency(transferencia.montoOrigen, transferencia.monedaOrigen)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cuenta Destino */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-green-700 border-b border-green-20 pb-2">
                  <Building2 className="h-5 w-5" />
                  CUENTA DESTINO
                </div>
                <div className="space-y-3 p-4 border border-green-20 rounded-lg">
                  <div>
                    <span className="text-sm text-muted-foreground">Banco:</span>
                    <div className="font-semibold text-lg">{transferencia.cuentaDestino.nombreBanco}</div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Número de Cuenta:</span>
                    <div className="font-mono text-lg">{transferencia.cuentaDestino.numeroCuenta}</div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Tipo de Cuenta:</span>
                    <div className="capitalize">{transferencia.cuentaDestino.tipoCuenta}</div>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Monto Acreditado:</span>
                    <div className="text-xl font-bold text-green-600">
                      +{formatCurrency(transferencia.montoDestino, transferencia.monedaDestino)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Conversión de moneda (si aplica) */}
            {transferencia.tasaCambio && transferencia.monedaOrigen !== transferencia.monedaDestino && (
              <div className="p-4 border border-blue-20 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-800">CONVERSIÓN DE MONEDA</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">Monto Original</span>
                    <div className="text-lg font-semibold">
                      {formatCurrency(transferencia.montoOrigen, transferencia.monedaOrigen)}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">Tasa de Cambio</span>
                    <div className="text-lg font-semibold">
                      1 {transferencia.monedaOrigen} = {transferencia.tasaCambio} {transferencia.monedaDestino}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">Monto Convertido</span>
                    <div className="text-lg font-semibold">
                      {formatCurrency(transferencia.montoDestino, transferencia.monedaDestino)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Detalles de la operación */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                <FileText className="h-5 w-5" />
                DETALLES DE LA OPERACIÓN
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <span className="text-sm text-muted-foreground">Motivo de la Transferencia:</span>
                  <div className="font-medium text-lg mt-1">{transferencia.motivo}</div>
                </div>
                {transferencia.descripcion && (
                  <div>
                    <span className="text-sm text-muted-foreground">Descripción Adicional:</span>
                    <div className="mt-1">{transferencia.descripcion}</div>
                  </div>
                )}                
                <div>
                  <span className="text-sm text-muted-foreground">Fecha y Hora:</span>
                  <div className="font-medium mt-1">{formatDate(transferencia.fechaTransferencia)}</div>
                </div>
              </div>
            </div>

            {/* Resumen final */}
            <div className="border-t pt-6">
              <div className="p-6 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <ArrowRightLeft className="h-6 w-6 text-primary" />
                  <span className="text-xl font-bold">RESUMEN DE LA TRANSFERENCIA</span>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-lg">
                    Se transfirió <span className="font-bold text-primary">
                      {formatCurrency(transferencia.montoOrigen, transferencia.monedaOrigen)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    desde {transferencia.cuentaOrigen.nombreBanco} ({transferencia.cuentaOrigen.numeroCuenta})
                  </div>
                  <div className="text-sm text-muted-foreground">
                    hacia {transferencia.cuentaDestino.nombreBanco} ({transferencia.cuentaDestino.numeroCuenta})
                  </div>
                  {transferencia.tasaCambio && (
                    <div className="text-sm text-muted-foreground">
                      Monto acreditado: <span className="font-semibold">
                        {formatCurrency(transferencia.montoDestino, transferencia.monedaDestino)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pie de página */}
            <div className="border-t pt-6 text-center text-sm text-muted-foreground">
              <p>Este comprobante es válido como constancia de la transferencia bancaria realizada.</p>
              <p className="mt-2">
                Comprobante generado automáticamente el {format(new Date(), "dd/MM/yyyy 'a las' HH:mm")}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
