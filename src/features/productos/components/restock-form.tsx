"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { motion } from "framer-motion"
import { Package, Calculator, DollarSign, Sparkles, Loader2, ArrowLeft } from "lucide-react"
import { sileo } from '@/lib/sileo-shim'

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProductPhotoUpload } from "./product-photo-upload"

import { restockProductoAction } from "@/features/productos/actions"
import { useMonedas } from "@/features/contabilidad/hooks/use-monedas"
import { useCuentasBancarias } from "@/features/contabilidad/hooks/use-cuentas-bancarias"
import { TasaCambioDialog } from "@/features/contabilidad/components/tasa-cambio-dialog"
import { RestockRequest } from "@/app/models/model"

// Zod schema for restock form validation
const restockSchema = z.object({
  cantidad: z.coerce.number().int("La cantidad debe ser un número entero").positive({
    message: "La cantidad debe ser mayor a 0",
  }),
  numeroFactura: z.string().optional(),
  precioCosto: z.union([
    z.coerce.number().positive("El precio de costo debe ser mayor a 0"),
    z.literal(""),
  ]).optional(),
  precioVenta: z.union([
    z.coerce.number().positive("El precio de venta debe ser mayor a 0"),
    z.literal(""),
  ]).optional(),
  moneda: z.string({
    required_error: 'El campo Moneda no ha sido seleccionada',
  }),
  descripcion: z.string().max(500, "La descripción no puede exceder 500 caracteres").optional(),
  facturaUrl: z.string().optional(),
  formaPago: z.enum(["PAGO_PARCIAL", "PAGO_COMPLETO"]),
  estado: z.enum(["PENDIENTE", "PAGADA"]),
  cuentaId: z.string().optional(),
  tipoRestock: z.enum(["nueva_instancia", "sumar_stock", "auto"]).optional(),
}).refine(
  (data) => {
    const costPrice = typeof data.precioCosto === "number" ? data.precioCosto : undefined
    const sellingPrice = typeof data.precioVenta === "number" ? data.precioVenta : undefined

    if (costPrice !== undefined && sellingPrice !== undefined) {
      return sellingPrice >= costPrice * 1.1
    }
    return true
  },
  {
    message: "El precio de venta debe tener al menos un 10% de margen sobre el costo",
    path: ["precioVenta"]
  }
).refine(
  (data) => {
    if (data.formaPago === "PAGO_COMPLETO") {
      return data.estado === "PAGADA"
    }
    return data.estado === "PENDIENTE"
  },
  {
    message: "El estado no coincide con la forma de pago",
    path: ["estado"]
  }
).refine(
  (data) => {
    if (data.formaPago === "PAGO_COMPLETO") {
      return !!data.cuentaId && data.cuentaId !== ""
    }
    return true
  },
  {
    message: "Debe seleccionar una cuenta bancaria para pago completo",
    path: ["cuentaId"]
  }
)

type RestockFormValues = z.infer<typeof restockSchema>

interface RestockFormProps {
  producto: {
    id: string
    nombre: string
    descripcion: string | null
    precioCosto: number
    precioVenta: number
    stock: number
    unidad?: {
      simbolo: string
    }
  }
  onSuccess?: () => void
  onCancel?: () => void
}

export function RestockForm({ producto, onSuccess, onCancel }: RestockFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showTasaCambioDialog, setShowTasaCambioDialog] = useState(false)
  const [pendingSubmission, setPendingSubmission] = useState<RestockFormValues | null>(null)
  // Estado para el diálogo de selección de tipo de restock
  const [showTipoRestockDialog, setShowTipoRestockDialog] = useState(false)
  const [preciosCambiados, setPreciosCambiados] = useState(false)

  const { monedas: monedasData } = useMonedas()
  const { cuentas: cuentasData } = useCuentasBancarias()
  const monedas = monedasData || []
  const cuentasBancarias: any[] = cuentasData || []

  const monedasActivas = monedas.filter((m: any) => m.isActive)
  const monedaPrincipal = monedas.find((m: any) => m.esPrincipal)?.codigo || "CUP"
  const cuentasMonedaPrincipal = cuentasBancarias.filter((c: any) => c.isActive && c.moneda === monedaPrincipal)

  const cuentaDefecto = cuentasMonedaPrincipal.length > 0 ? cuentasMonedaPrincipal[0].cuentaId : ""

  const form = useForm<RestockFormValues>({
    resolver: zodResolver(restockSchema),
    defaultValues: {
      cantidad: 1,
      numeroFactura: "",
      facturaUrl: "",
      precioCosto: "",
      precioVenta: "",
      moneda: monedaPrincipal,
      descripcion: "",
      formaPago: "PAGO_COMPLETO",
      estado: "PAGADA",
      cuentaId: cuentaDefecto,
    },
  })

  const watchedValues = form.watch()
  const formaPagoSeleccionada = watchedValues.formaPago

  useEffect(() => {
    if (!formaPagoSeleccionada) return
    const nextEstado = formaPagoSeleccionada === "PAGO_COMPLETO" ? "PAGADA" : "PENDIENTE"
    form.setValue("estado", nextEstado, { shouldValidate: true })
  }, [formaPagoSeleccionada, form])
  const cantidad = Number(watchedValues.cantidad) || 0
  const selectedMoneda = monedasActivas.find(m => m.codigo === watchedValues.moneda)
  // Usar la tasaCambio que ahora viene directamente en el objeto moneda desde la API
  const tasaCambioActual = selectedMoneda?.esPrincipal ? 1 : (Number(selectedMoneda?.tasaCambio) || 1)

  const precioCostoInput = Number(watchedValues.precioCosto) || 0
  const precioVentaInput = Number(watchedValues.precioVenta) || 0

  // Precios convertidos para la vista previa (promedio ponderado)
  const precioCostoParaCalculo = precioCostoInput > 0 
    ? precioCostoInput * tasaCambioActual 
    : producto.precioCosto

  const precioVentaParaCalculo = precioVentaInput > 0 
    ? precioVentaInput * tasaCambioActual 
    : producto.precioVenta

  const requiresExchangeConfirmation = watchedValues.moneda && watchedValues.moneda !== monedaPrincipal

  // Calculate estimated totals (in selected currency)
  const totalCosto = cantidad * (precioCostoInput > 0 ? precioCostoInput : (producto.precioCosto / tasaCambioActual))
  const totalVenta = cantidad * (precioVentaInput > 0 ? precioVentaInput : (producto.precioVenta / tasaCambioActual))
  
  // Margen en moneda seleccionada
  const margenEstimado = (precioVentaInput > 0 && precioCostoInput > 0)
    ? precioVentaInput - precioCostoInput
    : (producto.precioVenta / tasaCambioActual) - (producto.precioCosto / tasaCambioActual)

  // Calculate weighted averages preview (always in main currency)
  const newStockTotal = Number(producto.stock) + Number(cantidad)
  const weightedCostPrice = ((Number(producto.precioCosto)) * (Number(producto.stock)) + (precioCostoParaCalculo) * (Number(watchedValues.cantidad))) / newStockTotal
  const weightedSellingPrice = ((Number(producto.precioVenta)) * (Number(producto.stock)) + (precioVentaParaCalculo) * (Number(watchedValues.cantidad))) / newStockTotal




  async function onSubmit(data: RestockFormValues) {
    // Check if prices have changed
    const precioCostoChanged = data.precioCosto && Number(data.precioCosto) !== producto.precioCosto
    const precioVentaChanged = data.precioVenta && Number(data.precioVenta) !== producto.precioVenta
    const hasPriceChanges = Boolean(precioCostoChanged || precioVentaChanged)
    
    setPreciosCambiados(hasPriceChanges)
    
    // If prices changed and no tipoRestock selected yet, show selection dialog
    if (hasPriceChanges && !data.tipoRestock) {
      setPendingSubmission(data)
      setShowTipoRestockDialog(true)
      return
    }
    
    // If currency is different from principal, show exchange rate dialog
    if (requiresExchangeConfirmation) {
      setPendingSubmission(data)
      setShowTasaCambioDialog(true)
      return
    }

    await submitRestock(data)
  }

  async function submitRestock(data: RestockFormValues, tasaCambio?: number, montoConvertido?: number) {
    setIsLoading(true)
    try {
      // Si hay tasa de cambio, convertimos los precios unitarios a la moneda principal
      const precioCostoConvertido = typeof data.precioCosto === "number" && tasaCambio 
        ? data.precioCosto * tasaCambio 
        : typeof data.precioCosto === "number" ? data.precioCosto : undefined

      const precioVentaConvertido = typeof data.precioVenta === "number" && tasaCambio 
        ? data.precioVenta * tasaCambio 
        : typeof data.precioVenta === "number" ? data.precioVenta : undefined

      const estadoFinal = data.formaPago === "PAGO_COMPLETO" ? "PAGADA" : "PENDIENTE"

      const restockRequest: RestockRequest = {
        productoId: producto.id,
        cantidad: data.cantidad,
        precioCosto: precioCostoConvertido,
        precioVenta: precioVentaConvertido,
        numeroFactura: data.numeroFactura?.trim() || "",
        facturaUrl: data.facturaUrl,
        formaPago: data.formaPago,
        estado: estadoFinal,
        descripcion: data.descripcion || undefined,
        cuentaId: data.cuentaId || undefined,
        // Include tipoRestock selection from user
        tipoRestock: data.tipoRestock || 'auto',
        // Include exchange rate data if applicable
        ...(tasaCambio && montoConvertido && {
          moneda: data.moneda,
          tasaCambio,
          montoConvertido,
          monedaOriginal: data.moneda,
          montoOriginal: totalCosto,
        }),
      }

      const result = await restockProductoAction(restockRequest)
      if (!result.success) {
        throw new Error(result.error?.message || 'Error al realizar el restock del producto.')
      }

      sileo.success({ title: `Restock exitoso: ${data.cantidad} ${producto.unidad?.simbolo || "unidades"} agregadas a ${producto.nombre}` })

      if (onSuccess) {
        onSuccess()
      }
    } catch (error: unknown) {
      console.error("Error al realizar restock:", error)

      const errorObj = error as { message?: string }
      sileo.error({ title: `Error: ${errorObj?.message || 'Hubo un error al realizar el restock del producto.'}` })
    } finally {
      setIsLoading(false)
      setPendingSubmission(null)
      setShowTasaCambioDialog(false)
    }
  }

  const handleExchangeConfirm = (tasa: number, montoConvertido: number) => {
    if (pendingSubmission) {
      submitRestock(pendingSubmission, tasa, montoConvertido)
    }
  }

  const handleExchangeCancel = () => {
    setShowTasaCambioDialog(false)
    setPendingSubmission(null)
  }
  
  // Handler for tipo restock selection
  const handleTipoRestockSelect = (tipo: 'nueva_instancia' | 'sumar_stock') => {
    if (pendingSubmission) {
      const dataConTipo = { ...pendingSubmission, tipoRestock: tipo }
      setShowTipoRestockDialog(false)
      
      // If also needs exchange confirmation, show that dialog
      if (requiresExchangeConfirmation) {
        setPendingSubmission(dataConTipo)
        setShowTasaCambioDialog(true)
      } else {
        submitRestock(dataConTipo)
      }
    }
  }

  const handleTipoRestockCancel = () => {
    setShowTipoRestockDialog(false)
    setPendingSubmission(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="overflow-hidden border-dashed bg-linear-to-br from-primary/[0.05] via-background to-purple-500/[0.08] dark:from-primary/10 dark:to-purple-500/10">
        <CardHeader className="border-b bg-linear-to-r from-primary/[0.04] to-purple-500/[0.08] dark:from-primary/10 dark:to-purple-500/10">
          <CardTitle className="flex items-center gap-3">
            <motion.div
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-600 text-white shadow-lg"
              whileHover={{ scale: 1.05, rotate: 4 }}
              transition={{ duration: 0.2 }}
            >
              <Package className="h-5 w-5" />
              <motion.span
                className="absolute -right-1 -top-1"
                animate={{ rotate: 360, scale: [1, 1.15, 1] }}
                transition={{
                  rotate: { duration: 16, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                }}
              >
                <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              </motion.span>
            </motion.div>
            <div>
              <p className="text-lg font-semibold">Restock de Producto</p>
              <p className="text-xs font-normal text-muted-foreground">
                Ajusta stock y precios con cálculo automático de promedio ponderado.
              </p>
            </div>
          </CardTitle>
          <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p><strong className="text-foreground">{producto.nombre}</strong></p>
            <p>Stock actual: {producto.stock} {producto.unidad?.simbolo || "unidades"}</p>
            <p>Precio costo: ${producto.precioCosto.toFixed(2)}</p>
            <p>Precio venta: ${producto.precioVenta.toFixed(2)}</p>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })}
            className="space-y-6 [&_input]:transition-all [&_input]:duration-200 [&_input]:focus-visible:ring-primary/30"
          >
            {/* Cantidad */}
            <FormField
              control={form.control}
              name="cantidad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad a Agregar</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ingrese la cantidad"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Cantidad de {producto.unidad?.simbolo || "unidades"} a agregar al inventario
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Número de factura */}
            <FormField
              control={form.control}
              name="numeroFactura"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nro. Factura</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Ej: F-2024-0012"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Factura entrante asociada a la compra de equipos.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="facturaUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Captura de Factura</FormLabel>
                  <FormControl>
                    <ProductPhotoUpload
                      photos={field.value ? [field.value] : []}
                      onPhotosChange={(photos) => field.onChange(photos[0] || "")}
                      maxPhotos={1}
                    />
                  </FormControl>
                  <FormDescription>
                    Suba la imagen de la factura asociada a esta compra.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="formaPago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de Pago</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione la forma de pago" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PAGO_COMPLETO">Pago completo</SelectItem>
                        <SelectItem value="PAGO_PARCIAL">Pago parcial</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      El pago parcial genera una cuenta por pagar.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PAGADA">Pagada</SelectItem>
                        <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      El estado se ajusta según la forma de pago.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cuenta Bancaria - Solo para pago completo */}
            {formaPagoSeleccionada === "PAGO_COMPLETO" && (
              <FormField
                control={form.control}
                name="cuentaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta Bancaria</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={cuentasMonedaPrincipal.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione la cuenta para pagar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cuentasMonedaPrincipal.length === 0 ? (
                          <SelectItem value="no-cuentas" disabled>
                            No hay cuentas activas en {monedaPrincipal}
                          </SelectItem>
                        ) : (
                          cuentasMonedaPrincipal.map((cuenta: any) => (
                            <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                              {cuenta.nombreBanco} - {cuenta.numeroCuenta.slice(-4)} ({cuenta.moneda})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Cuenta desde donde se realizará el pago
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Currency Selection */}
            {/* <FormField
              control={form.control}
              name="moneda"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Moneda de la Compra
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione la moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {monedasActivas.map((moneda) => (
                        <SelectItem key={moneda.codigo} value={moneda.codigo}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{moneda.codigo}</span>
                            <span className="text-muted-foreground">
                              {moneda.simbolo} - {moneda.nombre}
                            </span>
                            {moneda.esPrincipal && (
                              <Badge variant="secondary" className="text-xs">Principal</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Seleccione la moneda en que se realizó la compra.
                    {requiresExchangeConfirmation && (
                      <span className="text-amber-600 block mt-1">
                        Se solicitará confirmación de tasa de cambio.
                      </span>
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            /> */}

            <Separator />

            {/* Precios */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <h3 className="text-lg font-medium">Precios (Opcional)</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Deje vacío para mantener los precios actuales. Si cambia los precios, se calculará un promedio ponderado.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="precioCosto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nuevo Precio de Costo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder={`Actual: $${producto.precioCosto.toFixed(2)}`}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Precio de costo por unidad en {selectedMoneda?.nombre || watchedValues.moneda}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="precioVenta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nuevo Precio de Venta</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder={`Actual: $${producto.precioVenta.toFixed(2)}`}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Precio de venta por unidad en {selectedMoneda?.nombre || watchedValues.moneda}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Descripción */}
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Motivo del restock, proveedor, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Información adicional sobre este restock
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Resumen de cálculos */}
            {cantidad > 0 && (
              <Card className="border-dashed bg-muted/50 dark:bg-muted/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calculator className="h-4 w-4" />
                    Resumen del Restock
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Stock después del restock:</p>
                      <Badge variant="secondary" className="text-sm">
                        {newStockTotal} {producto.unidad?.simbolo || "unidades"}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-medium">Costo total de compra:</p>
                      <Badge variant="secondary" className="text-sm">
                        {totalCosto.toFixed(2)}{selectedMoneda?.simbolo || watchedValues.moneda}
                        {requiresExchangeConfirmation && (
                          <span className="ml-1 opacity-80">
                            - {(totalCosto * tasaCambioActual).toFixed(2)}$
                          </span>
                        )}
                      </Badge>
                    </div>
                  </div>

                  {requiresExchangeConfirmation && (
                    <div className="mt-3 rounded border border-amber-300/70 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                      Esta compra requiere conversión de moneda. Se solicitará confirmación de la tasa de cambio.
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">Margen estimado por unidad:</span>
                      <Badge variant={margenEstimado > 0 ? "default" : "destructive"} className="text-sm">
                        {margenEstimado.toFixed(2)} {selectedMoneda?.simbolo || watchedValues.moneda}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Botones de acción */}
            <div className="flex flex-col justify-end gap-3 border-t pt-4 sm:flex-row">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                disabled={isLoading || cantidad <= 0}
                className="gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Realizar Restock"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>

      {/* Exchange Rate Confirmation Dialog */}
      {showTasaCambioDialog && pendingSubmission && (
        <TasaCambioDialog
          isOpen={showTasaCambioDialog}
          onClose={handleExchangeCancel}
          monedaOrigen={pendingSubmission.moneda}
          monedaDestino={monedaPrincipal}
          monto={totalCosto}
          onConfirm={handleExchangeConfirm}
          titulo="Confirmar Tasa de Cambio para Compra"
          descripcion={`Restock de ${producto.nombre} - ${totalCosto.toFixed(2)} ${selectedMoneda?.simbolo || pendingSubmission.moneda}`}
        />
      )}

      {/* Tipo de Restock Selection Dialog */}
      {showTipoRestockDialog && (
        <Dialog open={showTipoRestockDialog} onOpenChange={setShowTipoRestockDialog}>
          <DialogContent className="w-[1300px] max-w-[150vw]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-purple-500" />
                ¿Cómo desea realizar el restock?
              </DialogTitle>
              <DialogDescription className="text-base">
                Ha modificado los precios del producto. Elija cómo desea proceder con el stock.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Opción 1: Nueva Instancia */}
              <button
                type="button"
                onClick={() => handleTipoRestockSelect('nueva_instancia')}
                className="w-full p-3 text-left border rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                    <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Crear nueva instancia</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      El stock agregado va a un nuevo producto relacionado con los nuevos precios.
                      El producto original mantiene sus precios actuales.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        Nuevo precio costo: ${Number(watchedValues.precioCosto || 0).toFixed(2)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Nuevo precio venta: ${Number(watchedValues.precioVenta || 0).toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>

              {/* Opción 2: Sumar al stock actual */}
              <button
                type="button"
                onClick={() => handleTipoRestockSelect('sumar_stock')}
                className="w-full p-3 text-left border rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                    <Calculator className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Sumar al stock actual</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Se suma la cantidad al inventario existente y se calcula el promedio ponderado de precios.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        Precio costo promedio: ${weightedCostPrice.toFixed(2)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Precio venta promedio: ${weightedSellingPrice.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={handleTipoRestockCancel}>
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
    </motion.div>
  )
}
