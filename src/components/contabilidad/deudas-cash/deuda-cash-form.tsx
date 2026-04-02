"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { useCreateDeudaCashMutation } from "@/lib/redux/services/deudasCashApi"
import { Loader2 } from "lucide-react"
import { sileo } from "sileo"

const deudaSchema = z.object({
  proveedorId: z.string().min(1, "Seleccione un proveedor"),
  montoCapital: z.coerce.number().positive("El monto debe ser mayor que cero"),
  moneda: z.string().min(1, "Seleccione la moneda"),
  tasaInteres: z.coerce.number().min(0).optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
})

type DeudaFormValues = z.infer<typeof deudaSchema>

interface DeudaCashFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedores?: Array<{ vendorId: string; nombre: string }>
  onSuccess?: () => void
}

/**
 * @description Formulario para crear nuevas deudas en efectivo.
 * @param {DeudaCashFormProps} props - Props del componente.
 * @returns {JSX.Element} Formulario de deuda cash.
 */
export function DeudaCashForm({ open, onOpenChange, proveedores = [], onSuccess }: DeudaCashFormProps) {
  const [createDeuda, { isLoading }] = useCreateDeudaCashMutation()

  const form = useForm<DeudaFormValues>({
    resolver: zodResolver(deudaSchema),
    defaultValues: {
      montoCapital: 0,
      moneda: "CUP",
    },
  })

  const onSubmit = async (data: DeudaFormValues) => {
    try {
      await createDeuda({
        proveedorId: data.proveedorId,
        montoCapital: data.montoCapital,
        moneda: data.moneda,
        tasaInteres: data.tasaInteres,
        fechaVencimiento: data.fechaVencimiento || undefined,
        observaciones: data.observaciones || undefined,
      }).unwrap()

      sileo.success({ title: "Deuda en efectivo registrada exitosamente." })
      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      sileo.error({ title: error?.data?.error || "No se pudo registrar la deuda" })
    }
  }

  const handleClose = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Deuda en Efectivo</DialogTitle>
          <DialogDescription>
            Registre una deuda de dinero en efectivo con un proveedor.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-4">
            <FormField
              control={form.control}
              name="proveedorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un proveedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {proveedores.map((p) => (
                        <SelectItem key={p.vendorId} value={p.vendorId}>
                          {p.nombre}
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
              name="montoCapital"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto de la Deuda</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="moneda"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CUP">CUP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="MLC">MLC</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tasaInteres"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tasa de Interés % (Opcional)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fechaVencimiento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Vencimiento (Opcional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
                  <FormLabel>Observaciones (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notas adicionales..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Deuda
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
