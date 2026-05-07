"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { sileo } from '@/lib/sileo-shim'
import { Skeleton } from "@/components/ui/skeleton"
import { useAddAlmacenMutation, useGetAlmacenesQuery, useUpdateAlmacenMutation } from "@/features/almacenes/api/almacenesApi"
import { motion } from "framer-motion"
import { Warehouse, Sparkles, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

const almacenSchema = z.object({
  nombre: z.string({
    required_error: 'El campo Nombre no ha sido rellenado',
  }),
})

type AlmacenFormValues = z.infer<typeof almacenSchema>

interface AlmacenFormProps {
  initialData?: {
    almacenId: string
    nombre: string
  }
}

// Loading spinner component
function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <motion.div
      className="border-2 border-primary border-t-transparent rounded-full"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  )
}

// Pulse skeleton
function PulseSkeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={`bg-muted rounded ${className}`}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  )
}

export function AlmacenForm({ initialData }: AlmacenFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const { data: almacen, isLoading: isLoadingAlmacenes } = useGetAlmacenesQuery()
  
  const [ addAlmacen ] = useAddAlmacenMutation()
  const [updateAlmacen] = useUpdateAlmacenMutation()

  const form = useForm<AlmacenFormValues>({
    resolver: zodResolver(almacenSchema),
    defaultValues: {
      nombre: initialData?.nombre || "",
    }
  })

  async function onSubmit(data: AlmacenFormValues) {
    setIsLoading(true)
    try {
      if (initialData) {
        await updateAlmacen({
          almacenId: initialData.almacenId,            
          ...data,
        }).unwrap()
        sileo.success({ title: 'El almacén ha sido actualizado exitosamente.' })
      } else {
        await addAlmacen({
          ...data,
          stockAlmacen: 0
        }).unwrap()
        sileo.success({ title: 'El almacén ha sido registrado exitosamente.' })
      }
      router.push("/busy/almacen")
      router.refresh()
    } catch (error) {
      console.error("Error al guardar el almacén:", error)
      sileo.error({ title: 'Hubo un error al guardar el almacén.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingAlmacenes) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <PulseSkeleton className="h-10 w-10 rounded-xl" />
                <PulseSkeleton className="h-6 w-48" />
              </div>
              <PulseSkeleton className="h-10 w-full" />
              <div className="flex justify-end space-x-4">
                <PulseSkeleton className="h-10 w-24" />
                <PulseSkeleton className="h-10 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden border-dashed">
        <CardContent className="pt-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 mb-6"
          >
            <motion.div 
              className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg relative"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <Warehouse className="h-5 w-5 text-white" />
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="h-4 w-4 text-yellow-400" />
              </motion.div>
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold">
                {initialData ? "Editar Almacén" : "Nuevo Almacén"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {initialData 
                  ? "Modifica los datos del almacén existente" 
                  : "Crea un nuevo almacén para gestionar tu inventario"
                }
              </p>
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
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Nombre
                        <span className="text-xs text-muted-foreground font-normal">(requerido)</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder="Ej: Almacén Principal, Bodega Norte..."
                          {...field} 
                          disabled={isLoading}
                          className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        />
                      </FormControl>
                      <FormDescription>
                        Ingrese el nombre descriptivo del almacén.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
              
              <motion.div 
                className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => router.push("/busy/almacen")}
                    disabled={isLoading}
                    className="gap-2 cursor-pointer transition-colors duration-200"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Cancelar
                  </Button>
                </motion.div>
                
                <motion.div whileHover={{ scale: isLoading ? 1 : 1.02 }} whileTap={{ scale: isLoading ? 1 : 0.98 }}>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="min-w-35 gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 cursor-pointer transition-colors duration-200"
                  >
                    {isLoading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Loader2 className="h-4 w-4" />
                        </motion.div>
                        {initialData ? "Actualizando..." : "Creando..."}
                      </>
                    ) : initialData ? (
                      "Actualizar almacén"
                    ) : (
                      "Crear almacén"
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
