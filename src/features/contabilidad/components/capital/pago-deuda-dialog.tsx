"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Loader2, DollarSign } from "lucide-react"
import { toast } from 'sonner'
import { showErrorToast } from "../toast-notifications"
import { registrarPagoCapitalAction } from "@/features/contabilidad/actions-capital"
import { getCuentasBancariasAction } from "@/features/contabilidad/actions-cuentas-bancarias"
import { InyeccionCapital } from "@/app/models/model"
import { useEffect, useState } from "react"
import { Textarea } from "@/components/ui/textarea"

const pagoSchema = z.object({
  montoPagado: z.number().positive("El monto debe ser positivo"),
  cuentaId: z.string().min(1, "Seleccione una cuenta bancaria"),
  comprobante: z.string().optional(),
  observaciones: z.string().optional(),
})

type PagoFormData = z.infer<typeof pagoSchema>

interface PagoDeudaDialogProps {
  inyeccion: InyeccionCapital | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function PagoDeudaDialog({ inyeccion, open, onOpenChange, onSuccess }: PagoDeudaDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [cuentas, setCuentas] = useState<any[]>([])

  useEffect(() => {
    getCuentasBancariasAction().then(r => { if (r.success) setCuentas(r.data?.cuentas ?? []) })
  }, [])

  const form = useForm<PagoFormData>({
    resolver: zodResolver(pagoSchema),
    defaultValues: {
      montoPagado: 0,
      cuentaId: "",
      comprobante: "",
      observaciones: "",
    },
  })

  useEffect(() => {
    if (inyeccion) {
      // Pre-fill suggested amount (e.g. monthly installment if we calculated it, or remaining balance)
      // For now, let's suggest remaining balance / remaining months or just empty
      // Just reset form
      form.reset({
          montoPagado: 0,
          cuentaId: "",
          comprobante: "",
          observaciones: ""
      })
    }
  }, [inyeccion, form])

  const onSubmit = async (data: PagoFormData) => {
    if (!inyeccion) return

    try {
      const result = await registrarPagoCapitalAction({
        inyeccionId: inyeccion.id,
        monto: data.montoPagado,
        cuentaBancariaId: data.cuentaId,
        tipoPagoId: 'default',
        observaciones: data.observaciones,
      })
      if (!result.success) throw new Error(result.error?.message || 'Error al registrar pago')
      
      toast.success('Pago registrado exitosamente')
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error('Error al registrar pago:', error)
      showErrorToast.generic(error.data?.error || "Error al registrar el pago")
    }
  }

  if (!inyeccion) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Pago de Deuda</DialogTitle>
          <DialogDescription>
            {inyeccion.entidadPrestamista} - Pendiente: {inyeccion.saldoPendiente?.toLocaleString()} {inyeccion.moneda}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, () => { toast.error('Completá los campos requeridos antes de continuar.') })} className="space-y-4">
            <FormField
              control={form.control}
              name="montoPagado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto a Pagar</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cuentaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta Bancaria (Origen)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione cuenta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cuentas.map((c) => (
                        <SelectItem key={c.cuentaId} value={c.cuentaId}>
                          {c.nombreBanco} ({c.moneda}) - Saldo: {c.saldo.toLocaleString()}
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
              name="comprobante"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nº Comprobante (Opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Pago
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
