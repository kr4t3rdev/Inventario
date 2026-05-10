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
  Receipt,
  DollarSign,
  Building2,
  CreditCard,
  Plus,
  Trash2,
} from "lucide-react"
import { sileo } from '@/lib/sileo-shim'
import { reconciliarGastoAction } from "@/features/contabilidad/actions-reconciliacion"
import { getCuentasBancariasAction } from "@/features/contabilidad/actions-cuentas-bancarias"
import { getTiposPagoAction } from "@/features/contabilidad/actions-tipos-pago"
import { TasaCambioDialog } from "./tasa-cambio-dialog"

interface GastoPendiente {
  tipo: 'salario' | 'gastoDE' | 'compra'
  referenciaId: string
  descripcion: string
  monto: number
  periodo?: string
  detalles: {
    empleado?: {
      nombre: string
      apellido: string
      cargo: string
    }
    salarioBases?: number
    bonificaciones?: number
    deducciones?: number
    horasExtras?: number
    tipo?: string
    proveedor?: string
    descripcionOriginal?: string
    isPagado?: string
    producto?: string
    vendor?: string
    cantidad?: number
    precioUnitario?: number
    fechaCompra?: string
  }
  createdAt: string
  updatedAt: string
}

// Validation schema aligned with servicios (multi-distribuciones)
const distribucionSchema = z.object({
  cuentaId: z.string().min(1, "Seleccione una cuenta bancaria"),
  tipoPagoId: z.string().min(1, "Seleccione un tipo de pago"),
  monto: z.number().min(0.01, "El monto debe ser mayor a 0"),
  moneda: z.string().min(1, "Seleccione una moneda"),
  tasaCambio: z.number().positive().optional(),
  observaciones: z.string().optional(),
  numeroTransaccion: z.string().min(1, "El número de transacción es requerido"),
})

const reconciliacionGastoSchema = z.object({
    referenciaId: z.string().min(1, 'ID de referencia es requerido'),
    distribuciones: z.array(distribucionSchema).min(1, "Debe agregar al menos una distribución"),
})

type ReconciliacionGastoFormData = z.infer<typeof reconciliacionGastoSchema>

interface ReconciliacionGastosFormProps {
  gasto: GastoPendiente
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  isCuentaPorPagar?: boolean
  cuentaPorPagarId?: string
}

const MONEDA_SIMBOLOS: Record<string, string> = {
  CUP: "CUP",
  USD: "$",
  EUR: "€",
}

const TIPO_GASTO_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  salario: { label: "Salario", icon: Receipt, color: "bg-blue-100 text-blue-800" },
  gastoDE: { label: "Gasto DE", icon: Building2, color: "bg-orange-100 text-orange-800" },
  compra: { label: "Compra", icon: Receipt, color: "bg-green-100 text-green-800" }
}

export function ReconciliacionGastosForm({
  gasto,
  open,
  onClose,
  onSuccess,
  isCuentaPorPagar = false,
  cuentaPorPagarId
}: ReconciliacionGastosFormProps) {
  const [showTasaCambioDialog, setShowTasaCambioDialog] = useState(false)

  const { data: cuentasData = { cuentas: [] } } = useGetCuentasBancariasQuery()
  const { data: tiposPagoData = { data: [] } } = useGetTiposPagoQuery({})
  const { data: monedasData = { data: [] } } = useGetMonedasQuery()
  const [reconciliarGasto, { isLoading }] = useReconciliarGastoMutation()

  // console.log('Cuentas Data:', cuentasData)

  const cuentas = cuentasData.cuentas || []
  const tiposPago = tiposPagoData.data || []
  const monedas = monedasData.data || []

  const form = useForm<ReconciliacionGastoFormData>({
    resolver: zodResolver(reconciliacionGastoSchema),
    defaultValues: {
      referenciaId: gasto?.referenciaId || "",
      distribuciones: [
        {
          cuentaId: "",
          tipoPagoId: "",
          monto: gasto?.monto || 0,
          moneda: "CUP",
          tasaCambio: undefined,
          observaciones: "",
          numeroTransaccion: "",
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
    if (open && gasto && gasto.referenciaId) {
      form.reset({
        referenciaId: gasto.referenciaId,
        distribuciones: [
          {
            cuentaId: "",
            tipoPagoId: "",
            monto: gasto.monto,
            moneda: "CUP",
            tasaCambio: undefined,
            observaciones: "",
            numeroTransaccion: "",
          },
        ],
      })
    }
  }, [open, form, gasto])

  // For cuentas por pagar: monto is fixed and cannot be changed
  const montoFijo = isCuentaPorPagar ? (gasto?.monto ?? 0) : undefined

  // Watch distribuciones for calculations
  const watchedDistribuciones = useWatch({ control: form.control, name: "distribuciones", defaultValue: [] })

  // Calculate totals
  const totalDistribuido = watchedDistribuciones.reduce((sum: number, dist) => {
    if (!dist) return sum
    const monto = typeof dist.monto === 'number' ? dist.monto : parseFloat(dist.monto as string) || 0
    return sum + monto
  }, 0)

  const montoRestante = (gasto?.monto ?? 0) - totalDistribuido

  const formatCurrency = (amount: number | string, currency: string = "CUP") => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    const symbol = MONEDA_SIMBOLOS[currency] || currency
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

  const calcularMontoConvertido = (
    monto: number,
    monedaOrigen: string,
    monedaDestino: string,
    tasaCambio?: number
  ) => {
    if (monedaOrigen === monedaDestino) return monto
    if (!tasaCambio) return monto
    return monto * tasaCambio
  }

  const getGastoDetails = (gasto: GastoPendiente) => {
    switch (gasto.tipo) {
      case 'salario':
        return {
          primary: `${gasto.detalles.empleado?.nombre} ${gasto.detalles.empleado?.apellido}`,
          secondary: gasto.detalles.empleado?.cargo,
          breakdown: [
            { label: "Salario Base", value: gasto.detalles.salarioBases || 0 },
            { label: "Bonificaciones", value: gasto.detalles.bonificaciones || 0 },
            { label: "Horas Extras", value: gasto.detalles.horasExtras || 0 },
            { label: "Deducciones", value: -(gasto.detalles.deducciones || 0) }
          ]
        }
      case 'gastoDE':
        return {
          primary: gasto.detalles.proveedor,
          secondary: gasto.detalles.tipo,
          breakdown: [
            { label: "Monto Total", value: gasto.monto }
          ]
        }
      case 'compra':
        return {
          primary: gasto.detalles.producto,
          secondary: gasto.detalles.vendor,
          breakdown: [
            { label: "Cantidad", value: gasto.detalles.cantidad || 0 },
            { label: "Precio Unitario", value: gasto.detalles.precioUnitario || 0 },
            { label: "Total", value: gasto.monto }
          ]
        }
      default:
        return {
          primary: gasto.descripcion,
          secondary: '',
          breakdown: []
        }
    }
  }

  const agregarDistribucion = () => {
    const restante = gasto ? ((gasto.monto ?? 0) - totalDistribuido) : 0
    append({
      cuentaId: "",
      tipoPagoId: "",
      monto: Math.max(0, restante),
      moneda: "CUP",
      tasaCambio: undefined,
      observaciones: "",
      numeroTransaccion: "",
    })
  }

  /**
   * @description Calcula el monto convertido cuando la moneda de origen difiere de la moneda destino.
   * @param {number} monto - Monto en moneda de origen.
   * @param {string} moneda_origen - Código de moneda de origen.
   * @param {string} moneda_destino - Código de moneda destino.
   * @param {number | undefined} tasa_cambio - Tasa de cambio a aplicar.
   * @returns {number} Monto convertido a la moneda destino.
   */
  const calcular_monto_convertido = (
    monto: number,
    moneda_origen: string,
    moneda_destino: string,
    tasa_cambio?: number
  ): number => {
    if (moneda_origen === moneda_destino) return monto
    if (!tasa_cambio) return monto
    return monto * tasa_cambio
  }

  const handleTasaCambioConfirm = async (tasa: number) => {
    setShowTasaCambioDialog(false)
    // Set tasaCambio on the first distribución that needs it
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

  const onSubmit = async (data: ReconciliacionGastoFormData) => {
    // Validar que el total distribuido no exceda el precio del gasto
    const totalDistribuido = data.distribuciones.reduce((sum, dist) => sum + (dist.monto || 0), 0)
    const precioGasto = gasto.monto || 0

    // Para cuentas por pagar, permitir pagos parciales (no debe exceder el saldo)
    // Para otros casos, el total debe ser exactamente igual al gasto
    if (isCuentaPorPagar) {
      if (totalDistribuido > precioGasto + 0.01) {
        sileo.error({ title: `El monto total distribuido (${totalDistribuido.toFixed(2)}) no puede exceder el saldo pendiente (${precioGasto.toFixed(2)})` })
        return
      }
      if (totalDistribuido <= 0) {
        sileo.error({ title: 'El monto a pagar debe ser mayor a 0' })
        return
      }
    } else {
      if (Math.abs(totalDistribuido - precioGasto) > 0.01) {
        sileo.error({ title: `El monto total distribuido (${totalDistribuido.toFixed(2)}) debe ser igual al precio del gasto (${precioGasto.toFixed(2)})` })
        return
      }
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

    try {
      const descripcionFinal = gasto.descripcion?.trim() || `Gasto ${gasto.tipo}`
      
      // Para cuentas por pagar, usar el monto distribuido (pago parcial)
      // Para otros gastos, usar el monto total del gasto
      const montoPago = isCuentaPorPagar ? totalDistribuido : precioGasto

      const baseData: any = {
        tipoGasto: gasto.tipo,
        referenciaId: gasto.referenciaId,
        tipoPagoId: data.distribuciones[0].tipoPagoId, // Usar el tipoPagoId de la primera distribución
        monto: montoPago,
        moneda: data.distribuciones[0].moneda, // Usar la moneda de la primera distribución
        descripcion: descripcionFinal,
        observaciones: data.distribuciones[0].observaciones, // Usar observaciones de la primera
        tasaCambio: data.distribuciones[0].tasaCambio, // Usar tasaCambio de la primera
        numeroTransaccion: data.distribuciones[0].numeroTransaccion, // Usar numeroTransaccion de la primera
        periodo: gasto.periodo,
        distribucion: data.distribuciones.map(dist => ({
          cuentaId: dist.cuentaId,
          monto: dist.monto,
          porcentaje: Math.round((dist.monto / precioGasto) * 100 * 100) / 100 // Calcular porcentaje
        }))
      }

      // Agregar campos específicos según el tipo de gasto
      if (gasto.tipo === 'salario') {
        baseData.pgId = gasto.referenciaId
      } else if (gasto.tipo === 'gastoDE') {
        baseData.gastosDEId = gasto.referenciaId
      } else if (gasto.tipo === 'compra') {
        baseData.gastoCompraId = gasto.referenciaId
      }

      // Si es cuenta por pagar, agregar el ID y el estado
      if (isCuentaPorPagar && cuentaPorPagarId) {
        baseData.cuentaPorPagarId = cuentaPorPagarId
        baseData.estado = 'PAGADA'
      }

      const reconciliacionData = Object.fromEntries(
        Object.entries(baseData).filter(([_, v]) => v !== undefined && v !== null)
      ) as any

      await reconciliarGasto(reconciliacionData).unwrap()

      sileo.success({ title: 'Gasto reconciliado exitosamente' })

      // Force refresh of gastos pendientes data
      setTimeout(() => {
        onSuccess?.()
      }, 500)

      onClose()
    } catch (error: any) {
      console.error('[ReconciliarGasto] Error en onSubmit →', error)
      const details = Array.isArray(error?.data?.details) ? error.data.details : undefined
      const detailsMsg = details ? ` | Detalles: ${details.map((d: unknown) => ((d as any)?.message || JSON.stringify(d))).join('; ')}` : ''
      const errorMessage = (error?.data?.message || error?.data?.error || error?.message || "Error al reconciliar el gasto") + detailsMsg
      sileo.error({ title: errorMessage })
    }
  }




  // Don't render if gasto is not provided
  if (!gasto) {
    return null
  }

  const gastoDetails = getGastoDetails(gasto)
  const tipoConfig = TIPO_GASTO_LABELS[gasto.tipo]
  const Icon = tipoConfig?.icon || Receipt

  

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[98vw] w-full lg:max-w-[1600px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {isCuentaPorPagar ? 'Registrar Pago a Cuenta por Pagar' : 'Reconciliar Gasto'}
            </DialogTitle>
            <DialogDescription>
              {isCuentaPorPagar 
                ? 'Ingrese el monto a pagar. Puede realizar un pago parcial o total del saldo pendiente.' 
                : 'Complete los datos para reconciliar este gasto con una o más cuentas bancarias.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gasto Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  Detalles del Gasto
                  <Badge className={tipoConfig?.color || "bg-gray-100 text-gray-800"}>
                    {tipoConfig?.label || gasto.tipo}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Descripción:</span>
                    <p className="font-medium">{gastoDetails.primary}</p>
                    {gastoDetails.secondary && (
                      <p className="text-xs text-muted-foreground">{gastoDetails.secondary}</p>
                    )}
                  </div>
                   <div>
                     <span className="text-muted-foreground">ID:</span>
                     <p className="font-mono text-xs">{gasto.referenciaId.slice(-8)}</p>
                   </div>
                   <div>
                     <span className="text-muted-foreground">Período:</span>
                     <p>{gasto.periodo || "N/A"}</p>
                   </div>
                   <div className="col-span-2">
                     <span className="text-muted-foreground">Monto Total:</span>
                     <p className="flex items-center gap-1 font-semibold text-lg">
                       <DollarSign className="h-4 w-4" />
                       {formatCurrency(gasto.monto)}
                     </p>
                   </div>
                </div>

                {gastoDetails.breakdown.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-sm mb-2">Desglose:</h4>
                      <div className="space-y-1">
                        {gastoDetails.breakdown.map((item, index) => (
                          <div key={index} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{item.label}:</span>
                            <span className={item.value < 0 ? "text-red-600" : ""}>
                              {typeof item.value === 'number' && item.label !== "Cantidad"
                                ? formatCurrency(Math.abs(item.value))
                                : item.value
                              }
                            </span>
                          </div>

                        ))}
                      </div>
                    </div>
                  </>
                )}


              </CardContent>
            </Card>

            {/* Reconciliation Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Datos de Reconciliación</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="h-full flex flex-col gap-4">
                     {/* Totales */}
                     <div className="grid grid-cols-2 gap-4">
                       <div className="bg-muted/50 rounded-lg p-3">
                         <div className="text-xs text-muted-foreground">Total a Pagar</div>
                         <div className="text-lg font-semibold">{formatCurrency(totalDistribuido)}</div>
                       </div>
                       <div className="bg-muted/50 rounded-lg p-3">
                         <div className={`text-xs ${!isCuentaPorPagar && montoRestante !== 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                           {isCuentaPorPagar ? 'Saldo después del pago' : 'Monto Restante'}
                         </div>
                         <div className={`text-lg font-bold ${!isCuentaPorPagar && montoRestante !== 0 ? 'text-red-600' : isCuentaPorPagar && montoRestante > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                           {formatCurrency(isCuentaPorPagar ? (gasto?.monto || 0) - totalDistribuido : montoRestante)}
                         </div>
                       </div>
                     </div>

                    <div className="flex items-center justify-between pb-2 border-b">
                      <h4 className="font-semibold">Pagos</h4>
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={agregarDistribucion} 
                        className="h-8"
                        disabled={isCuentaPorPagar}
                        title={isCuentaPorPagar ? "Para cuentas por pagar solo se permite un pago" : "Agregar otro pago"}
                      >
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

                        const montoConvertido = cuenta
                          ? calcularMontoConvertido(
                              dist.monto || 0,
                              dist.moneda || 'CUP',
                              cuenta.moneda,
                              dist.tasaCambio
                            )
                          : 0

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
                                    <FormLabel className="text-sm">
                                      {isCuentaPorPagar ? "Monto a Pagar" : "Monto"}
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={gasto?.monto}
                                        {...field}
                                        onChange={(e) => {
                                          const value = e.target.value
                                          const regex = /^\d*\.?\d{0,2}$/
                                          if (regex.test(value) || value === '') {
                                            const newValue = value === '' ? 0 : parseFloat(value) || 0
                                            // Para cuentas por pagar, validar que no exceda el saldo pendiente
                                            if (isCuentaPorPagar && newValue > (gasto?.monto || 0)) {
                                              sileo.error({ title: `El monto no puede exceder el saldo pendiente de ${formatCurrency(gasto?.monto || 0)}` })
                                              return
                                            }
                                            field.onChange(newValue)
                                          }
                                        }}
                                        className={`h-9 ${field.value > 0 ? 'border-blue-300 bg-blue-50' : ''}`}
                                      />
                                    </FormControl>
                                    {isCuentaPorPagar && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Saldo pendiente: {formatCurrency(gasto?.monto || 0)}
                                      </p>
                                    )}
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
                                          step="0.000000001"
                                          min="0"
                                          placeholder="0.000000000"
                                          className="h-9"
                                          {...field}
                                          onChange={(e) => {
                                            const value = e.target.value
                                            const regex = /^\d*\.?\d{0,9}$/
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
                                  <FormItem>
                                    <FormLabel className="text-sm">Observaciones</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Observaciones para este pago..." className="h-9" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {/* Número de Transacción */}
                              <FormField
                                control={form.control}
                                name={`distribuciones.${index}.numeroTransaccion`}
                                render={({ field }) => (
                                  <FormItem className="lg:col-span-2">
                                    <FormLabel className="text-sm">N° Transacción</FormLabel>
                                    <FormControl>
                                      <Input 
                                        placeholder="Ej: TRX-001234" 
                                        className="h-9 font-mono" 
                                        {...field} 
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                                {/* Conversión */}
                            {(cuenta && watchedDistribuciones[index]?.moneda !== cuenta.moneda && watchedDistribuciones[index]?.tasaCambio) && (
                              <div className="border border-green-200 rounded-lg p-2 mt-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium">Conversión:</span>
                                    <span className="text-xs">
                                      {formatCurrency(dist.monto || 0, dist.moneda || 'CUP')} → {formatCurrency(montoConvertido, cuenta.moneda)}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    Tasa: 1 {dist.moneda || 'CUP'} = {dist.tasaCambio} {cuenta.moneda}
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
                     <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} size="sm">
                       <X className="h-4 w-4 mr-2" />Cancelar
                     </Button>
                     <Button 
                       type="submit" 
                       disabled={isLoading || (!isCuentaPorPagar && Math.abs(montoRestante) > 0.01)} 
                       size="sm"
                     >
                       {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                       {isCuentaPorPagar ? 'Registrar Pago' : 'Reconciliar'}
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
            titulo="Confirmar Tasa de Cambio para Gasto"
            descripcion={`Gasto ${gasto.referenciaId?.slice(-8) || 'N/A'} - ${formatCurrency(montoOriginal, monedaOrigen)}`}
          />
        )
      })()}
    </>
  )
}