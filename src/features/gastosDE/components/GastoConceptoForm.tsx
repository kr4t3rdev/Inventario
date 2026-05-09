"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { motion } from "framer-motion"
import { FolderOpen, Sparkles, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { sileo } from '@/lib/sileo-shim'
import { createGastoConceptoAction, updateGastoConceptoAction } from "@/features/gastosDE/actions"

const conceptoSchema = z.object({
  nombre: z.string().min(1, 'El campo Nombre no ha sido rellenado'),
  descripcion: z.string().optional(),
})

type ConceptoFormValues = z.infer<typeof conceptoSchema>

interface GastoConceptoFormProps {
  initialData?: { conceptoId: string; nombre: string; descripcion: string | null; isActive: boolean }
}

export function GastoConceptoForm({ initialData }: GastoConceptoFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<ConceptoFormValues>({
    resolver: zodResolver(conceptoSchema),
    defaultValues: { nombre: initialData?.nombre || "", descripcion: initialData?.descripcion || "" },
  })

  async function onSubmit(data: ConceptoFormValues) {
    setIsLoading(true)
    try {
      if (initialData) {
        const result = await updateGastoConceptoAction({ conceptoId: initialData.conceptoId, ...data })
        if (!result.success) { sileo.error({ title: result.error?.message || 'Error al actualizar' }); return }
        sileo.success({ title: 'El concepto ha sido actualizado exitosamente.' })
      } else {
        const result = await createGastoConceptoAction({ ...data, isActive: true } as any)
        if (!result.success) { sileo.error({ title: result.error?.message || 'Error al crear' }); return }
        sileo.success({ title: 'El concepto ha sido creado exitosamente.' })
      }
      router.push("/busy/gastosDE/conceptos")
      router.refresh()
    } catch (error) {
      console.error("Error al guardar el concepto:", error)
      sileo.error({ title: 'Hubo un error al guardar el concepto.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="overflow-hidden border-dashed">
        <CardContent className="pt-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex items-center gap-3 mb-6">
            <motion.div className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg relative" whileHover={{ scale: 1.05, rotate: 5 }} transition={{ duration: 0.2 }}>
              <FolderOpen className="h-5 w-5 text-white" />
              <motion.div animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ rotate: { duration: 20, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity, ease: "easeInOut" } }} className="absolute -top-1 -right-1">
                <Sparkles className="h-4 w-4 text-yellow-400" />
              </motion.div>
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold">{initialData ? "Editar Concepto" : "Nuevo Concepto de Gasto"}</h2>
              <p className="text-sm text-muted-foreground">{initialData ? "Modifica los datos del concepto existente" : "Crea un nuevo concepto para categorizar tus gastos"}</p>
            </div>
          </motion.div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-6">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <FormField control={form.control} name="nombre" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre <span className="text-xs text-muted-foreground font-normal">(requerido)</span></FormLabel>
                    <FormControl><Input type="text" placeholder="Ej: Arrendamiento, Mantenimiento, Telefonía..." {...field} disabled={isLoading} className="transition-all duration-200 focus:ring-2 focus:ring-primary/20" /></FormControl>
                    <FormDescription>Nombre del concepto de gasto.</FormDescription><FormMessage />
                  </FormItem>
                )} />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <FormField control={form.control} name="descripcion" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción <span className="text-xs text-muted-foreground font-normal">(opcional)</span></FormLabel>
                    <FormControl><Textarea placeholder="Ej: Gastos de alquiler de locales y oficinas..." {...field} value={field.value || ""} disabled={isLoading} className="transition-all duration-200 focus:ring-2 focus:ring-primary/20" /></FormControl>
                    <FormDescription>Descripción del concepto.</FormDescription><FormMessage />
                  </FormItem>
                )} />
              </motion.div>
              <motion.div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Button type="button" variant="destructive" onClick={() => startTransition(() => router.push("/busy/gastosDE/conceptos"))} disabled={isLoading || isPending} className="gap-2"><ArrowLeft className="h-4 w-4" /> Cancelar</Button>
                <motion.div whileHover={{ scale: isLoading || isPending ? 1 : 1.02 }}>
                  <Button type="submit" disabled={isLoading || isPending} className="min-w-35 gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                    {isLoading || isPending ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 className="h-4 w-4" /></motion.div>{initialData ? "Actualizando..." : "Creando..."}</>) : initialData ? "Actualizar concepto" : "Crear concepto"}
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
