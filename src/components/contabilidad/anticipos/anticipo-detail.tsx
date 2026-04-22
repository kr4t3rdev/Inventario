"use client"

import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Anticipo, AnticipoMovimiento } from "@/app/models/model"
import { cn } from "@/lib/utils"
import { ArrowDownCircle, ArrowUpCircle, Clock, Calendar, User, FileText, RotateCcw, Link2, Receipt, ShoppingCart, DollarSign } from "lucide-react"

interface AnticipoDetailProps {
  anticipo: Anticipo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCerrar?: () => void
  isLoading?: boolean
}

interface MovimientoEnriquecido extends AnticipoMovimiento {
  documentoDestino?: {
    tipo: string
    id: string
    proveedor?: string
    cliente?: string
    servicio?: string
    numeroFactura?: string
    total?: number
    estado?: string
    fecha?: string
  } | null
}

/**
 * @description Muestra el detalle de un anticipo con su historial de movimientos
 * @param {AnticipoDetailProps} props - Props del componente
 */
export function AnticipoDetail({ anticipo, open, onOpenChange, onCerrar, isLoading }: AnticipoDetailProps) {
  if (!anticipo) return <></>

  const movimientos = (anticipo.movimientos || []) as unknown as MovimientoEnriquecido[]

  const getMovimientoIcon = (tipo: string) => {
    switch (tipo) {
      case "CREACION_RESERVA":
        return <Clock className="h-4 w-4 text-blue-500" />
      case "EJECUCION":
        return <ArrowDownCircle className="h-4 w-4 text-green-500" />
      case "REVERSO":
        return <RotateCcw className="h-4 w-4 text-orange-500" />
      case "ANULACION":
        return <ArrowUpCircle className="h-4 w-4 text-red-500" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getDocumentoDestinoIcon = (tipo: string) => {
    switch (tipo) {
      case "Compra de producto":
        return <ShoppingCart className="h-3.5 w-3.5" />
      case "Compra de servicio":
        return <Receipt className="h-3.5 w-3.5" />
      case "Factura":
        return <DollarSign className="h-3.5 w-3.5" />
      default:
        return <Link2 className="h-3.5 w-3.5" />
    }
  }

  const getMovimientoBadge = (tipo: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      CREACION_RESERVA: "outline",
      EJECUCION: "default",
      REVERSO: "outline",
      ANULACION: "destructive",
    }
    return variants[tipo] || "outline"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalle del Anticipo
            <Badge variant={anticipo.tipo === "PAGO" ? "default" : "secondary"}>
              {anticipo.tipo === "PAGO" ? "Pago" : "Cobro"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información Principal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Información General</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">ID</p>
                  <p className="font-mono text-sm">{anticipo.anticipoId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge variant={
                    anticipo.estado === "RESERVADO" ? "outline" :
                    anticipo.estado === "EJECUTADO" ? "default" : "destructive"
                  }>
                    {anticipo.estado}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monto Original</p>
                  <p className="text-lg font-semibold">
                    {anticipo.moneda} {Number(anticipo.montoOriginal).toLocaleString("es-ES")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Disponible</p>
                  <p className={cn(
                    "text-lg font-semibold",
                    Number(anticipo.saldoDisponible) === 0 ? "text-muted-foreground" : "text-green-600"
                  )}>
                    {anticipo.moneda} {Number(anticipo.saldoDisponible).toLocaleString("es-ES")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contrato ID</p>
                  <p className="font-medium">{anticipo.contratoId || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contraparte</p>
                  <p className="font-medium">
                    {anticipo.clienteId || anticipo.proveedorId || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Reserva</p>
                  <p className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {anticipo.fechaReserva ? new Date(anticipo.fechaReserva).toLocaleDateString("es-ES") : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vigencia</p>
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {anticipo.vigenciaHasta 
                      ? new Date(anticipo.vigenciaHasta).toLocaleDateString("es-ES")
                      : "Sin límite"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Historial de Movimientos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Historial de Movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-4">
                  Cargando movimientos...
                </p>
              ) : movimientos.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No hay movimientos registrados
                </p>
              ) : (
                <div className="space-y-3">
                  {movimientos.map((movimiento: MovimientoEnriquecido, index) => (
                    <div
                      key={movimiento.movimientoId || index}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="mt-1">
                        {getMovimientoIcon(movimiento.tipoMovimiento)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <Badge variant={getMovimientoBadge(movimiento.tipoMovimiento)}>
                            {movimiento.tipoMovimiento}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(movimiento.createdAt).toLocaleString("es-ES")}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Monto</p>
                            <p className="font-medium">
                              {movimiento.moneda} {Number(movimiento.monto).toLocaleString("es-ES")}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Saldo Antes</p>
                            <p className="font-medium">
                              {movimiento.moneda} {Number(movimiento.saldoAntes).toLocaleString("es-ES")}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Saldo Después</p>
                            <p className="font-medium">
                              {movimiento.moneda} {Number(movimiento.saldoDespues).toLocaleString("es-ES")}
                            </p>
                          </div>
                          {movimiento.contexto && (
                            <div>
                              <p className="text-muted-foreground">Contexto</p>
                              <p className="font-medium">{movimiento.contexto}</p>
                            </div>
                          )}
                        </div>

                        {/* Documento destino - en qué se gastó */}
                        {movimiento.documentoDestino && (
                          <div className="mt-2 p-2 rounded-md bg-muted/50 border border-border/50">
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              {getDocumentoDestinoIcon(movimiento.documentoDestino.tipo)}
                              Documento destino
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              <p className="font-medium">
                                {movimiento.documentoDestino.tipo}
                              </p>
                              <p className="text-xs font-mono text-muted-foreground">
                                {movimiento.documentoDestino.id.slice(-8)}
                              </p>
                              {movimiento.documentoDestino.proveedor && (
                                <>
                                  <p className="text-muted-foreground">Proveedor</p>
                                  <p>{movimiento.documentoDestino.proveedor}</p>
                                </>
                              )}
                              {movimiento.documentoDestino.cliente && (
                                <>
                                  <p className="text-muted-foreground">Cliente</p>
                                  <p>{movimiento.documentoDestino.cliente}</p>
                                </>
                              )}
                              {movimiento.documentoDestino.servicio && (
                                <>
                                  <p className="text-muted-foreground">Servicio</p>
                                  <p>{movimiento.documentoDestino.servicio}</p>
                                </>
                              )}
                              {movimiento.documentoDestino.numeroFactura && (
                                <>
                                  <p className="text-muted-foreground">Factura</p>
                                  <p>{movimiento.documentoDestino.numeroFactura}</p>
                                </>
                              )}
                              {movimiento.documentoDestino.total && (
                                <>
                                  <p className="text-muted-foreground">Total del documento</p>
                                  <p className="font-medium">
                                    {Number(movimiento.documentoDestino.total).toLocaleString("es-ES")}
                                  </p>
                                </>
                              )}
                              {movimiento.documentoDestino.estado && (
                                <>
                                  <p className="text-muted-foreground">Estado</p>
                                  <Badge variant="outline" className="text-xs">
                                    {movimiento.documentoDestino.estado}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {movimiento.observaciones && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {movimiento.observaciones}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {onCerrar && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={onCerrar}>
                Cerrar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
