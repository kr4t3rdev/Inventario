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
import { createUnidadAction, updateUnidadAction } from "@/features/unidades/actions"
import { unidadSchema } from "@/features/unidades/schemas"
import type { UnidadInput } from "@/features/unidades/schemas"
import { LazyMotion, m as motion } from "framer-motion"
import { Scale, Sparkles, ArrowLeft, Loader2 } from "lucide-react"



interface UnidadFormProps {
  initialData?: {
    unidadId: string
    nombre: string
    simbolo: string
  }
}

/**
 * @description Formulario para crear o editar una unidad de medida.
 * Usa Server Actions (createUnidadAction / updateUnidadAction)
 * en lugar de RTK Query.
 *
 * @param {UnidadFormProps} props - Datos iniciales de la unidad (opcional).
 * @returns {JSX.Element} Formulario de unidad.
 */
export function UnidadForm({ initialData }: UnidadFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<UnidadInput>({
    resolver: zodResolver(unidadSchema),
    defaultValues: {
      nombre: initialData?.nombre || "",
      simbolo: initialData?.simbolo || ""
    },
  })

  async function onSubmit(data: UnidadInput) {
    setIsLoading(true)
    try {
      if (initialData) {
        const result = await updateUnidadAction({
          unidadId: initialData.unidadId,
          nombre: data.nombre,
          simbolo: data.simbolo,
        })
        if (!result.success) {
          throw new Error(result.error?.message || 'Error al actualizar la unidad')
        }
        sileo.success({ title: 'La unidad ha sido actualizada exitosamente.' })
      } else {
        const result = await createUnidadAction({
          nombre: data.nombre,
          simbolo: data.simbolo,
        })
        if (!result.success) {
          throw new Error(result.error?.message || 'Error al crear la unidad')
        }
        sileo.success({ title: 'La unidad ha sido registrada exitosamente.' })
      }
      router.push("/busy/unidad")
      router.refresh()
    } catch (error) {
      console.error("Error al guardar la unidad:", error)
      sileo.error({ title: 'Hubo un error al guardar la unidad.' })
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
              className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg relative"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <Scale className="h-5 w-5 text-white" />
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
                {initialData ? "Editar Unidad" : "Nueva Unidad"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {initialData 
                  ? "Modifica los datos de la unidad existente" 
                  : "Crea una nueva unidad de medida para tus productos"
                }
              </p>
            </div>
          </motion.div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-6">
              {/* Nombre Field */}
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
                          placeholder="Ej: Kilogramo, Litro, Metro..."
                          {...field} 
                          disabled={isLoading}
                          className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        />
                      </FormControl>
                      <FormDescription>
                        Ingrese el nombre completo de la unidad de medida.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              {/* Simbolo Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <FormField
                  control={form.control}
                  name="simbolo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Símbolo
                        <span className="text-xs text-muted-foreground font-normal">(requerido)</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder="Ej: kg, L, m..."
                          {...field} 
                          disabled={isLoading}
                          className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 font-bold text-lg tracking-wider"
                        />
                      </FormControl>
                      <FormDescription>
                        Ingrese el símbolo o abreviatura de la unidad.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              {/* Actions */}
              <motion.div 
                className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => router.push("/busy/unidad")}
                    disabled={isLoading}
                    className="gap-2 cursor-pointer"
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
                      "Actualizar unidad"
                    ) : (
                      "Crear unidad"
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
