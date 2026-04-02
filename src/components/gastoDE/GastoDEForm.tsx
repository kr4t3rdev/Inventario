"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { motion } from "framer-motion"
import { Receipt, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { sileo } from 'sileo'
import { Skeleton } from "@/components/ui/skeleton"
import { v4 } from "uuid"
import { useAddGastosDEMutation, useGetGastosDEQuery, useUpdateGastosDEMutation } from "@/lib/redux/services/gastosDEApi"
import { useGetVendorsQuery } from "@/lib/redux/services/vendorsApi"

const gastosDESchema = z.object({
  tipo: z.string({
    required_error: 'El campo Tipo de gasto no ha sido rellenado',
  }),
  numeroFactura: z.string().optional(),
  proveedor: z.string({
    required_error: 'El campo Proveedor no ha sido rellenado',
  }),
  monto: z.coerce.number().positive({
    message: "El monto debe ser mayor a 0",
  }),
  descripcion: z.string({
    message: "Escriba una descripción"
  }),
})

type GastosDEFormValues = z.infer<typeof gastosDESchema>

interface GastosDEFormProps {
  initialData?: {
    gastosDEId: string
    tipo: string
    numeroFactura?: string | null
    proveedor: string | null
    monto: number
    descripcion: string
  }
}

export function GastoDEForm({ initialData }: GastosDEFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const { data: gastosDE, isLoading: isLoadingGastosDE } = useGetGastosDEQuery()
  const { data: vendors, isLoading: isLoadingVendors } = useGetVendorsQuery()

  const [addGastoGastosDE] = useAddGastosDEMutation()
  const [updateGastosDE] = useUpdateGastosDEMutation()

  const form = useForm<GastosDEFormValues>({
    resolver: zodResolver(gastosDESchema),
    defaultValues: {
      tipo: initialData?.tipo || '',
      numeroFactura: initialData?.numeroFactura || '',
      proveedor: initialData?.proveedor || '',
      descripcion: initialData?.descripcion || '',
      monto: initialData?.monto ?? undefined,
    },
  })

  const watchedValues = form.watch()

  async function onSubmit(data: GastosDEFormValues) {
    await submitGasto(data)
  }

  async function submitGasto(data: GastosDEFormValues) {
    setIsLoading(true)
    try {
      if (initialData) {
        await updateGastosDE({
          gastosDEId: initialData.gastosDEId,
          ...data,
        }).unwrap()
        sileo.success({ title: 'El gasto de explotación han sido actualizados exitosamente.' })
        
      } else {
        await addGastoGastosDE({
          gastosDEId: v4(),
          ...data
        }).unwrap()
        sileo.success({ title: 'El gasto de explotación ha sido registrado exitosamente.' })
      }
      router.back()
    } catch (error) {
      console.error("Error al guardar el gasto de explotación:", error)
      sileo.error({ title: 'Hubo un error al guardar el gasto de explotación.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingGastosDE) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8 mb-6">
              <motion.div
                className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                <Skeleton className="h-10 w-full" />
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <Skeleton className="h-10 w-full" />
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <Skeleton className="h-20 w-full" />
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <Skeleton className="h-10 w-full" />
              </motion.div>
              <div className="flex justify-end space-x-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-dashed overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
        <CardContent className="pt-6">
          <motion.div 
            className="flex items-center gap-3 mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <motion.div 
              className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Receipt className="h-5 w-5 text-white" />
            </motion.div>
            <div className="relative">
              <h2 className="text-lg font-semibold">
                {initialData ? "Editar Gasto" : "Nuevo Gasto de Explotación"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {initialData ? "Modifique los datos del gasto" : "Ingrese los datos del gasto"}
              </p>
              <motion.div
                className="absolute -right-4 -top-1"
                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                transition={{ 
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
              >
                <Sparkles className="h-4 w-4 text-yellow-500" />
              </motion.div>
            </div>
          </motion.div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          {...field} 
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </FormControl>
                      <FormDescription>Ingrese el tipo de gasto.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
              >
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
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </FormControl>
                      <FormDescription>Factura entrante del proveedor (opcional).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <FormField
                  control={form.control}
                  name="proveedor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="h-12 w-full rounded-md border border-slate-200 dark:border-orange-900/20 bg-slate-50 dark:bg-slate-900/10 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                        >
                          <option value="">Seleccionar proveedor</option>
                          {vendors?.map((vendor: any) => (
                            vendor.vendorId ? (
                              <option key={vendor.vendorId} value={vendor.nombre}>
                                {vendor.nombre}
                              </option>
                            ) : null
                          ))}
                        </select>
                      </FormControl>
                      <FormDescription>Seleccione el proveedor del gasto.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
              >
                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          {...field} 
                          onChange={(e) => {
                            field.onChange(e.target.value.toUpperCase())
                          }}
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </FormControl>
                      <FormDescription>Ingrese la descripción para el gasto.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <FormField
                  control={form.control}
                  name="monto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          {...field} 
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </FormControl>
                      <FormDescription>
                        Ingrese el monto del gasto.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              {/* Expense Summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
              >
                {watchedValues.tipo && watchedValues.monto && (
                  <Card className="bg-muted/50 border-dashed">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Receipt className="h-4 w-4" />
                        <h3 className="font-medium">Resumen del Gasto</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Tipo de gasto:</p>
                          <p className="font-medium">{watchedValues.tipo}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Proveedor:</p>
                          <p className="font-medium">{watchedValues.proveedor || "Sin especificar"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Monto:</p>
                          <motion.div
                            key={watchedValues.monto}
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          >
                            <Badge variant="default" className="text-sm">
                              ${Number(watchedValues.monto).toFixed(2)}
                            </Badge>
                          </motion.div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>

              <motion.div 
                className="flex justify-end space-x-4 pt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="button" variant="outline" onClick={() => router.push("/busy/gastosDE")}>
                    Cancelar
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : initialData ? (
                      "Actualizar Gasto"
                    ) : (
                      "Registrar Gasto"
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
