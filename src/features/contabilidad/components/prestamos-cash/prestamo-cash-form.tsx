"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createPrestamoCashAction } from "@/features/contabilidad/actions-prestamos-cash"
import { useGetTasasActualesQuery } from "@/features/contabilidad/api/contabilidadApi"
import { Loader2, TrendingUp, ArrowRightLeft } from "lucide-react"
import { sileo } from "@/lib/sileo-shim"
import { calcularMontoTotalACobrar } from "@/lib/utils/prestamo-cash"

const prestamoSchema = z.object({
  clienteId: z.string().min(1, "Seleccione un cliente"),
  montoCapital: z.coerce.number().positive("El monto debe ser mayor que cero"),
  moneda: z.string().min(1, "Seleccione la moneda"),
  tasaInteres: z.coerce.number().min(0).optional(),
  tasaCambioAlCrear: z.coerce.number().positive().optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  cuentaBancariaId: z.string({ required_error: "Seleccione una cuenta bancaria" }).min(1, "Seleccione una cuenta bancaria"),
})

type PrestamoFormValues = z.infer<typeof prestamoSchema>

/**
 * @description Panel reactivo con el resumen financiero del préstamo.
 * Muestra capital, interés, total y cuotas estimadas diaria/semanal/mensual.
 * @param {{ control: any }} props - Control de react-hook-form.
 * @returns {JSX.Element | null} Panel de resumen o null si no hay monto.
 */
function CuotasEstimadas({ control }: { control: any }) {
  const montoCapital = useWatch({ control, name: 'montoCapital' })
  const tasaInteres = useWatch({ control, name: 'tasaInteres' })
  const fechaVencimiento = useWatch({ control, name: 'fechaVencimiento' })
  const moneda = useWatch({ control, name: 'moneda' })

  const monto = Number(montoCapital) || 0
  const tasa = Number(tasaInteres) || 0

  if (monto <= 0) return null

  const totalConInteres = calcularMontoTotalACobrar(monto, tasa)
  const interes = totalConInteres - monto

  let dias = 0
  if (fechaVencimiento) {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const vencimiento = new Date(fechaVencimiento)
    dias = Math.max(1, Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)))
  }

  const fmt = (n: number) =>
    n.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const cuotaDiaria = dias > 0 ? totalConInteres / dias : null

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <TrendingUp className="h-4 w-4 text-primary" />
        Resumen del préstamo
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Capital</span>
          <span className="font-medium">{fmt(monto)} {moneda}</span>
        </div>
        {tasa > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Interés ({tasa}%)</span>
            <span className="font-medium text-amber-500">+{fmt(interes)} {moneda}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t pt-2">
          <span>Saldo a pagar</span>
          <span className="text-primary">{fmt(totalConInteres)} {moneda}</span>
        </div>
      </div>

      {cuotaDiaria !== null && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">Cuota fija estimada ({dias} días)</p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800">
              Diaria &middot; {fmt(cuotaDiaria)} {moneda}
            </Badge>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
              Semanal &middot; {fmt(cuotaDiaria * 7)} {moneda}
            </Badge>
            <Badge variant="outline" className="bg-violet-500/10 text-violet-700 border-violet-200 dark:text-violet-400 dark:border-violet-800">
              Mensual &middot; {fmt(cuotaDiaria * 30)} {moneda}
            </Badge>
          </div>
        </div>
      )}
    </div>
  )
}

interface PrestamoCashFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientes?: Array<{ clienteId: string; nombre: string }>
  cuentasBancarias?: Array<{ cuentaId: string; nombreBanco: string; tipoCuenta: string; moneda: string }>
  onSuccess?: () => void
}

/**
 * @description Formulario para crear nuevos préstamos en efectivo.
 * @param {PrestamoCashFormProps} props - Props del componente.
 * @returns {JSX.Element} Formulario de préstamo cash.
 */
export function PrestamoCashForm({ open, onOpenChange, clientes = [], cuentasBancarias = [], onSuccess }: PrestamoCashFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { data: tasasData } = useGetTasasActualesQuery()

  const monedaPrincipal = tasasData?.data?.monedaPrincipal?.codigo ?? "CUP"
  const tasas = tasasData?.data?.tasas ?? []

  const form = useForm<PrestamoFormValues>({
    resolver: zodResolver(prestamoSchema),
    defaultValues: {
      montoCapital: 0,
      moneda: "CUP",
    },
  })

  const monedaSeleccionada = form.watch("moneda")
  const montoCapital = form.watch("montoCapital")
  const necesitaTasa = monedaSeleccionada && monedaSeleccionada !== monedaPrincipal

  const tasaActual = useMemo(() => {
    if (!necesitaTasa) return null
    return tasas.find((t) => t.monedaOrigenId === monedaSeleccionada)
  }, [necesitaTasa, monedaSeleccionada, tasas])

  useEffect(() => {
    if (tasaActual) {
      form.setValue("tasaCambioAlCrear", tasaActual.tasa)
    } else {
      form.setValue("tasaCambioAlCrear", undefined)
    }
  }, [tasaActual, form])

  const onSubmit = async (data: PrestamoFormValues) => {
    setIsLoading(true)
    try {
      const result = await createPrestamoCashAction({
        clienteId: data.clienteId,
        montoCapital: data.montoCapital,
        moneda: data.moneda,
        tasaInteres: data.tasaInteres,
        tasaCambioAlCrear: data.tasaCambioAlCrear,
        fechaVencimiento: data.fechaVencimiento || undefined,
        observaciones: data.observaciones || undefined,
        cuentaBancariaId: data.cuentaBancariaId,
      })

      if (!result.success) {
        sileo.error({ title: result.error?.message || "No se pudo crear el préstamo" })
        return
      }

      sileo.success({ title: "Préstamo en efectivo creado exitosamente." })
      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      sileo.error({ title: "No se pudo crear el préstamo" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nuevo Préstamo en Efectivo</DialogTitle>
          <DialogDescription>
            Registre un préstamo de dinero en efectivo a un cliente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-4 overflow-y-auto flex-1 pr-1">
            <FormField
              control={form.control}
              name="cuentaBancariaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta bancaria origen</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione la cuenta de origen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cuentasBancarias.map((c) => (
                        <SelectItem key={c.cuentaId} value={c.cuentaId}>
                          {c.nombreBanco} · {c.tipoCuenta} ({c.moneda})
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
              name="clienteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.clienteId} value={c.clienteId}>
                          {c.nombre}
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
                  <FormLabel>Monto del Préstamo</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
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
                    <CurrencyInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {necesitaTasa && (
              <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                  <ArrowRightLeft className="h-4 w-4" />
                  Tasa de cambio al crear
                </div>
                {tasaActual ? (
                  <>
                    <p className="text-sm">
                      1 {monedaSeleccionada} = <span className="font-semibold">{tasaActual.tasa}</span> {monedaPrincipal}
                    </p>
                    {Number(montoCapital) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Equivalente: {(Number(montoCapital) * tasaActual.tasa).toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {monedaPrincipal}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No hay tasa de cambio configurada para {monedaSeleccionada}. Se guardará sin tasa.
                  </p>
                )}
              </div>
            )}

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

            <CuotasEstimadas control={form.control} />

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
                Crear Préstamo
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
