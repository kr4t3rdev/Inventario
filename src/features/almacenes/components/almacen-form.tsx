"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { sileo } from '@/lib/sileo-shim'
import { createAlmacenAction, updateAlmacenAction } from "@/features/almacenes/actions"
import { almacenSchema } from "@/features/almacenes/schemas"
import type { AlmacenInput } from "@/features/almacenes/schemas"
import { LazyMotion, m as motion } from "framer-motion"
import { Warehouse, ArrowLeft, Loader2 } from "lucide-react"



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

/**
 * @description Formulario para crear o editar un almacén.
 * Usa Server Actions (createAlmacenAction / updateAlmacenAction)
 * en lugar de RTK Query para las operaciones de datos.
 *
 * @param {AlmacenFormProps} props - Datos iniciales del almacén (opcional).
 * @returns {JSX.Element} Formulario de almacén.
 */
export function AlmacenForm({ initialData }: AlmacenFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<AlmacenInput>({
    resolver: zodResolver(almacenSchema),
    defaultValues: {
      nombre: initialData?.nombre || "",
    }
  })

  async function onSubmit(data: AlmacenInput) {
    setIsLoading(true)
    try {
      if (initialData) {
        const result = await updateAlmacenAction({
          almacenId: initialData.almacenId,
          nombre: data.nombre,
        })
        if (!result.success) {
          throw new Error(result.error?.message || 'Error al actualizar el almacén')
        }
        sileo.success({ title: 'El almacén ha sido actualizado exitosamente.' })
      } else {
        const result = await createAlmacenAction({
          nombre: data.nombre,
        })
        if (!result.success) {
          throw new Error(result.error?.message || 'Error al crear el almacén')
        }
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
              className="w-10 h-10 bg-linear-to-br from-primary to-purple rounded-xl flex items-center justify-center shadow-lg relative"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <Warehouse className="h-5 w-5 text-white" />

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
                    className="min-w-35 gap-2 bg-linear-to-r from-primary to-purple hover:from-primary/90 hover:to-purple/90 cursor-pointer transition-colors duration-200"
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
