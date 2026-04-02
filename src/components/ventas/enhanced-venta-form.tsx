"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { sileo } from 'sileo'
import { Skeleton } from "@/components/ui/skeleton"
import { DollarSign, Calculator } from "lucide-react"

import { useGetProductosQuery } from "@/lib/redux/services/productosApi"
import { useGetPuntosDeVentaQuery } from "@/lib/redux/services/puntosDeVentaApi"
import { useAddVentaMutation, useUpdateVentaMutation } from "@/lib/redux/services/ventasApi"
import { useGetMonedasQuery } from "@/lib/redux/services/contabilidadApi"
import { TasaCambioDialog } from "@/components/contabilidad/tasa-cambio-dialog"
import { useDispatch } from "react-redux"
import { apiSlice } from "@/lib/redux/services/apiSlice"

const ventaSchema = z.object({
  productoId: z.string({
    required_error: 'El campo Producto no ha sido seleccionado',
  }),
  cantidad: z.coerce.number().positive({
    message: "La cantidad debe ser mayor a 0",
  }),
  puntoDeVentaId: z.string({
    required_error: 'El campo Punto de venta no ha sido seleccionado',
  }),
  moneda: z.string({
    required_error: 'El campo Moneda no ha sido seleccionada',
  }),
  precioVentaOriginal: z.coerce.number().positive({
    message: "El precio debe ser mayor a 0",
  }).optional(),
})

type VentaFormValues = z.infer<typeof ventaSchema>

interface EnhancedVentaFormProps {
  initialData?: {
    ventaId: string
    productoId: string
    cantidad: number
    puntoDeVentaId: string
    moneda?: string
    precioVentaOriginal?: number
  }
}

export function EnhancedVentaForm({ initialData }: EnhancedVentaFormProps) {
  const router = useRouter()
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(false)
  const [showTasaCambioDialog, setShowTasaCambioDialog] = useState(false)
  const [pendingSubmission, setPendingSubmission] = useState<VentaFormValues | null>(null)

  const { data: productos, isLoading: isLoadingProductos } = useGetProductosQuery()
  const { data: puntosDeVenta, isLoading: isLoadingPuntosDeVenta } = useGetPuntosDeVentaQuery()
  const { data: monedasData } = useGetMonedasQuery()

  const [addVenta] = useAddVentaMutation()
  const [updateVenta] = useUpdateVentaMutation()

  const monedas = ((monedasData as any)?.data as any[]) || []
  const monedasActivas = monedas.filter((m: any) => m.isActive)
  const monedaPrincipal = monedas.find((m: any) => m.esPrincipal)?.codigo || "CUP"

  const form = useForm<VentaFormValues>({
    resolver: zodResolver(ventaSchema),
    defaultValues: {
      productoId: initialData?.productoId || "",
      cantidad: initialData?.cantidad || 1,
      puntoDeVentaId: initialData?.puntoDeVentaId || "",
      moneda: initialData?.moneda || monedaPrincipal,
      precioVentaOriginal: initialData?.precioVentaOriginal || undefined,
    },
  })

  const watchedValues = form.watch()
  const selectedProducto = productos?.find(p => p.id === watchedValues.productoId)
  const selectedMoneda = monedasActivas.find(m => m.codigo === watchedValues.moneda)
  const precioVenta = watchedValues.precioVentaOriginal || selectedProducto?.precioVenta || 0
  const totalVenta = (watchedValues.cantidad || 0) * precioVenta

  const requiresExchangeConfirmation = watchedValues.moneda && watchedValues.moneda !== monedaPrincipal

  async function onSubmit(data: VentaFormValues) {
    // If currency is different from principal, show exchange rate dialog
    if (requiresExchangeConfirmation) {
      setPendingSubmission(data)
      setShowTasaCambioDialog(true)
      return
    }

    await submitVenta(data)
  }

  async function submitVenta(data: VentaFormValues, tasaCambio?: number, montoConvertido?: number) {
    setIsLoading(true)
    try {
      const ventaData = {
        ...data,
        // Include exchange rate data if applicable
        ...(tasaCambio && montoConvertido && {
          tasaCambio,
          montoConvertido,
          monedaOriginal: data.moneda,
          montoOriginal: totalVenta,
        }),
      }

      if (initialData) {
        await updateVenta({
          ventaId: initialData.ventaId,
          ...ventaData,
        }).unwrap()
        sileo.success({ title: 'La venta ha sido actualizada exitosamente' })
      } else {
        await addVenta(ventaData).unwrap()
        sileo.success({ title: 'La venta ha sido registrada exitosamente' })
        dispatch(apiSlice.util.invalidateTags(['Productos']))
      }
      router.refresh()
    } catch (error) {
      console.error("Error al guardar la venta:", error)
      sileo.error({ title: 'Hubo un error al guardar la venta' })
    } finally {
      setIsLoading(false)
      setPendingSubmission(null)
      setShowTasaCambioDialog(false)
    }
  }

  const handleExchangeConfirm = (tasa: number, montoConvertido: number) => {
    if (pendingSubmission) {
      submitVenta(pendingSubmission, tasa, montoConvertido)
    }
  }

  const handleExchangeCancel = () => {
    setShowTasaCambioDialog(false)
    setPendingSubmission(null)
  }

  if (isLoadingProductos || isLoadingPuntosDeVenta) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="flex justify-end space-x-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-6">
              <FormField
                control={form.control}
                name="productoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Producto</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un producto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productos?.map((producto) => (
                          <SelectItem key={producto.id} value={producto.id}>
                            {producto.nombre} - Stock: {producto.stock} {producto.unidad?.simbolo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Seleccione el producto que se vendió.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cantidad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cantidad</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormDescription>Ingrese la cantidad vendida.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="puntoDeVentaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Punto de Venta</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un punto de venta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {puntosDeVenta?.map((puntoDeVenta) => (
                          <SelectItem key={puntoDeVenta.pvId} value={puntoDeVenta.pvId}>
                            {puntoDeVenta.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Seleccione el punto de venta donde se realizó la venta.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency Selection */}
              <FormField
                control={form.control}
                name="moneda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Moneda de la Venta
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
                      Seleccione la moneda en que se realizó la venta.
                      {requiresExchangeConfirmation && (
                        <span className="text-amber-600 block mt-1">
                          Se solicitará confirmación de tasa de cambio.
                        </span>
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Optional Price Override */}
              {selectedProducto && (
                <FormField
                  control={form.control}
                  name="precioVentaOriginal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio de Venta (Opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={`Precio por defecto: ${selectedProducto.precioVenta.toFixed(2)}`}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Deje vacío para usar el precio por defecto del producto.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}           
                />
              )}

              {/* Sale Summary */}
              {selectedProducto && watchedValues.cantidad && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calculator className="h-4 w-4" />
                      <h3 className="font-medium">Resumen de la Venta</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Producto:</p>
                        <p className="font-medium">{selectedProducto.nombre}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cantidad:</p>
                        <p className="font-medium">{watchedValues.cantidad} {selectedProducto.unidad?.simbolo}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Precio unitario:</p>
                        <p className="font-medium">
                          {precioVenta.toFixed(2)} {selectedMoneda?.simbolo || watchedValues.moneda}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total:</p>
                        <Badge variant="default" className="text-sm">
                          {totalVenta.toFixed(2)} {selectedMoneda?.simbolo || watchedValues.moneda}
                        </Badge>
                      </div>
                    </div>
                    {requiresExchangeConfirmation && (
                      <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                        Esta venta requiere conversión de moneda. Se solicitará confirmación de la tasa de cambio.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={() => router.push("/busy/sales")}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading} variant='outline'>
                  {isLoading ? "Guardando..." : initialData ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Exchange Rate Confirmation Dialog */}
      {showTasaCambioDialog && pendingSubmission && (
        <TasaCambioDialog
          isOpen={showTasaCambioDialog}
          onClose={handleExchangeCancel}
          monedaOrigen={pendingSubmission.moneda}
          monedaDestino={monedaPrincipal}
          monto={totalVenta}
          onConfirm={handleExchangeConfirm}
          titulo="Confirmar Tasa de Cambio para Venta"
          descripcion={`Venta de ${selectedProducto?.nombre} - ${totalVenta.toFixed(2)} ${selectedMoneda?.simbolo || pendingSubmission.moneda}`}
        />
      )}
    </>
  )
}