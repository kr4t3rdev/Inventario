"use client"

import { useEffect, useMemo, useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Loader2 } from "lucide-react"
import { registrarPagoDeudaAction } from "@/features/contabilidad/actions-deudas-cash"
import type { DeudaCash } from "@/app/models/model"

const pagoSchema = z.object({
  monto: z.coerce.number().positive("El monto debe ser mayor que 0"),
  cuentaId: z.string().min(1, "Seleccione una cuenta bancaria"),
  tipoPagoId: z.string().min(1, "Seleccione el tipo de pago"),
  moneda: z.string().optional(),
  tasaCambio: z.coerce.number().positive().optional(),
  observaciones: z.string().optional(),
})

type PagoFormValues = z.infer<typeof pagoSchema>

interface PagoDeudaModalProps {
  deuda: DeudaCash | null
  open: boolean
  onOpenChange: (open: boolean) => void
  cuentasBancarias?: Array<{ cuentaId: string; nombreBanco: string; numeroCuenta: string }>
  tiposPago?: Array<{ tipoId: string; nombre: string }>
  onSuccess?: () => void
}

/**
 * @description Modal para registrar un pago de deuda en efectivo.
 * @param {PagoDeudaModalProps} props - Props del componente.
 * @returns {JSX.Element} Diálogo de pago de deuda.
 */
export function PagoDeudaModal({
  deuda,
  open,
  onOpenChange,
  cuentasBancarias = [],
  tiposPago = [],
  onSuccess,
}: PagoDeudaModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const saldoPendiente = useMemo(() => {
    if (!deuda?.cuentaPorPagar) return Number(deuda?.montoCapital ?? 0)
    return Number(deuda.cuentaPorPagar.saldoPendiente)
  }, [deuda])

  const form = useForm<PagoFormValues>({
    resolver: zodResolver(pagoSchema),
    defaultValues: {
      monto: 0,
      cuentaId: "",
      tipoPagoId: "",
      observaciones: "",
    },
  })

  const montoIngresado = form.watch("monto")
  const tasaCambio = form.watch("tasaCambio")
  const montoConvertido = montoIngresado && tasaCambio ? montoIngresado * tasaCambio : null

  useEffect(() => {
    if (deuda && open) {
      form.reset({
        monto: saldoPendiente,
        cuentaId: "",
        tipoPagoId: "",
        moneda: deuda.moneda,
        observaciones: "",
      })
    }
  }, [deuda, open, form, saldoPendiente])

  const handleSubmit = async (values: PagoFormValues) => {
    if (!deuda) return

    if (values.monto > saldoPendiente) {
      toast.error("El monto no puede exceder el saldo pendiente")
      return
    }

    setIsLoading(true)
    try {
      const result = await registrarPagoDeudaAction({
        id: deuda.id,
        monto: values.monto,
        cuentaId: values.cuentaId,
        tipoPagoId: values.tipoPagoId,
        moneda: values.moneda,
        tasaCambio: values.tasaCambio,
        observaciones: values.observaciones || undefined,
      })

      if (!result.success) {
        toast.error(result.error?.message || "No se pudo registrar el pago")
        return
      }

      toast.success("Pago registrado correctamente")
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      toast.error("No se pudo registrar el pago")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar Pago de Deuda</DialogTitle>
          <DialogDescription>
            {deuda
              ? `Deuda #${deuda.idNumerico} • Proveedor: ${deuda.proveedor?.nombre ?? "—"} • Saldo: ${deuda.moneda} ${saldoPendiente.toFixed(2)}`
              : "Seleccione una deuda."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit, () => { toast.error('Completá los campos requeridos antes de continuar.') })} className="space-y-4">
            <FormField
              control={form.control}
              name="monto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto a pagar</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" max={saldoPendiente} {...field} />
                  </FormControl>
                  {montoIngresado > saldoPendiente && (
                    <p className="text-xs text-red-500">Excede el saldo pendiente ({saldoPendiente.toFixed(2)})</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cuentaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta Bancaria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione cuenta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cuentasBancarias.map((cuenta) => (
                        <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                          {cuenta.nombreBanco} - {cuenta.numeroCuenta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipoPagoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Pago</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione tipo de pago" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tiposPago.map((tipo) => (
                        <SelectItem key={tipo.tipoId} value={tipo.tipoId}>
                          {tipo.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tasaCambio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tasa de Cambio (Opcional)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.0001" placeholder="1.0000" {...field} />
                  </FormControl>
                  {montoConvertido !== null && (
                    <p className="text-xs text-muted-foreground">
                      Monto convertido: ${montoConvertido.toFixed(2)}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notas adicionales..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || montoIngresado > saldoPendiente}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Pago
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
