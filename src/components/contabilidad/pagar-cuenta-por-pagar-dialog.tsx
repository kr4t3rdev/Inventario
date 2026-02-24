'use client'

import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { CuentaPorPagar } from '@/app/models/model'
import { usePagarCuentaPorPagarMutation } from '@/lib/redux/services/cuentasPorPagarApi'

const pagoSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser mayor que 0'),
  numeroTransaccion: z.string().min(1, 'El número de transacción es requerido'),
  cuentaProveedor: z.string().min(1, 'La cuenta del proveedor es requerida'),
  observaciones: z.string().optional()
})

type PagoFormValues = z.infer<typeof pagoSchema>

interface PagarCuentaPorPagarDialogProps {
  cuenta: CuentaPorPagar | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * @description Diálogo para registrar un pago de cuenta por pagar.
 * @param {PagarCuentaPorPagarDialogProps} props - Props del componente
 * @returns {JSX.Element} Diálogo de pago de cuenta por pagar
 */
export function PagarCuentaPorPagarDialog({
  cuenta,
  open,
  onOpenChange,
  onSuccess
}: PagarCuentaPorPagarDialogProps) {
  const [pagarCuenta, { isLoading }] = usePagarCuentaPorPagarMutation()

  const form = useForm<PagoFormValues>({
    resolver: zodResolver(pagoSchema),
    defaultValues: {
      monto: 0,
      numeroTransaccion: '',
      cuentaProveedor: '',
      observaciones: ''
    }
  })

  useEffect(() => {
    if (cuenta && open) {
      // Determinar la cuenta del proveedor según la moneda
      const esUSD = cuenta.moneda === 'USD'
      const cuentaProveedor = esUSD 
        ? (cuenta.cuentaUSD || cuenta.proveedor?.cuentaUSD || '')
        : (cuenta.cuentaCUP || cuenta.proveedor?.cuentaCUP || '')
      
      form.reset({
        monto: Number(cuenta.saldoPendiente ?? 0),
        numeroTransaccion: '',
        cuentaProveedor,
        observaciones: ''
      })
    }
  }, [cuenta, open, form])

  const handleSubmit = async (values: PagoFormValues) => {
    if (!cuenta) return
    if (!cuenta.cuentaPorPagarId) {
      toast.error('La factura no tiene cuenta por pagar asociada')
      return
    }

    const saldoPendiente = Number(cuenta.saldoPendiente ?? 0)
    if (values.monto > saldoPendiente) {
      toast.error('El monto no puede exceder el saldo pendiente')
      return
    }

    try {
      await pagarCuenta({
        numeroFactura: cuenta.numeroFactura,
        tipo: cuenta.tipo,
        data: {
          monto: values.monto,
          numeroTransaccion: values.numeroTransaccion,
          cuentaProveedor: values.cuentaProveedor,
          observaciones: values.observaciones
        }
      }).unwrap()

      toast.success('Pago registrado correctamente')
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Error al registrar el pago:', error)
      const apiError =
        (error as { data?: { error?: string } })?.data?.error || 'No se pudo registrar el pago'
      toast.error(apiError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            {cuenta
              ? `Factura ${cuenta.numeroFactura} • Saldo ${cuenta.moneda} ${Number(
                  cuenta.saldoPendiente ?? 0
                ).toFixed(2)}`
              : 'Seleccione una cuenta por pagar.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="monto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto a pagar</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="numeroTransaccion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de transacción</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: TRX-129038" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cuentaProveedor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Cuenta del proveedor {cuenta?.moneda === 'USD' ? '(USD)' : '(CUP)'}
                    {(cuenta?.cuentaCUP || cuenta?.cuentaUSD || cuenta?.proveedor?.cuentaCUP || cuenta?.proveedor?.cuentaUSD) && (
                      <span className="text-xs text-muted-foreground ml-2">(cargada automáticamente)</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={cuenta?.moneda === 'USD' ? "Ej: 0100-0000-0000-0000" : "Ej: 9200-0000-0000-0000"} 
                      {...field} 
                    />
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
                    <Input placeholder="Opcional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || !cuenta}>
                {isLoading ? 'Procesando...' : 'Registrar pago'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
