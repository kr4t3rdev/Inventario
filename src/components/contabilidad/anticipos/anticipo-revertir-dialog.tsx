"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Loader2, Info } from "lucide-react"
import { toast } from "sonner"
import { useReverseAnticipoMutation } from "@/lib/redux/services/contabilidadApi"
import { Anticipo } from "@/app/models/model"

interface AnticipoRevertirDialogProps {
  anticipo: Anticipo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * @description Dialog para revertir un anticipo ejecutado
 * @param {AnticipoRevertirDialogProps} props - Props del componente
 */
export function AnticipoRevertirDialog({
  anticipo,
  open,
  onOpenChange,
  onSuccess,
}: AnticipoRevertirDialogProps) {

  const [reverseAnticipo, { isLoading }] = useReverseAnticipoMutation()
  
  const [montoReverso, setMontoReverso] = useState<number>(0)
  const [observaciones, setObservaciones] = useState<string>("")
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState<boolean>(false)

  const montoOriginal = anticipo ? Number(anticipo.montoOriginal) : 0
  const saldoEjecutado = montoOriginal - (anticipo ? Number(anticipo.saldoDisponible) : 0)
  const esReversoParcial = montoReverso > 0 && montoReverso < saldoEjecutado

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setMontoReverso(0)
      setObservaciones("")
      setMostrarConfirmacion(false)
    }
    onOpenChange(isOpen)
  }

  const handleRevertir = async () => {
    if (!anticipo) return

    // Validaciones
    if (montoReverso <= 0) {
      toast("El monto a revertir debe ser mayor que cero")
      return
    }

    if (montoReverso > saldoEjecutado) {
      toast("El monto a revertir no puede exceder el monto ejecutado")
      return
    }

    // Siempre mostrar confirmación para reversión
    if (!mostrarConfirmacion) {
      setMostrarConfirmacion(true)
      return
    }

    await revertirConfirmado()
  }

  const revertirConfirmado = async () => {
    if (!anticipo) return

    try {
      await reverseAnticipo({
        id: anticipo.anticipoId,
        documentoDestinoId: `revertir-${Date.now()}`,
        montoReverso,
        observaciones,
      }).unwrap()

      toast(esReversoParcial
        ? `Se revertió parcialmente el anticipo por ${anticipo.moneda} ${montoReverso.toLocaleString()}`
        : "Se revertió completamente el anticipo")

      setMontoReverso(0)
      setObservaciones("")
      setMostrarConfirmacion(false)
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast(error?.data?.error || "No se pudo revertir el anticipo")
    }
  }

  if (!anticipo) return <></>

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Revertir Anticipo</DialogTitle>
          <DialogDescription>
            Revertir un anticipo ejecutado. Puede revertir el monto total ejecutado o parcialmente.
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
                <p className="text-muted-foreground">Monto Original</p>
                <p className="font-medium">
                  {anticipo.moneda} {montoOriginal.toLocaleString("es-ES")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Monto Ejecutado</p>
                <p className="font-medium text-green-600">
                  {anticipo.moneda} {saldoEjecutado.toLocaleString("es-ES")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Saldo Actual</p>
                <p className="font-medium">
                  {anticipo.moneda} {Number(anticipo.saldoDisponible).toLocaleString("es-ES")}
                </p>
              </div>
            </div>
          </div>

          {/* Monto a revertir */}
          <div className="space-y-2">
            <Label htmlFor="montoReverso">Monto a revertir</Label>
            <Input
              id="montoReverso"
              type="number"
              step="0.01"
              min={0}
              max={saldoEjecutado}
              value={montoReverso}
              onChange={(e) => setMontoReverso(parseFloat(e.target.value) || 0)}
              placeholder={`Máximo: ${saldoEjecutado}`}
            />
            <p className="text-xs text-muted-foreground">
              Máximo ejecutable a revertir: {anticipo.moneda} {saldoEjecutado.toLocaleString("es-ES")}
            </p>
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones (Opcional)</Label>
            <Textarea
              id="observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Motivo de la reversión..."
              rows={3}
            />
          </div>

          {/* Confirmación */}
          {mostrarConfirmacion && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  ¿Está seguro que desea revertir?
                </p>
                <p className="text-blue-700 dark:text-blue-300">
                  {esReversoParcial
                    ? `El anticipo quedará con saldo de ${anticipo.moneda} ${(saldoEjecutado - montoReverso).toLocaleString()}`
                    : "El anticipo volverá a estado RESERVADO"}
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
            onClick={handleRevertir} 
            disabled={isLoading || montoReverso <= 0 || montoReverso > saldoEjecutado}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Revertir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
