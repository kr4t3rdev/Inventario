"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { v4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { sileo } from '@/lib/sileo-shim'
import { Skeleton } from "@/components/ui/skeleton"
import { DollarSign, User } from "lucide-react"
import { createEmpleadoAction, updateEmpleadoAction } from "@/features/empleados/actions"
import { useGetMonedasQuery } from "@/features/contabilidad/api/contabilidadApi"
import { TasaCambioDialog } from "@/features/contabilidad/components/tasa-cambio-dialog"

const empleadoSchema = z.object({
  nombre: z.string({
    required_error: 'El campo Nombre no ha sido rellenado',
  }),
  apellido: z.string({
    required_error: 'El campo Apellido no ha sido rellenado',
  }),
  salarioBases: z.coerce.number().positive({
    message: "El salarioBase debe ser mayor a 0",
  }),
  telefono: z.string({
    required_error: 'El campo Teléfono no ha sido rellenado',
  }),
  periodo: z.string({
    message: "Escriba un periodo"
  }),
  cargo: z.string({
    required_error: 'El campo Cargo no ha sido rellenado',
  }),
  monedaSalario: z.string({
    required_error: 'El campo Moneda del salario no ha sido seleccionada',
  }),
})

type EmpleadoFormValues = z.infer<typeof empleadoSchema>

interface EnhancedEmpleadoFormProps {
  initialData?: {
    empleadoId: string
    nombre: string
    apellido: string | null
    telefono?: string | undefined
    periodo: string
    salarioBases: number
    cargo: string
    monedaSalario?: string
  }
}

export function EnhancedEmpleadoForm({ initialData }: EnhancedEmpleadoFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showTasaCambioDialog, setShowTasaCambioDialog] = useState(false)
  const [pendingSubmission, setPendingSubmission] = useState<EmpleadoFormValues | null>(null)

  const { isLoading: isLoadingEmpleados } = { isLoading: false }
  const { data: monedasData } = useGetMonedasQuery()

  const monedas = monedasData?.data || []
  const monedasActivas = monedas.filter(m => m.isActive)
  const monedaPrincipal = monedas.find(m => m.esPrincipal)?.codigo || "CUP"

  const form = useForm<EmpleadoFormValues>({
    resolver: zodResolver(empleadoSchema),
    defaultValues: {
      nombre: initialData?.nombre || '',
      apellido: initialData?.apellido || '',
      periodo: initialData?.periodo || '',
      telefono: initialData?.telefono || '',
      salarioBases: initialData?.salarioBases ?? undefined,
      cargo: initialData?.cargo || '',
      monedaSalario: initialData?.monedaSalario || monedaPrincipal,
    },
  })

  const watchedValues = form.watch()
  const selectedMoneda = monedasActivas.find(m => m.codigo === watchedValues.monedaSalario)
  const requiresExchangeConfirmation = watchedValues.monedaSalario && watchedValues.monedaSalario !== monedaPrincipal

  async function onSubmit(data: EmpleadoFormValues) {
    // If currency is different from principal, show exchange rate dialog
    if (requiresExchangeConfirmation) {
      setPendingSubmission(data)
      setShowTasaCambioDialog(true)
      return
    }

    await submitEmpleado(data)
  }

  async function submitEmpleado(data: EmpleadoFormValues, tasaCambio?: number, montoConvertido?: number) {
    setIsLoading(true)
    try {
      const empleadoData = {
        ...data,
        // Include exchange rate data if applicable
        ...(tasaCambio && montoConvertido && {
          tasaCambioSalario: tasaCambio,
          salarioConvertido: montoConvertido,
          monedaOriginalSalario: data.monedaSalario,
          salarioOriginal: data.salarioBases,
        }),
      }

      if (initialData) {
        const result = await updateEmpleadoAction({
          empleadoId: initialData.empleadoId,
          ...empleadoData,
        })
        if (!result.success) {
          sileo.error({ title: result.error?.message || 'Hubo un error al guardar el empleado.' })
          return
        }
        sileo.success({ title: 'El empleado ha sido actualizado exitosamente.' })
      } else {
        const result = await createEmpleadoAction({
          empleadoId: v4(),
          ...empleadoData
        })
        if (!result.success) {
          sileo.error({ title: result.error?.message || 'Hubo un error al guardar el empleado.' })
          return
        }
        sileo.success({ title: 'El empleado ha sido registrado exitosamente.' })
      }
      router.back()
    } catch (error) {
      console.error("Error al guardar el empleado:", error)
      sileo.error({ title: 'Hubo un error al guardar el empleado.' })
    } finally {
      setIsLoading(false)
      setPendingSubmission(null)
      setShowTasaCambioDialog(false)
    }
  }

  const handleExchangeConfirm = (tasa: number, montoConvertido: number) => {
    if (pendingSubmission) {
      submitEmpleado(pendingSubmission, tasa, montoConvertido)
    }
  }

  const handleExchangeCancel = () => {
    setShowTasaCambioDialog(false)
    setPendingSubmission(null)
  }

  if (isLoadingEmpleados) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
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
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormDescription>Ingrese el nombre del empleado.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="apellido"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormDescription>Ingrese el apellido del empleado.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormDescription>Ingrese el número de teléfono del empleado.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormDescription>Ingrese el cargo del empleado.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="periodo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Período</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormDescription>Ingrese el período de pago (ej. 2025-01).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency Selection for Salary */}
              <FormField
                control={form.control}
                name="monedaSalario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Moneda del Salario
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
                      Seleccione la moneda en que se paga el salario.
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
                name="salarioBases"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salario Base</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      Ingrese el salario base en {selectedMoneda?.nombre || watchedValues.monedaSalario}.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Employee Summary */}
              {watchedValues.nombre && watchedValues.salarioBases && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4" />
                      <h3 className="font-medium">Resumen del Empleado</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Empleado:</p>
                        <p className="font-medium">{watchedValues.nombre} {watchedValues.apellido}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cargo:</p>
                        <p className="font-medium">{watchedValues.cargo || "Sin especificar"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Moneda del salario:</p>
                        <p className="font-medium">{selectedMoneda?.nombre || watchedValues.monedaSalario}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Salario base:</p>
                        <Badge variant="default" className="text-sm">
                          {Number(watchedValues.salarioBases).toFixed(2)} {selectedMoneda?.simbolo || watchedValues.monedaSalario}
                        </Badge>
                      </div>
                    </div>
                    {requiresExchangeConfirmation && (
                      <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                        Este salario requiere conversión de moneda. Se solicitará confirmación de la tasa de cambio.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end space-x-4">
                <Button type="button" variant="destructive" onClick={() => router.push("/busy/empleados")}>
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
          monedaOrigen={pendingSubmission.monedaSalario}
          monedaDestino={monedaPrincipal}
          monto={pendingSubmission.salarioBases}
          onConfirm={handleExchangeConfirm}
          titulo="Confirmar Tasa de Cambio para Salario"
          descripcion={`Empleado: ${pendingSubmission.nombre} ${pendingSubmission.apellido} - Salario: ${pendingSubmission.salarioBases.toFixed(2)} ${selectedMoneda?.simbolo || pendingSubmission.monedaSalario}`}
        />
      )}
    </>
  )
}