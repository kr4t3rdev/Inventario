"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle, AlertTriangle, Package, Building2, Store, ArrowRight } from "lucide-react"
import { Transferencia } from "@/app/models/model"

interface ConfirmarRecepcionDialogProps {
  transferencia: Transferencia | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmar: (cantidadesRecibidas: Record<string, number>, tipo: 'total' | 'parcial') => void
  isLoading?: boolean
}

/**
 * @description Diálogo para confirmar la recepción de transferencias
 * @param {ConfirmarRecepcionDialogProps} props - Props del componente
 * @returns {React.ReactElement} Diálogo de confirmación de recepción
 */
export function ConfirmarRecepcionDialog({
  transferencia,
  open,
  onOpenChange,
  onConfirmar,
  isLoading = false,
}: ConfirmarRecepcionDialogProps): React.ReactElement {
  const [cantidadRecibida, setCantidadRecibida] = useState<number>(transferencia?.cantidad || 0)
  const [showDiscrepancia, setShowDiscrepancia] = useState(false)

  // Resetear estado cuando se abre el diálogo
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && transferencia) {
      setCantidadRecibida(transferencia.cantidad)
      setShowDiscrepancia(false)
    }
    onOpenChange(newOpen)
  }

  const handleCantidadChange = (value: string) => {
    const numValue = parseInt(value) || 0
    setCantidadRecibida(numValue)
    
    if (transferencia && numValue < transferencia.cantidad) {
      setShowDiscrepancia(true)
    } else {
      setShowDiscrepancia(false)
    }
  }

  const handleConfirmarTotal = () => {
    if (!transferencia) return
    onConfirmar({ [transferencia.transferenciaId]: transferencia.cantidad }, 'total')
  }

  const handleConfirmarParcial = () => {
    if (!transferencia) return
    if (cantidadRecibida < 0 || cantidadRecibida > (transferencia?.cantidad || 0)) {
      return
    }
    onConfirmar({ [transferencia.transferenciaId]: cantidadRecibida }, 'parcial')
  }

  const getTipoTransferenciaLabel = () => {
    if (!transferencia) return ""
    
    const origenEsAlmacen = transferencia.origenId
    const destinoEsAlmacen = transferencia.destinoId
    
    if (origenEsAlmacen && destinoEsAlmacen) return "Almacén → Almacén"
    if (origenEsAlmacen) return "Almacén → Punto de Venta"
    if (destinoEsAlmacen) return "Punto de Venta → Almacén"
    return "Punto de Venta → Punto de Venta"
  }

  const getIconoOrigen = () => {
    if (!transferencia) return null
    return transferencia.origenId ? <Building2 className="h-4 w-4" /> : <Store className="h-4 w-4" />
  }

  const getIconoDestino = () => {
    if (!transferencia) return null
    return transferencia.destinoId ? <Building2 className="h-4 w-4" /> : <Store className="h-4 w-4" />
  }

  const tieneDiscrepancia = cantidadRecibida !== (transferencia?.cantidad || 0)
  const esParcial = cantidadRecibida < (transferencia?.cantidad || 0)
  const esExcedente = cantidadRecibida > (transferencia?.cantidad || 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Confirmar Recepción de Transferencia
          </DialogTitle>
          <DialogDescription>
            Verifique los productos recibidos y confirme la cantidad.
          </DialogDescription>
        </DialogHeader>

        {transferencia && (
          <div className="space-y-6">
            {/* Información de la transferencia */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">ID:</span>
                <span className="font-mono text-sm">{transferencia.transferenciaId.slice(0, 8)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tipo:</span>
                <Badge variant="outline">{getTipoTransferenciaLabel()}</Badge>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Origen:</span>
                <div className="flex items-center gap-1">
                  {getIconoOrigen()}
                  <span>{transferencia.origen?.nombre || transferencia.puntoDeVentaOrigen?.nombre}</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <div className="flex items-center gap-1">
                  {getIconoDestino()}
                  <span>{transferencia.destino?.nombre || transferencia.puntoDeVentaDestino?.nombre}</span>
                </div>
              </div>
            </div>

            {/* Producto a recibir */}
            <ScrollArea className="border rounded-lg p-4">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Package className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-semibold">{transferencia.producto?.nombre || "Producto"}</h4>
                    <p className="text-sm text-muted-foreground">
                      Cantidad enviada: <span className="font-medium">{transferencia.cantidad}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cantidad-recibida" className="text-sm font-medium">
                    Cantidad Recibida
                  </Label>
                  <Input
                    id="cantidad-recibida"
                    type="number"
                    min={0}
                    max={transferencia.cantidad * 2}
                    value={cantidadRecibida}
                    onChange={(e) => handleCantidadChange(e.target.value)}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ingrese la cantidad realmente recibida. Puede ser menor o igual a la cantidad enviada.
                  </p>
                </div>

                {showDiscrepancia && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-yellow-800">
                        Discrepancia detectada
                      </p>
                      <p className="text-sm text-yellow-700">
                        Se recibieron {cantidadRecibida} unidades de {transferencia.cantidad} enviadas.
                        ({transferencia.cantidad - cantidadRecibida} unidades faltantes)
                      </p>
                      <p className="text-xs text-yellow-600">
                        La transferencia se marcará como PARCIAL.
                      </p>
                    </div>
                  </div>
                )}

                {esExcedente && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        Cantidad excedente
                      </p>
                      <p className="text-sm text-red-700">
                        La cantidad recibida no puede ser mayor a la cantidad enviada.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Resumen */}
            {tieneDiscrepancia && !esExcedente && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-2">Resumen de Recepción</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Enviado:</span>
                    <span className="ml-2 font-medium">{transferencia.cantidad}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Recibido:</span>
                    <span className="ml-2 font-medium">{cantidadRecibida}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Faltante:</span>
                    <span className="ml-2 font-medium text-red-600">
                      {transferencia.cantidad - cantidadRecibida}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Estado:</span>
                    <Badge variant="secondary" className="ml-2">
                      PARCIAL
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          
          {!tieneDiscrepancia ? (
            <Button
              onClick={handleConfirmarTotal}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {isLoading ? "Confirmando..." : "Confirmar Recepción Total"}
            </Button>
          ) : (
            !esExcedente && (
              <Button
                onClick={handleConfirmarParcial}
                disabled={isLoading}
                variant="secondary"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                {isLoading ? "Confirmando..." : "Confirmar Recepción Parcial"}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
