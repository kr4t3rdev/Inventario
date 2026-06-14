"use client"

import { useState, useEffect, useCallback } from "react"
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
import {
  Loader2,
  Save,
  X,
  ShoppingCart,
  Building2,
  CreditCard,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { reconciliarVentaAction } from "@/features/contabilidad/actions-reconciliacion"
import { useCuentasBancarias } from "@/features/contabilidad/hooks/use-cuentas-bancarias"
import { getTiposPagoAction } from "@/features/contabilidad/actions-tipos-pago"
import { getMonedasAction } from "@/features/contabilidad/actions-exchange"
import type { VentaPendiente } from "@/app/models/model"

// Validation schema for individual distribution
const distribucionSchema = z.object({
  cuentaId: z.string().min(1, "Seleccione una cuenta bancaria"),
  tipoPagoId: z.string().min(1, "Seleccione un tipo de pago"),
  monto: z.number().min(0.01, "El monto debe ser mayor a 0"),
  moneda: z.string().min(1, "Seleccione una moneda"),
  tasaCambio: z.number().positive().optional(),
  idTransferencia: z.string().optional(),
  observaciones: z.string().optional(),
})

// Main validation schema
const reconciliacionVentaSchema = z.object({
  ventaId: z.string().min(1, "ID de venta requerido"),
  distribuciones: z.array(distribucionSchema).min(1, "Debe agregar al menos una distribución"),
}).refine((data) => {
  // This validation will be done in the component with access to the sale total
  return true
}, {
  message: "La suma de las distribuciones debe coincidir con el total de la venta"
})

type ReconciliacionVentaFormData = z.infer<typeof reconciliacionVentaSchema>

interface ReconciliacionVentasFormProps {
  venta: VentaPendiente
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  allowPartial?: boolean
  saldoRestante?: number
}

const MONEDA_SIMBOLOS: Record<string, string> = {
  CUP: "CUP",
  USD: "$",
  EUR: "€",
}

export function ReconciliacionVentasForm({
  venta,
  open,
  onClose,
  onSuccess,
  allowPartial = true,
  saldoRestante
}: ReconciliacionVentasFormProps) {
  const [monedas, setMonedas] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { cuentas, isLoading: isLoadingCuentas } = useCuentasBancarias()
  const [tiposPago, setTiposPago] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [totalDistribuido, setTotalDistribuido] = useState(0)
  const [montoRestante, setMontoRestante] = useState(0)
  const [forceUpdate, setForceUpdate] = useState(0)



  const form = useForm<ReconciliacionVentaFormData>({
    resolver: zodResolver(reconciliacionVentaSchema), 
    defaultValues: {
      ventaId: "",
      distribuciones: [{
        cuentaId: "",
        tipoPagoId: "",
        monto: 0,
        moneda: "CUP",
        tasaCambio: undefined,
        idTransferencia: "",
        observaciones: "",
      }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "distribuciones",
  })

  // Reset form when venta changes or dialog opens
  useEffect(() => {
    if (open && venta) {
      const montoBase = (saldoRestante ?? venta.saldoPendiente ?? venta.total ?? 0)
      form.reset({
        ventaId: venta.ventaId,
        distribuciones: [{
          cuentaId: "",
          tipoPagoId: "",
          monto: montoBase,
          moneda: "CUP",
          tasaCambio: undefined,
          idTransferencia: "",
          observaciones: "",
        }],
      })
      // Initial calculation
      setTotalDistribuido(montoBase)
      setMontoRestante(0)
    }
  }, [open, venta, form, saldoRestante])

  // Watch distribuciones array with useWatch for better reactivity
  const watchedDistribuciones = useWatch({
    control: form.control,
    name: "distribuciones",
    defaultValue: []
  })

  // Function to recalculate totals manually
  const recalcularTotales = useCallback(() => {
    if (venta) {
      const montoBase = (saldoRestante ?? venta.saldoPendiente ?? venta.total ?? 0)
      const distribuciones = form.getValues("distribuciones") || []
      const total = distribuciones.reduce((sum: number, dist: any) => {
        if (!dist) return sum
        const monto = typeof dist.monto === 'number' ? dist.monto : parseFloat(dist.monto) || 0
        return sum + monto
      }, 0)

      setTotalDistribuido(total)
      setMontoRestante(montoBase - total)
      setForceUpdate(prev => prev + 1) // Force re-render
    }
  }, [venta, form, saldoRestante])

  // Calculate totals and remaining amount - runs on every form change
  useEffect(() => {
    if (venta && Array.isArray(watchedDistribuciones)) {
      // Usar saldoPendiente calculado por el backend si existe, sino calcularlo
      const montoTotal = venta.total ?? 0
      // Si saldoRestante viene como prop, úsalo (prioridad UI). 
      // Si no, usa venta.saldoPendiente (que ahora viene del backend).
      // Si no, asume total.
      const saldoInicial = saldoRestante !== undefined 
        ? saldoRestante 
        : (venta.saldoPendiente !== undefined ? venta.saldoPendiente : montoTotal)

      const totalDistribuidoActual = watchedDistribuciones.reduce((sum: number, dist: any) => {
        if (!dist) return sum
        const monto = typeof dist.monto === 'number' ? dist.monto : parseFloat(dist.monto) || 0
        return sum + monto
      }, 0)

      setTotalDistribuido(totalDistribuidoActual)
      // El remanente es sobre el saldo pendiente, no sobre el total original (a menos que no haya pagos previos)
      setMontoRestante(saldoInicial - totalDistribuidoActual)
    }
  }, [watchedDistribuciones, venta, saldoRestante])

  // Also recalculate on form changes with a small delay
  useEffect(() => {
    const subscription = form.watch(() => {
      setTimeout(recalcularTotales, 10)
    })
    return () => subscription.unsubscribe()
  }, [form, recalcularTotales])

  // Function to check if exchange rate is required
  const getTasaCambioRequerida = (distribucion: any, index: number) => {
    const cuenta = cuentasActivas.find((c: any) => c.cuentaId === distribucion.cuentaId)
    const requiereConversionCuenta = cuenta && distribucion.moneda !== cuenta.moneda
    const requiereConversionACup = distribucion.moneda && distribucion.moneda !== 'CUP'
    return Boolean(requiereConversionCuenta || requiereConversionACup)
  }

  // Function to calculate converted amount
  const calcularMontoConvertido = (monto: number, monedaOrigen: string, monedaDestino: string, tasaCambio?: number) => {
    if (monedaOrigen === monedaDestino) return monto
    if (!tasaCambio) return monto
    return monto * tasaCambio
  }

  // Function to add new distribution
  const agregarDistribucion = () => {
    const montoBase = venta ? (saldoRestante ?? venta.saldoPendiente ?? venta.total ?? 0) : 0
    const currentRestante = venta ? (montoBase - totalDistribuido) : 0
    append({
      cuentaId: "",
      tipoPagoId: "",
      monto: Math.max(0, currentRestante),
      moneda: "CUP",
      tasaCambio: undefined,
      idTransferencia: "",
      observaciones: "",
    })
  }

  // Function to remove distribution
  const eliminarDistribucion = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
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

  const onSubmit = async (data: ReconciliacionVentaFormData) => {
    if (!venta) return

    if (!allowPartial && Math.abs(montoRestante) > 0.01) {
      form.setError("root", {
        type: "manual",
        message: `El monto total debe estar completamente distribuido. Restante: ${montoRestante.toFixed(2)}`
      })
      return
    }
    if (totalDistribuido <= 0.01) {
      form.setError("root", {
        type: "manual",
        message: "Debe ingresar al menos un monto a pagar"
      })
      return
    }

    // Validate required exchange rates
    let hasErrors = false
    data.distribuciones.forEach((dist, index) => {
      if (getTasaCambioRequerida(dist, index) && !dist.tasaCambio) {
        form.setError(`distribuciones.${index}.tasaCambio`, {
          type: "manual",
          message: "Tasa de cambio requerida para conversión de moneda"
        })
        hasErrors = true
      }
    })

    if (hasErrors) return

    setIsSubmitting(true)
    try {
      // Process each distribution individually
      for (const distribucion of data.distribuciones) {
        const result = await reconciliarVentaAction({
          ventaId: data.ventaId,
          cuentaId: distribucion.cuentaId,
          tipoPagoId: distribucion.tipoPagoId,
          monto: distribucion.monto,
          moneda: distribucion.moneda,
          observaciones: distribucion.observaciones,
        });
        if (!result.success) throw new Error(result.error?.message || 'Error al reconciliar');
      }

      toast.success('Venta reconciliada exitosamente')
      onSuccess?.()
      onClose()
    } catch (error: any) {
      console.error("Error al reconciliar venta:", error)
      form.setError("root", {
        type: "manual",
        message: error?.data?.message || "Error al procesar la reconciliación"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const cuentasActivas = (cuentas || []).filter((cuenta: any) => cuenta.isActive)
  const tiposPagoActivos = tiposPago.filter(tipo => tipo.isActive)

  if (!venta) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] w-full lg:max-w-[1600px] h-[96vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold">Reconciliar Venta</DialogTitle>
          <DialogDescription>
            Distribuye el saldo pendiente de la venta en una o más cuentas bancarias y tipos de pago.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-row gap-6 overflow-hidden p-6">
          {/* Panel izquierdo - Información de la Venta */}
          <div className="w-[380px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto pr-4 border-r">
            {/* Detalles de la Venta */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5" />
                <span>Detalles de la Venta</span>
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID Venta:</span>
                  <span className="font-mono px-2 py-0.5 rounded">{venta.ventaId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha:</span>
                  <span className="font-medium">{formatDate(venta.createdAt)}</span>
                </div>
                {/* <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium text-right">{venta.cliente?.nombre || "N/A"}</span>
                </div> */}
                <div className="flex justify-between items-baseline pt-2 mt-2 border-t">
                  <span className="text-lg font-semibold">Saldo por Reconciliar:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency((saldoRestante ?? venta.saldoPendiente ?? venta.total ?? 0), 'CUP')}
                  </span>
                </div>
              </div>
            </div>

            {/* Resumen de Distribución */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5" />
                <span>Resumen de Pagos</span>
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Distribuido:</span>
                  <span className={`font-medium ${totalDistribuido > 0 ? 'text-green-600' : ''}`}>
                    {formatCurrency(totalDistribuido, 'CUP')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto Restante:</span>
                  <span className={`font-bold ${montoRestante !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(montoRestante, 'CUP')}
                  </span>
                </div>
              </div>
              {montoRestante !== 0 && (
                <div className="mt-3 flex items-center gap-2 bg-yellow-100 border border-yellow-300 text-yellow-800 text-xs p-2 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  <span>Distribución Pendiente</span>
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho - Formulario de Distribuciones */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, () => { toast.error('Completá los campos requeridos antes de continuar.') })} className="h-full flex flex-col">
                {/* Header de Distribuciones */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b">
                  <h3 className="font-semibold text-lg">Distribución de Pagos</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={recalcularTotales}
                      className="h-8"
                    >
                      Recalcular
                    </Button>
                    <Button
                      type="button"
                      onClick={agregarDistribucion}
                      size="sm"
                      className="h-8"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar Pago
                    </Button>
                  </div>
                </div>

                {/* Distribuciones Container */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                  {fields.map((field, index) => {
                    const distribucion = watchedDistribuciones[index] || {}
                    const cuenta = cuentasActivas.find((c: any) => c.cuentaId === distribucion.cuentaId)
                    const requiereTasaCambio = getTasaCambioRequerida(distribucion, index)
                    const montoConvertido = cuenta ? calcularMontoConvertido(
                      distribucion.monto || 0,
                      distribucion.moneda || 'CUP',
                      cuenta.moneda,
                      distribucion.tasaCambio
                    ) : 0

                    // Filtrar cuentas ya seleccionadas en distribuciones anteriores
                    const cuentasSeleccionadasAnteriores = watchedDistribuciones
                      .slice(0, index)
                      .map((d: any) => d?.cuentaId)
                      .filter(Boolean)
                    const cuentasDisponibles = cuentasActivas.filter((c: any) =>
                      !cuentasSeleccionadasAnteriores.includes(c.cuentaId)
                    )

                    return (
                      <div key={field.id} className={`border-2 rounded-lg p-4 transition-all duration-200`}>
                        {/* Header compacto */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold">Pago #{index + 1}</h4>
                            {distribucion.monto > 0 && (
                              <div className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                                {formatCurrency(distribucion.monto, distribucion.moneda || 'CUP')}
                              </div>
                            )}
                          </div>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => eliminarDistribucion(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* Grid horizontal más amplio */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                          {/* Cuenta Bancaria */}
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
                                    {cuentasDisponibles.map((cuenta: any) => (
                                      <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                                        <div className="flex items-center gap-2">
                                          <Building2 className="h-4 w-4" />
                                          <div>
                                            <p className="font-medium">{cuenta.nombreBanco}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {cuenta.numeroCuenta} • {cuenta.moneda}
                                            </p>
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

                          {/* Tipo de Pago */}
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
                                    {tiposPagoActivos.map((tipo) => (
                                      <SelectItem key={tipo.tipoId} value={tipo.tipoId}>
                                        <div className="flex items-center gap-2">
                                          <CreditCard className="h-4 w-4" />
                                          <div>
                                            <p className="font-medium">{tipo.nombre}</p>
                                            {tipo.descripcion && (
                                              <p className="text-xs text-muted-foreground">
                                                {tipo.descripcion}
                                              </p>
                                            )}
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
                                <FormLabel className="flex items-center justify-between text-sm">
                                  <span>Monto</span>
                                  {montoRestante > 0 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const currentMonto = field.value || 0
                                        field.onChange(currentMonto + montoRestante)
                                        setTimeout(recalcularTotales, 0)
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-700 h-auto p-1"
                                    >
                                      +{formatCurrency(montoRestante, 'CUP')}
                                    </Button>
                                  )}
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                  <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                    max={(saldoRestante ?? venta.saldoPendiente ?? venta.total ?? 0)}
                                      placeholder="0.00"
                                      {...field}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        // Limitar a 2 decimales máximo
                                        const regex = /^\d*\.?\d{0,2}$/
                                        if (regex.test(value) || value === '') {
                                          const newValue = value === '' ? 0 : parseFloat(value) || 0
                                          field.onChange(newValue)

                                          // Immediate calculation without waiting for useEffect
                                          if (venta) {
                                            const currentDistribuciones = form.getValues("distribuciones") || []
                                            // Update the current field value in the calculation
                                            currentDistribuciones[index] = { ...currentDistribuciones[index], monto: newValue }

                                            const total = currentDistribuciones.reduce((sum: number, dist: any) => {
                                              if (!dist) return sum
                                              const monto = typeof dist.monto === 'number' ? dist.monto : parseFloat(dist.monto) || 0
                                              return sum + monto
                                            }, 0)

                                            setTotalDistribuido(total)
                                            setMontoRestante((saldoRestante ?? venta.saldoPendiente ?? venta.total ?? 0) - total)
                                          }
                                        }
                                      }}
                                      className={`pr-12 h-9 ${field.value > 0 ? 'border-blue-300' : ''}`}
                                    />
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                                      CUP
                                    </div>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Segunda fila para campos adicionales */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
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

                          {/* Tasa de Cambio */}
                          {requiereTasaCambio && (
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

                          {/* Observaciones - inline */}
                          <FormField
                            control={form.control}
                            name={`distribuciones.${index}.observaciones`}
                            render={({ field }) => (
                              <FormItem className={requiereTasaCambio ? "lg:col-span-1" : "lg:col-span-2"}>
                                <FormLabel className="text-sm">Observaciones</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Observaciones para este pago..."
                                    className="h-9"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* ID Transferencia */}
                          <FormField
                            control={form.control}
                            name={`distribuciones.${index}.idTransferencia`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">ID Transferencia / Ref. Pago</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Id/Comprobante de transferencia"
                                    className="h-9"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Información de conversión y estado - más compacta */}
                        {(cuenta && distribucion.moneda !== cuenta.moneda && distribucion.tasaCambio) && (
                          <div className=" border border-green-200 rounded-lg p-2 mt-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-white-800">💱 Conversión:</span>
                                <span className="text-xs text-white-700">
                                  {formatCurrency(distribucion.monto || 0, distribucion.moneda)} → {formatCurrency(montoConvertido, cuenta.moneda)}
                                </span>
                              </div>
                              <span className="text-xs text-white-600">
                                Tasa: 1 {distribucion.moneda} = {distribucion.tasaCambio} {cuenta.moneda}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Errores generales */}
                {form.formState.errors.root && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium text-sm">Error:</span>
                    </div>
                    <p className="text-red-700 text-sm mt-1">{form.formState.errors.root.message}</p>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex justify-end gap-3 pt-4 mt-auto border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isSubmitting}
                    size="sm"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || (!allowPartial && Math.abs(montoRestante) > 0.01) || totalDistribuido <= 0.01}
                    size="sm"
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {isSubmitting ? "Procesando..." : (montoRestante > 0.01 && allowPartial ? "Registrar Pago Parcial" : "Reconciliar Completo")}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
