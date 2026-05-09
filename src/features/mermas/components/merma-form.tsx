"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useDispatch } from "react-redux"
import { motion } from "framer-motion"
import { AlertTriangle, Sparkles, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { sileo } from '@/lib/sileo-shim'
import { Skeleton } from "@/components/ui/skeleton"

import { useGetProductosQuery } from "@/features/productos/api/productosApi"
import { useAddMermaMutation, useUpdateMermaMutation } from "@/features/mermas/api/mermasApi"
import { apiSlice } from "@/lib/redux/services/apiSlice"

const mermaSchema = z.object({
  productoId: z.string({
    required_error: 'El campo Producto no ha sido seleccionado',
  }),
  cantidad: z.coerce.number().positive({
    message: "La cantidad debe ser mayor a 0",
  }),
  motivo: z.string().min(3, {
    message: "El motivo debe tener al menos 3 caracteres",
  })  
})

type MermaFormValues = z.infer<typeof mermaSchema>

interface MermaFormProps {
  initialData?: {
    mermaId: string
    productoId: string
    cantidad: number
    motivo: string
  }
}

export function MermaForm({ initialData }: MermaFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const dispatch = useDispatch()
  const { data: productos, isLoading: isLoadingProductos } = useGetProductosQuery()

  const [addMerma] = useAddMermaMutation()
  const [updateMerma] = useUpdateMermaMutation()

  const form = useForm<MermaFormValues>({
    resolver: zodResolver(mermaSchema),
    defaultValues: {
      productoId: initialData?.productoId || "",
      cantidad: initialData?.cantidad || 1,
      motivo: initialData?.motivo || "",
    },
  })

  async function onSubmit(data: MermaFormValues) {
    setIsLoading(true)
    try {
      if (initialData) {
        await updateMerma({
          mermaId: initialData.mermaId,
          ...data,
        }).unwrap()
        sileo.success({ title: 'La merma ha sido actualizada exitosamente.' })
      } else {
        await addMerma(data).unwrap()
        sileo.success({ title: 'La merma ha sido registrada exitosamente.' })
      }

      dispatch(apiSlice.util.invalidateTags(['Notificaciones'])) 

      router.push("/busy/mermas")
      router.refresh()
    } catch (error) {
      console.error("Error al guardar la merma:", error)
      sileo.error({ title: 'Hubo un error al guardar la merma.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingProductos) {
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
                className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
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
        <div className="h-1 bg-linear-to-r from-orange-500 via-red-500 to-orange-500" />
        <CardContent className="pt-6">
          <motion.div 
            className="flex items-center gap-3 mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <motion.div 
              className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <AlertTriangle className="h-5 w-5 text-white" />
            </motion.div>
            <div className="relative">
              <h2 className="text-lg font-semibold">
                {initialData ? "Editar Merma" : "Nueva Merma"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {initialData ? "Modifique los datos de la merma" : "Ingrese los datos de la merma"}
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
                  name="productoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Producto</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
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
                      <FormDescription>Seleccione el producto que se perdió o dañó.</FormDescription>
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
                  name="cantidad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          {...field} 
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </FormControl>
                      <FormDescription>Ingrese la cantidad perdida o dañada.</FormDescription>
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
                  name="motivo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describa el motivo de la merma" 
                          className="resize-none transition-all duration-200 focus:scale-[1.01] min-h-25" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>Describa el motivo de la pérdida o daño.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div 
                className="flex justify-end space-x-4 pt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="button" variant="outline" onClick={() => router.push("/busy/mermas")}>
                    Cancelar
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : initialData ? (
                      "Actualizar Merma"
                    ) : (
                      "Registrar Merma"
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
