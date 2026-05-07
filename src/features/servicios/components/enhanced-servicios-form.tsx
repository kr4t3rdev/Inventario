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
import { CurrencyInput } from "@/components/ui/currency-input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { sileo } from '@/lib/sileo-shim'
import { Skeleton } from "@/components/ui/skeleton"
import { DollarSign, Briefcase } from "lucide-react"
import { v4 } from "uuid"
import { useAddServiciosMutation, useGetServiciosQuery, useUpdateServiciosMutation } from "@/features/servicios/api/serviciosApi"
import { useGetMonedasQuery } from "@/features/contabilidad/api/contabilidadApi"
import { TasaCambioDialog } from "@/features/contabilidad/components/tasa-cambio-dialog"

const servicioSchema = z.object({
  nombre: z.string({
    required_error: 'El campo Tipo de servicio no ha sido rellenado',
  }),
  precio: z.coerce.number().positive({
    message: "El monto debe ser mayor a 0",
  }),
  descripcion: z.string({
    message: "Escriba una descripción"
  }),
  moneda: z.string({
    required_error: 'El campo Moneda no ha sido seleccionada',
  }),
})

type ServicioFormValues = z.infer<typeof servicioSchema>

interface EnhancedServicioFormProps {
  initialData?: {
    servicioId: string
    nombre: string
    precio: number
    descripcion: string
    moneda?: string
  }
}

export function EnhancedServicioForm({ initialData }: EnhancedServicioFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showTasaCambioDialog, setShowTasaCambioDialog] = useState(false)
  const [pendingSubmission, setPendingSubmission] = useState<ServicioFormValues | null>(null)

  const { data: servicios, isLoading: isLoadingServicios } = useGetServiciosQuery()
  const { data: monedasData } = useGetMonedasQuery()

  const [addServicios] = useAddServiciosMutation()
  const [updateServicios] = useUpdateServiciosMutation()

  const monedas = monedasData?.data || []
  const monedasActivas = monedas.filter(m => m.isActive)
  const monedaPrincipal = monedas.find(m => m.esPrincipal)?.codigo || "CUP"

  const form = useForm<ServicioFormValues>({
    resolver: zodResolver(servicioSchema),
    defaultValues: {
      nombre: initialData?.nombre || '',
      descripcion: initialData?.descripcion || '',
      precio: initialData?.precio ?? undefined,
      moneda: initialData?.moneda || monedaPrincipal,
    },
  })

  const watchedValues = form.watch()
  const selectedMoneda = monedasActivas.find(m => m.codigo === watchedValues.moneda)
  const requiresExchangeConfirmation = watchedValues.moneda && watchedValues.moneda !== monedaPrincipal

  async function onSubmit(data: ServicioFormValues) {
    // If currency is different from principal, show exchange rate dialog
    if (requiresExchangeConfirmation) {
      setPendingSubmission(data)
      setShowTasaCambioDialog(true)
      return
    }

    await submitServicio(data)
  }

  async function submitServicio(data: ServicioFormValues, tasaCambio?: number, montoConvertido?: number) {
    setIsLoading(true)
    try {
      const servicioData = {
        ...data,
        // Include exchange rate data if applicable
        ...(tasaCambio && montoConvertido && {
          tasaCambio,
          montoConvertido,
          monedaOriginal: data.moneda,
          montoOriginal: data.precio,
        }),
      }

      if (initialData) {
        await updateServicios({
          servicioId: initialData.servicioId,
          ...servicioData,
        }).unwrap()
        sileo.success({ title: 'El servicio ha sido actualizado exitosamente.' })
      } else {
        await addServicios({
          servicioId: v4(),
          ...servicioData
        }).unwrap()
        sileo.success({ title: 'El servicio ha sido registrado exitosamente.' })
      }
      router.back()
    } catch (error) {
      console.error("Error al guardar el servicio:", error)
      sileo.error({ title: 'Hubo un error al guardar el servicio.' })
    } finally {
      setIsLoading(false)
      setPendingSubmission(null)
      setShowTasaCambioDialog(false)
    }
  }

  const handleExchangeConfirm = (tasa: number, montoConvertido: number) => {
    if (pendingSubmission) {
      submitServicio(pendingSubmission, tasa, montoConvertido)
    }
  }

  const handleExchangeCancel = () => {
    setShowTasaCambioDialog(false)
    setPendingSubmission(null)
  }

  if (isLoadingServicios) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
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
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Servicio</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormDescription>Ingrese el tipo de servicio.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormDescription>Ingrese la descripción para el servicio.</FormDescription>
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
                      Moneda del Servicio
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
                      Seleccione la moneda en que se factura el servicio.
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
              
              <FormField
                control={form.control}
                name="precio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio del Servicio</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      Ingrese el monto del servicio en {selectedMoneda?.nombre || watchedValues.moneda}.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Service Summary */}
              {watchedValues.nombre && watchedValues.precio && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase className="h-4 w-4" />
                      <h3 className="font-medium">Resumen del Servicio</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Servicio:</p>
                        <p className="font-medium">{watchedValues.nombre}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Descripción:</p>
                        <p className="font-medium">{watchedValues.descripcion || "Sin descripción"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Moneda:</p>
                        <p className="font-medium">{selectedMoneda?.nombre || watchedValues.moneda}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Precio:</p>
                        <Badge variant="default" className="text-sm">
                          {Number(watchedValues.precio).toFixed(2)} {selectedMoneda?.simbolo || watchedValues.moneda}
                        </Badge>
                      </div>
                    </div>
                    {requiresExchangeConfirmation && (
                      <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                        Este servicio requiere conversión de moneda. Se solicitará confirmación de la tasa de cambio.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={() => router.push("/busy/servicios")}>
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
          monto={pendingSubmission.precio}
          onConfirm={handleExchangeConfirm}
          titulo="Confirmar Tasa de Cambio para Servicio"
          descripcion={`Servicio: ${pendingSubmission.nombre} - ${pendingSubmission.precio.toFixed(2)} ${selectedMoneda?.simbolo || pendingSubmission.moneda}`}
        />
      )}
    </>
  )
}