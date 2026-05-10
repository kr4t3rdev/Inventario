"use client"

import { useState, useEffect, useMemo } from "react"
import { useForm, useFieldArray, useWatch } from "react-hook-form"

import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Loader2, 
  Save, 
  X, 
  Wrench,
  DollarSign,
  Calendar,
  Building,
  Building2,
  CreditCard,
  Plus,
  Trash2,
} from "lucide-react"
import { sileo } from '@/lib/sileo-shim'
import { reconciliarServicioAction } from "@/features/contabilidad/actions-reconciliacion"
import { getCuentasBancariasAction } from "@/features/contabilidad/actions-cuentas-bancarias"
import { getTiposPagoAction } from "@/features/contabilidad/actions-tipos-pago"
import { TasaCambioDialog } from "./tasa-cambio-dialog"
import { VentaServicio } from "@/app/models/model"

// Validation schema aligned with ventas (multi-distribuciones)
const distribucionSchema = z.object({
  cuentaId: z.string().min(1, "Seleccione una cuenta bancaria"),
  tipoPagoId: z.string().min(1, "Seleccione un tipo de pago"),
  monto: z.number().min(0.01, "El monto debe ser mayor a 0"),
  moneda: z.string().min(1, "Seleccione una moneda"),
  tasaCambio: z.number().positive().optional(),
  observaciones: z.string().optional(),
})
const MONEDA_SIMBOLOS: Record<string, string> = {
  CUP: "CUP",
  USD: "$",
  EUR: "€",
}

const reconciliacionServicioSchema = z.object({
    ventaServicioId: z.string().min(1, 'ID de venta de servicio es requerido'),
    distribuciones: z.array(distribucionSchema).min(1, "Debe agregar al menos una distribución"),
})

type ReconciliacionServicioFormData = z.infer<typeof reconciliacionServicioSchema>

interface ReconciliacionServiciosFormProps {
  servicio: VentaServicio
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ReconciliacionServiciosForm({
  servicio,
  open,
  onClose,
  onSuccess
}: ReconciliacionServiciosFormProps) {
  const [showTasaCambioDialog, setShowTasaCambioDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [cuentas, setCuentas] = useState<any[]>([])
  const [tiposPago, setTiposPago] = useState<any[]>([])

  useEffect(() => {
    getCuentasBancariasAction().then(r => { if (r.success) setCuentas(r.data?.cuentas ?? []) })
    getTiposPagoAction().then(r => { if (r.success) setTiposPago(r.data?.data ?? []) })
  }, [])

  const form = useForm<ReconciliacionServicioFormData>({
    resolver: zodResolver(reconciliacionServicioSchema),
    defaultValues: {
      ventaServicioId: servicio?.ventaServicioId || "",
      distribuciones: [
        {
          cuentaId: "",
          tipoPagoId: "",
          monto: servicio?.total || 0,
          moneda: servicio?.servicio.moneda || "CUP",
          tasaCambio: undefined,
          observaciones: "",
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "distribuciones"
  })



  // Reset form when dialog opens
  useEffect(() => {
    if (open && servicio && servicio.ventaServicioId) {
      form.reset({
        ventaServicioId: servicio.ventaServicioId,
        distribuciones: [
          {
            cuentaId: "",
            tipoPagoId: "",
            monto: servicio.total,
            moneda: servicio.servicio.moneda || "CUP",
            tasaCambio: undefined,
            observaciones: "",
          },
        ],
      })
    }
  }, [open, form, servicio])

  // Watch distribuciones for calculations
  const watchedDistribuciones = useWatch({ control: form.control, name: "distribuciones", defaultValue: [] })

  // Calculate totals
  const totalDistribuido = watchedDistribuciones.reduce((sum: number, dist) => {
    if (!dist) return sum
    const monto = typeof dist.monto === 'number' ? dist.monto : parseFloat(dist.monto as string) || 0
    return sum + monto
  }, 0)

  const montoRestante = (servicio?.total ?? 0) - totalDistribuido

  // Don't render if servicio is not provided
  if (!servicio) {
    return null
  }


  const formatCurrency = (amount: number | string | null | undefined, currency: string = "CUP") => {
    const symbol = MONEDA_SIMBOLOS[currency] || currency
    if (amount == null) {
      return `${symbol} 0.00`
    }
    const raw = typeof amount === "string" ? amount.replace(",", ".") : String(amount)
    const numAmount = parseFloat(raw)
    if (isNaN(numAmount)) {
      return `${symbol} 0.00`
    }
    return `${symbol} ${numAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleTasaCambioConfirm = async (tasa: number) => {
    setShowTasaCambioDialog(false)
    // Set tasaCambio on the first distribución that needs it (basic flow)
    const distribuciones = [...(form.getValues("distribuciones") || [])]
    for (let i = 0; i < distribuciones.length; i++) {
      if (!distribuciones[i]?.tasaCambio) {
        distribuciones[i] = { ...distribuciones[i], tasaCambio: tasa }
        break
      }
    }
    form.setValue("distribuciones", distribuciones)
    // Proceed to submit
    await onSubmit(form.getValues())
  }

  const onSubmit = async (data: ReconciliacionServicioFormData) => {
    

    // Validar que el total distribuido no exceda el precio del servicio
    const totalDistribuido = data.distribuciones.reduce((sum, dist) => sum + (dist.monto || 0), 0)
    const precioServicio = servicio.total || 0

    if (Math.abs(totalDistribuido - precioServicio) > 0.01) {
      sileo.error({ title: `El monto total distribuido (${totalDistribuido.toFixed(2)}) debe ser igual al precio del servicio (${precioServicio.toFixed(2)})` })
      return
    }

    // Validar que no haya montos negativos
    const montoNegativo = data.distribuciones.find(dist => (dist.monto || 0) <= 0)
    if (montoNegativo) {
      sileo.error({ title: 'Todos los montos deben ser positivos' })
      return
    }

    // Validar compatibilidad de monedas con cuentas
     for (const dist of data.distribuciones) {
       const cuenta = cuentas.find((c: any) => c.cuentaId === dist.cuentaId)
       if (cuenta && dist.moneda !== cuenta.moneda && !dist.tasaCambio) {
         sileo.error({ title: `La distribución en ${dist.moneda} requiere tasa de cambio para la cuenta en ${cuenta.moneda}` })
         return
       }
     }

     // Check if any distribution needs conversion (moneda vs cuenta)
     const anyNeedsConversion = data.distribuciones.some((dist) => {
       const cuenta = cuentas.find((c: any) => c.cuentaId === dist.cuentaId)
      return cuenta && dist.moneda !== cuenta.moneda && !dist.tasaCambio && dist.moneda !== 'CUP'
    })
    if (anyNeedsConversion) {
      setShowTasaCambioDialog(true)
      return
    }

    setIsSubmitting(true)
    try {
      for (const dist of data.distribuciones) {
        const result = await reconciliarServicioAction({
          ventaServicioId: servicio.ventaServicioId!,
          cuentaId: dist.cuentaId,
          tipoPagoId: dist.tipoPagoId,
          monto: dist.monto,
          moneda: dist.moneda,
          observaciones: dist.observaciones,
        });
        if (!result.success) throw new Error(result.error?.message || 'Error al reconciliar');
      }

      sileo.success({ title: 'Servicio reconciliado exitosamente' })

      // Force refresh of servicios pendientes data
      setTimeout(() => {
        onSuccess?.()
      }, 500)

      onClose()
    } catch (error) {
      const errorMessage = (error as { data?: { error?: string } })?.data?.error || "Error al reconciliar el servicio"
      sileo.error({ title: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  const agregarDistribucion = () => {
    const restante = servicio ? ((servicio.total ?? 0) - totalDistribuido) : 0
    append({
      cuentaId: "",
      tipoPagoId: "",
      monto: Math.max(0, restante),
      moneda: "CUP",
      tasaCambio: undefined,
      observaciones: "",
    })
  }

  //Calcular monto convertido
  const calcularMontoConvertido = (monto: number, monedaOrigen: string, monedaDestino: string, tasaCambio?: number) => {
    if (monedaOrigen === monedaDestino) return monto
    if (!tasaCambio) return monto
    return monto * tasaCambio
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[98vw] w-full lg:max-w-[1400px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Reconciliar Servicio
            </DialogTitle>
            <DialogDescription>
              Complete los datos para reconciliar este servicio con una o más cuentas bancarias.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Servicio Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalles del Servicio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">

                  <div>
                    <span className="text-muted-foreground">ID:</span>
                    <p className="font-mono">{servicio.ventaServicioId?.slice(-8) || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fecha Servicio:</span>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(servicio.createdAt || servicio.createdAt)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cliente:</span>
                    <p className="flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {servicio.cliente.clienteId || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Precio:</span>
                    <p className="flex items-center gap-1 font-semibold">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(servicio.total, servicio.servicio.moneda)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Descripción:</span>
                    <p className="text-sm">{servicio.servicio.descripcion}</p>
                  </div>
                </div>


              </CardContent>
            </Card>

            {/* Reconciliation Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribución de Pagos</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="h-full flex flex-col gap-4">
                    {/* Totales */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Total Distribuido</div>
                        <div className="text-lg font-semibold">{formatCurrency(totalDistribuido, servicio.servicio.moneda || 'CUP')}</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className={`text-xs ${montoRestante !== 0 ? 'text-red-600' : 'text-muted-foreground'}`}>Monto Restante</div>
                        <div className={`text-lg font-bold ${montoRestante !== 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(montoRestante, servicio.servicio.moneda || 'CUP')}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pb-2 border-b">
                      <h4 className="font-semibold">Pagos</h4>
                      <Button type="button" size="sm" onClick={agregarDistribucion} className="h-8">
                        <Plus className="mr-2 h-4 w-4" /> Agregar Pago
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-[48vh] overflow-y-auto pr-2">
                      {fields.map((field, index) => {
                        const dist = watchedDistribuciones[index] || {}
                        const cuenta = cuentas.find((c: any) => c.cuentaId === dist.cuentaId)

                        // Filtrar cuentas ya seleccionadas en distribuciones anteriores
                        const cuentasSeleccionadasAnteriores = watchedDistribuciones
                          .slice(0, index)
                          .map((d: any) => d?.cuentaId)
                          .filter(Boolean)
                        const cuentasDisponibles = cuentas.filter((c: any) =>
                          !cuentasSeleccionadasAnteriores.includes(c.cuentaId)
                        )
                        const montoConvertido = cuenta ? calcularMontoConvertido(
                          watchedDistribuciones[index].monto || 0,
                          watchedDistribuciones[index].moneda || 'CUP',
                          cuenta.moneda,
                          watchedDistribuciones[index].tasaCambio
                        ) : 0

                        return (
                          <div key={field.id} className={`border rounded-lg p-3 `}>
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                              {/* Cuenta */}
                              <FormField
                                control={form.control}
                                name={`distribuciones.${index}.cuentaId`}
                                render={({ field }) => (
                                  <FormItem className="lg:col-span-2">
                                    <FormLabel className="text-sm">Cuenta Bancaria</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Selecciona cuenta" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {cuentasDisponibles.filter((cuenta: any) => cuenta.isActive).map((cuenta: any) => (
                                          <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                                            <div className="flex items-center gap-2">
                                              <Building2 className="h-4 w-4" />
                                              <div>
                                                <p className="font-medium">{cuenta.nombreBanco}</p>
                                                <p className="text-xs text-muted-foreground">{cuenta.numeroCuenta} • {cuenta.moneda}</p>
                                              </div>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {/* Tipo Pago */}
                              <FormField
                                control={form.control}
                                name={`distribuciones.${index}.tipoPagoId`}
                                render={({ field }) => (
                                  <FormItem className="lg:col-span-2">
                                    <FormLabel className="text-sm">Tipo de Pago</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Tipo de pago" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {tiposPago.filter((tipo: any) => tipo.isActive).map((tipo: any) => (
                                          <SelectItem key={tipo.tipoId} value={tipo.tipoId}>
                                            <div className="flex items-center gap-2">
                                              <CreditCard className="h-4 w-4" />
                                              <div>
                                                <p className="font-medium">{tipo.nombre}</p>
                                                {tipo.descripcion && <p className="text-xs text-muted-foreground">{tipo.descripcion}</p>}
                                              </div>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {/* Monto */}
                              <FormField
                                control={form.control}
                                name={`distribuciones.${index}.monto`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Monto</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        {...field}
                                        onChange={(e) => {
                                          const value = e.target.value
                                          // Limitar a 2 decimales máximo
                                          const regex = /^\d*\.?\d{0,2}$/
                                          if (regex.test(value) || value === '') {
                                            const newValue = value === '' ? 0 : parseFloat(value) || 0
                                            field.onChange(newValue)
                                          }
                                        }}
                                        className={`h-9 ${field.value > 0 ? 'border-blue-300 bg-blue-50' : ''}`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
                              {/* Moneda */}
                              <FormField
                                control={form.control}
                                name={`distribuciones.${index}.moneda`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Moneda</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="h-9">
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
  // @ts-expect-error
  // @ts-expect-error
  // @ts-expect-error
                                        {monedas.filter((m: any) => m.isActive).map((moneda: any) => (
                                          <SelectItem key={moneda.codigo} value={moneda.codigo}>
                                            {moneda.codigo} - {moneda.nombre}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {/* Tasa de Cambio si aplica */}
                              {cuenta && watchedDistribuciones[index]?.moneda !== cuenta.moneda && (
                                <FormField
                                  control={form.control}
                                  name={`distribuciones.${index}.tasaCambio`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm">Tasa de Cambio</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="0.000001"
                                          min="0"
                                          placeholder="0.000000"
                                          className="h-9"
                                          {...field}
                                          onChange={(e) => {
                                            const value = e.target.value
                                            // Limitar a 6 decimales máximo
                                            const regex = /^\d*\.?\d{0,6}$/
                                            if (regex.test(value) || value === '') {
                                              const newValue = value === '' ? undefined : parseFloat(value) || undefined
                                              field.onChange(newValue)
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}

                              {/* Observaciones */}
                              <FormField
                                control={form.control}
                                name={`distribuciones.${index}.observaciones`}
                                render={({ field }) => (
                                  <FormItem className={cuenta && watchedDistribuciones[index]?.moneda !== cuenta.moneda ? "" : "lg:col-span-2"}>
                                    <FormLabel className="text-sm">Observaciones</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Observaciones para este pago..." className="h-9" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                                {/* Información de conversión y estado - más compacta */}
                            {(cuenta && watchedDistribuciones[index].moneda !== cuenta.moneda && watchedDistribuciones[index].tasaCambio) && (
                              <div className=" border border-green-200 rounded-lg p-2 mt-2">
                                <div className=" flex items-center justify-center">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-white-800">💱 Conversión:</span>
                                    <span className="text-xs text-white-700">
                                      {formatCurrency(watchedDistribuciones[index].monto || 0, watchedDistribuciones[index].moneda)} → {formatCurrency(montoConvertido, cuenta.moneda)}
                                    </span>
                                  </div>
                                  <span className="text-xs text-white-600">
                                    Tasa: 1 {watchedDistribuciones[index].moneda} = {watchedDistribuciones[index].tasaCambio} {cuenta.moneda}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Remove */}
                            {fields.length > 1 && (
                              <div className="flex justify-end mt-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} size="sm">
                        <X className="h-4 w-4 mr-2" />Cancelar
                      </Button>
                      <Button type="submit" disabled={isSubmitting || Math.abs(montoRestante) > 0.01} size="sm">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Reconciliar
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

          </div>
        </DialogContent>
      </Dialog>

        {/* Exchange Rate Dialog */}
        {showTasaCambioDialog && (() => {
        const dist0 = (form.getValues("distribuciones") || [])[0] || {}
        const cuenta0 = cuentas.find((c: any) => c.cuentaId === dist0.cuentaId)
        const monedaOrigen = dist0.moneda || "CUP"
        const monedaDestino = cuenta0?.moneda || "CUP"
        const montoOriginal = dist0.monto || 0
        return (
          <TasaCambioDialog
            isOpen={showTasaCambioDialog}
            onClose={() => setShowTasaCambioDialog(false)}
            monedaOrigen={monedaOrigen}
            monedaDestino={monedaDestino}
            monto={montoOriginal}
            onConfirm={handleTasaCambioConfirm}
            titulo="Confirmar Tasa de Cambio para Servicio"
            descripcion={`Servicio ${servicio.ventaServicioId?.slice(-8) || 'N/A'} - ${formatCurrency(montoOriginal, monedaOrigen)}`}
          />
        )
      })()}
    </>
  )
}