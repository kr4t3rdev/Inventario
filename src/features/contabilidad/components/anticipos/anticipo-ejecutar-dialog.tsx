"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, Loader2, Info } from "lucide-react"
import { toast } from "sonner"
import { executeAnticipoAction } from "@/features/contabilidad/actions-anticipos"
import { Anticipo } from "@/app/models/model"

interface AnticipoEjecutarDialogProps {
  anticipo: Anticipo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * @description Dialog para ejecutar un anticipo (total o parcialmente)
 * @param {AnticipoEjecutarDialogProps} props - Props del componente
 */
export function AnticipoEjecutarDialog({
  anticipo,
  open,
  onOpenChange,
  onSuccess,
}: AnticipoEjecutarDialogProps) {

  const [isLoading, setIsLoading] = useState(false)
  const [monto, setMonto] = useState<number>(0)
  const [permitirParcial, setPermitirParcial] = useState<boolean>(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState<boolean>(false)

  const saldoDisponible = anticipo ? Number(anticipo.saldoDisponible) : 0
  const esEjecucionParcial = monto > 0 && monto < saldoDisponible
  const esMontoInvalido = monto <= 0 || monto > saldoDisponible

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setMonto(0)
      setPermitirParcial(false)
      setMostrarConfirmacion(false)
    }
    onOpenChange(isOpen)
  }

  const handleEjecutar = async () => {
    if (!anticipo) return

    // Validaciones
    if (esMontoInvalido) {
      toast("El monto debe ser mayor que cero y menor o igual al saldo disponible")
      return
    }

    // Si es ejecución parcial y no está permitido, mostrar confirmación
    if (esEjecucionParcial && !permitirParcial) {
      setMostrarConfirmacion(true)
      return
    }

    await ejecutarConfirmado()
  }

  const ejecutarConfirmado = async () => {
    if (!anticipo) return

    setIsLoading(true)
    try {
      const result = await executeAnticipoAction({
        anticipoId: anticipo.anticipoId,
        montoEjecutar: monto,
        documentoDestinoId: `manual-${Date.now()}`,
        observaciones: esEjecucionParcial ? `Ejecución parcial por ${monto}` : undefined,
      })

      if (!result.success) {
        throw new Error(result.error?.message || "No se pudo ejecutar el anticipo")
      }

      toast(esEjecucionParcial 
        ? `Se ejecutó parcialmente el anticipo por ${anticipo.moneda} ${monto.toLocaleString()}`
        : "Se ejecutó completamente el anticipo")

      setMonto(0)
      setPermitirParcial(false)
      setMostrarConfirmacion(false)
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast(error?.message || "No se pudo ejecutar el anticipo")
    } finally {
      setIsLoading(false)
    }
  }

  if (!anticipo) return <></>

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ejecutar Anticipo</DialogTitle>
          <DialogDescription>
            Ingrese el monto a ejecutar del anticipo. Puede ejecutar el saldo total o parcialmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información del anticipo */}
          <div className="p-4 rounded-lg bg-muted">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <p className="font-medium">{anticipo.tipo === "PAGO" ? "Pago" : "Cobro"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Saldo Disponible</p>
                <p className="font-medium text-green-600">
                  {anticipo.moneda} {saldoDisponible.toLocaleString("es-ES")}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Contraparte</p>
                  <p className="font-medium">
                    {anticipo.clienteId || anticipo.proveedorId || "-"}
                  </p>
              </div>
            </div>
          </div>

          {/* Monto a ejecutar */}
          <div className="space-y-2">
            <Label htmlFor="monto">Monto a ejecutar</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              min={0}
              max={saldoDisponible}
              value={monto}
              onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
              placeholder={`Máximo: ${saldoDisponible}`}
            />
            <p className="text-xs text-muted-foreground">
              Máximo disponible: {anticipo.moneda} {saldoDisponible.toLocaleString("es-ES")}
            </p>
          </div>

          {/* Validación de monto */}
          {monto > 0 && esEjecucionParcial && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Ejecución parcial detectada
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  El anticipo quedará con saldo de {anticipo.moneda} {(saldoDisponible - monto).toLocaleString("es-ES")}
                </p>
              </div>
            </div>
          )}

          {/* Checkbox permitir parcial */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="permitirParcial"
              checked={permitirParcial}
              onCheckedChange={(checked) => setPermitirParcial(checked as boolean)}
            />
            <Label htmlFor="permitirParcial" className="text-sm font-normal">
              Permitir ejecución parcial
            </Label>
          </div>

          {/* Confirmación explícita */}
          {mostrarConfirmacion && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  ¿Está seguro que desea ejecutar parcialmente?
                </p>
                <p className="text-blue-700 dark:text-blue-300">
                  El anticipo quedará en estado RESERVADO con saldo restante.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            variant="default"
            onClick={handleEjecutar} 
            disabled={isLoading || esMontoInvalido || (esEjecucionParcial && !permitirParcial && !mostrarConfirmacion)}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {esEjecucionParcial ? "Ejecutar Parcialmente" : "Ejecutar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
