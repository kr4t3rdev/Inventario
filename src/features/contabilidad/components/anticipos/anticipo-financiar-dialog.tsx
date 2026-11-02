"use client"

import { useEffect, useState } from "react"
import type { ReactElement } from "react"
import { Banknote, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Anticipo } from "@/app/models/model"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  devolverFondosAnticipoAction,
  registrarMovimientoEfectivoAnticipoAction,
} from "@/features/contabilidad/actions-anticipos"

interface CuentaFinanciamiento {
  cuentaId: string
  nombreBanco: string
  numeroCuenta: string
  moneda: string
}

interface TipoPagoFinanciamiento {
  tipoId: string
  nombre: string
}

interface AnticipoFinanciarDialogProps {
  modo?: "financiar" | "devolver"
  anticipo: Anticipo | null
  cuentas: CuentaFinanciamiento[]
  tiposPago: TipoPagoFinanciamiento[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * @description Registra financiación o devolución monetaria de un anticipo.
 * @param {AnticipoFinanciarDialogProps} props - Anticipo, cuentas y acciones del diálogo.
 * @returns {JSX.Element} Diálogo para recibir o entregar fondos parcialmente.
 */
export function AnticipoFinanciarDialog({
  modo = "financiar",
  anticipo,
  cuentas,
  tiposPago,
  open,
  onOpenChange,
  onSuccess,
}: AnticipoFinanciarDialogProps): ReactElement {
  const [cuentaId, setCuentaId] = useState("")
  const [tipoPagoId, setTipoPagoId] = useState("")
  const [monto, setMonto] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const restante = anticipo
    ? modo === "devolver"
      ? Number(anticipo.saldoDisponible)
      : Math.max(0, Number(anticipo.montoOriginal) - Number(anticipo.montoFinanciado ?? 0))
    : 0

  useEffect(() => {
    if (!open) return
    setMonto(restante.toString())
    setCuentaId("")
    setTipoPagoId("")
    setObservaciones("")
  }, [modo, open, restante])

  const handleSubmit = async () => {
    if (!anticipo || !cuentaId || !tipoPagoId || !Number.isFinite(Number(monto))) return
    setIsLoading(true)
    try {
      const action = modo === "devolver"
        ? devolverFondosAnticipoAction
        : registrarMovimientoEfectivoAnticipoAction
      const result = await action({
        anticipoId: anticipo.anticipoId,
        cuentaId,
        tipoPagoId,
        monto: Number(monto),
        idempotencyKey: crypto.randomUUID(),
        observaciones: observaciones || undefined,
      })
      if (!result.success) throw new Error(result.error?.message || "No se pudo registrar el movimiento")
      toast.success(modo === "devolver"
        ? anticipo.tipo === "COBRO" ? "Devolución al cliente registrada" : "Reintegro del proveedor registrado"
        : anticipo.tipo === "COBRO" ? "Recepción registrada" : "Entrega registrada")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el movimiento")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {modo === "devolver"
              ? anticipo?.tipo === "COBRO" ? "Devolver fondos al cliente" : "Registrar reintegro del proveedor"
              : anticipo?.tipo === "COBRO" ? "Recibir fondos del cliente" : "Entregar fondos al proveedor"}
          </DialogTitle>
          <DialogDescription>
            {modo === "devolver"
              ? "Solo puedes devolver fondos financiados que sigan disponibles y no se hayan aplicado. El saldo, la tesorería y el asiento se actualizarán juntos."
              : "El anticipo se creó como reserva. Registra aquí el movimiento de efectivo real; el saldo disponible y su asiento se actualizarán juntos."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            {modo === "devolver" ? "Saldo financiado disponible para devolver:" : "Pendiente de financiar:"}{" "}
            <strong>{anticipo?.moneda} {restante.toLocaleString("es-ES")}</strong>
          </div>
          <div className="space-y-2">
            <Label htmlFor="anticipo-funding-amount">Monto</Label>
            <Input
              id="anticipo-funding-amount"
              type="number"
              min="0.01"
              max={restante}
              step="0.01"
              value={monto}
              onChange={(event) => setMonto(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Cuenta de tesorería ({anticipo?.moneda})</Label>
            <Select value={cuentaId} onValueChange={setCuentaId}>
              <SelectTrigger><SelectValue placeholder="Selecciona una cuenta" /></SelectTrigger>
              <SelectContent>
                {cuentas.filter((cuenta) =>
                  cuenta.moneda.trim().toUpperCase() === anticipo?.moneda.trim().toUpperCase()
                ).map((cuenta) => (
                  <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                    {cuenta.nombreBanco} · {cuenta.numeroCuenta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{modo === "devolver" ? "Medio de devolución" : "Tipo de pago"}</Label>
            <Select value={tipoPagoId} onValueChange={setTipoPagoId}>
              <SelectTrigger><SelectValue placeholder="Selecciona un tipo de pago" /></SelectTrigger>
              <SelectContent>
                {tiposPago.map((tipo) => (
                  <SelectItem key={tipo.tipoId} value={tipo.tipoId}>{tipo.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="anticipo-funding-notes">Observaciones (opcional)</Label>
            <Textarea
              id="anticipo-funding-notes"
              value={observaciones}
              maxLength={500}
              rows={3}
              onChange={(event) => setObservaciones(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !cuentaId || !tipoPagoId || Number(monto) <= 0 || Number(monto) > restante}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
            Registrar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
