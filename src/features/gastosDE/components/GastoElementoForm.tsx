"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { MotionConfig, m as motion } from "framer-motion"
import { Layers, ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { sileo } from '@/lib/sileo-shim'
import { createGastoElementoAction, updateGastoElementoAction } from "@/features/gastosDE/actions"

const elementoSchema = z.object({
  nombre: z.string().min(1, 'El campo Nombre no ha sido rellenado'),
  descripcion: z.string().optional(),
})

type ElementoFormValues = z.infer<typeof elementoSchema>

interface GastoElementoFormProps {
  conceptoId: string
  conceptoNombre?: string
  initialData?: { elementoId: string; conceptoId: string; nombre: string; descripcion: string | null; isActive: boolean }
}

export function GastoElementoForm({ conceptoId, conceptoNombre, initialData }: GastoElementoFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ElementoFormValues>({
    resolver: zodResolver(elementoSchema),
    defaultValues: { nombre: initialData?.nombre || "", descripcion: initialData?.descripcion || "" },
  })

  async function onSubmit(data: ElementoFormValues) {
    setIsLoading(true)
    try {
      if (initialData) {
        const result = await updateGastoElementoAction({ elementoId: initialData.elementoId, ...data })
        if (!result.success) { sileo.error({ title: result.error?.message || 'Error al actualizar' }); return }
        sileo.success({ title: 'El elemento ha sido actualizado exitosamente.' })
      } else {
        const result = await createGastoElementoAction({ conceptoId, ...data })
        if (!result.success) { sileo.error({ title: result.error?.message || 'Error al crear' }); return }
        sileo.success({ title: 'El elemento ha sido creado exitosamente.' })
      }
      router.push(`/busy/gastosDE/conceptos/${conceptoId}/elementos`)
      router.refresh()
    } catch (error) {
      console.error("Error al guardar el elemento:", error)
      sileo.error({ title: 'Hubo un error al guardar el elemento.' })
    } finally { setIsLoading(false) }
  }

  return (
    <MotionConfig reducedMotion="user">
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="overflow-hidden border-dashed">
        <CardContent className="pt-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex items-center gap-3 mb-6">
            <motion.div className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg relative" whileHover={{ scale: 1.05, rotate: 5 }} transition={{ duration: 0.2 }}>
              <Layers className="h-5 w-5 text-white" />
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold">{initialData ? "Editar Elemento" : "Nuevo Elemento"}</h2>
              <p className="text-sm text-muted-foreground">{conceptoNombre ? `Bajo el concepto: ${conceptoNombre}` : "Crea un nuevo elemento de gasto"}</p>
            </div>
          </motion.div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completa los campos requeridos antes de continuar.' }) })} className="space-y-6">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <FormField control={form.control} name="nombre" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre <span className="text-xs text-muted-foreground font-normal">(requerido)</span></FormLabel>
                    <FormControl><Input type="text" placeholder="Ej: Local Comercial, Oficina Central, Electricidad..." {...field} disabled={isLoading} className="transition-all duration-200 focus:ring-2 focus:ring-primary/20" /></FormControl>
                    <FormDescription>Nombre del elemento dentro del concepto.</FormDescription><FormMessage />
                  </FormItem>
                )} />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <FormField control={form.control} name="descripcion" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción <span className="text-xs text-muted-foreground font-normal">(opcional)</span></FormLabel>
                    <FormControl><Textarea placeholder="Ej: Gastos de alquiler del local comercial..." {...field} value={field.value || ""} disabled={isLoading} className="transition-all duration-200 focus:ring-2 focus:ring-primary/20" /></FormControl>
                    <FormDescription>Descripción del elemento.</FormDescription><FormMessage />
                  </FormItem>
                )} />
              </motion.div>
              <motion.div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="button" variant="destructive" onClick={() => router.push(`/busy/gastosDE/conceptos/${conceptoId}/elementos`)} disabled={isLoading} className="gap-2"><ArrowLeft className="h-4 w-4" /> Cancelar</Button>
                </motion.div>
                <motion.div whileHover={{ scale: isLoading ? 1 : 1.02 }} whileTap={{ scale: isLoading ? 1 : 0.98 }}>
                  <Button type="submit" disabled={isLoading} className="min-w-35 gap-2 bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90">
                    {isLoading ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 className="h-4 w-4" /></motion.div>{initialData ? "Actualizando..." : "Creando..."}</>) : initialData ? "Actualizar elemento" : "Crear elemento"}
                  </Button>
                </motion.div>
              </motion.div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
    </MotionConfig>
  )
}
