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
import { sileo } from '@/lib/sileo-shim'
import { Skeleton } from "@/components/ui/skeleton"
import { v4 } from "uuid"
import { useAddGastosDEMutation, useGetGastosDEQuery, useUpdateGastosDEMutation } from "@/lib/redux/services/gastosDEApi"
import { useGetVendorsQuery } from "@/lib/redux/services/vendorsApi"
import { useGetGastoConceptosQuery, useGetGastoElementosQuery } from "@/lib/redux/services/gastosConceptosApi"
import { VendorCombobox } from "./VendorCombobox"

const gastosDESchema = z.object({
  tipo: z.string().max(100, 'Máximo 100 caracteres').optional(),
  conceptoId: z.string().optional(),
  elementoId: z.string().optional(),
  numeroFactura: z.string().max(50, 'Máximo 50 caracteres').optional(),
  proveedor: z.string().max(200, 'Máximo 200 caracteres').optional(),
  monto: z.coerce.number({ invalid_type_error: 'Ingrese un monto válido' }).positive({ message: "El monto debe ser mayor a 0" }),
  descripcion: z.string().min(1, 'La descripción es obligatoria').max(500, 'Máximo 500 caracteres'),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "El período debe tener formato YYYY-MM"),
})

type GastosDEFormValues = z.infer<typeof gastosDESchema>

interface GastosDEFormProps {
  initialData?: { gastosDEId: string; tipo: string | null; conceptoId: string | null; elementoId: string | null; numeroFactura?: string | null; proveedor: string | null; monto: number; descripcion: string | null; periodo?: string }
}

export function GastoDEForm({ initialData }: GastosDEFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedConceptoId, setSelectedConceptoId] = useState<string>(initialData?.conceptoId || '')
  const { data: gastosDE, isLoading: isLoadingGastosDE } = useGetGastosDEQuery()
  const { data: vendors, isLoading: isLoadingVendors } = useGetVendorsQuery()
  const { data: conceptos } = useGetGastoConceptosQuery({ onlyActive: true })
  const { data: elementos } = useGetGastoElementosQuery(selectedConceptoId, { skip: !selectedConceptoId })
  const [addGastoGastosDE] = useAddGastosDEMutation()
  const [updateGastosDE] = useUpdateGastosDEMutation()

  const form = useForm<GastosDEFormValues>({
    resolver: zodResolver(gastosDESchema),
    defaultValues: {
      tipo: initialData?.tipo || '', conceptoId: initialData?.conceptoId || '', elementoId: initialData?.elementoId || '',
      numeroFactura: initialData?.numeroFactura || '', proveedor: initialData?.proveedor || '',
      descripcion: initialData?.descripcion || '', monto: initialData?.monto ?? undefined,
      periodo: initialData?.periodo || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    },
  })

  const watchedValues = form.watch()

  async function onSubmit(data: GastosDEFormValues) {
    setIsLoading(true)
    try {
      if (initialData) {
        await updateGastosDE({ gastosDEId: initialData.gastosDEId, ...data }).unwrap()
        sileo.success({ title: 'El gasto de explotación ha sido actualizado exitosamente.' })
      } else {
        await addGastoGastosDE({ gastosDEId: v4(), ...data } as any).unwrap()
        sileo.success({ title: 'El gasto de explotación ha sido registrado exitosamente.' })
      }
      router.back()
    } catch (error) {
      console.error("Error al guardar el gasto de explotación:", error)
      sileo.error({ title: 'Hubo un error al guardar el gasto de explotación.' })
    } finally { setIsLoading(false) }
  }

  if (isLoadingGastosDE) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="border-dashed"><CardContent className="pt-6">
          <div className="flex items-center justify-center py-8 mb-6"><motion.div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} /></div>
          <div className="space-y-6">
            {[0.1, 0.2, 0.3, 0.4].map((d, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d }}><Skeleton className="h-10 w-full" /></motion.div>
            ))}
            <div className="flex justify-end space-x-4"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></div>
          </div>
        </CardContent></Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-dashed overflow-hidden">
        <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
        <CardContent className="pt-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="flex items-center gap-3 mb-6">
            <motion.div className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg" whileHover={{ scale: 1.05, rotate: 5 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
              <Receipt className="h-5 w-5 text-white" />
            </motion.div>
            <div className="relative">
              <h2 className="text-lg font-semibold">{initialData ? "Editar Gasto" : "Nuevo Gasto de Explotación"}</h2>
              <p className="text-sm text-muted-foreground">{initialData ? "Modifique los datos del gasto" : "Ingrese los datos del gasto"}</p>
              <motion.div className="absolute -right-4 -top-1" animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ rotate: { duration: 20, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}>
                <Sparkles className="h-4 w-4 text-yellow-500" />
              </motion.div>
            </div>
          </motion.div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-6">
              {[
                { name: "conceptoId" as const, label: "Concepto de Gasto", desc: "Categoría principal del gasto.", delay: 0.2, render: (field: any) => (
                  <select value={field.value} onChange={(e) => { field.onChange(e.target.value); setSelectedConceptoId(e.target.value); form.setValue('elementoId', '') }} className="h-12 w-full rounded-md border border-slate-200 dark:border-orange-900/20 bg-slate-50 dark:bg-slate-900/10 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200">
                    <option value="">Seleccionar concepto</option>
                    {conceptos?.map((c: any) => <option key={c.conceptoId} value={c.conceptoId}>{c.nombre}</option>)}
                  </select>
                )},
                { name: "elementoId" as const, label: "Elemento", desc: "Subcategoría del gasto seleccionado.", delay: 0.22, render: (field: any) => (
                  <select value={field.value} onChange={field.onChange} disabled={!selectedConceptoId} className="h-12 w-full rounded-md border border-slate-200 dark:border-orange-900/20 bg-slate-50 dark:bg-slate-900/10 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    <option value="">Seleccionar elemento</option>
                    {elementos?.map((e: any) => <option key={e.elementoId} value={e.elementoId}>{e.nombre}</option>)}
                  </select>
                )},
                { name: "tipo" as const, label: "Tipo (texto libre, opcional)", desc: "Texto libre alternativo al concepto/elemento.", delay: 0.24, render: (field: any) => <Input type="text" {...field} placeholder="Solo si no usa concepto/elemento" className="transition-all duration-200 focus:scale-[1.01]" /> },
                { name: "periodo" as const, label: "Período", desc: "Período del gasto (formato YYYY-MM).", delay: 0.22, render: (field: any) => <Input type="text" placeholder="YYYY-MM" {...field} className="transition-all duration-200 focus:scale-[1.01]" /> },
                { name: "numeroFactura" as const, label: "Nro. Factura", desc: "Factura entrante del proveedor (opcional).", delay: 0.25, render: (field: any) => <Input type="text" placeholder="Ej: F-2024-0012" {...field} className="transition-all duration-200 focus:scale-[1.01]" /> },
                { name: "proveedor" as const, label: "Proveedor", desc: "Seleccione el proveedor del gasto.", delay: 0.3, render: (field: any) => <VendorCombobox value={field.value ?? ''} onChange={field.onChange} vendors={vendors?.filter((v: any) => v.vendorId) || []} placeholder="Seleccionar proveedor" error={!!form.formState.errors.proveedor} /> },
                { name: "descripcion" as const, label: "Descripción", desc: "Ingrese la descripción para el gasto.", delay: 0.35, render: (field: any) => <Input type="text" {...field} onChange={(e) => { field.onChange(e.target.value.toUpperCase()) }} className="transition-all duration-200 focus:scale-[1.01]" /> },
                { name: "monto" as const, label: "Monto", desc: "Ingrese el monto del gasto.", delay: 0.4, render: (field: any) => <Input type="number" step="0.01" min="0.01" {...field} className="transition-all duration-200 focus:scale-[1.01]" /> },
              ].map(({ name, label, desc, delay, render }) => (
                <motion.div key={name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}>
                  <FormField control={form.control} name={name} render={({ field }) => (
                    <FormItem><FormLabel>{label}</FormLabel><FormControl>{render(field)}</FormControl><FormDescription>{desc}</FormDescription><FormMessage /></FormItem>
                  )} />
                </motion.div>
              ))}
              {watchedValues.tipo && watchedValues.monto && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                  <Card className="bg-muted/50 border-dashed"><CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3"><Receipt className="h-4 w-4" /><h3 className="font-medium">Resumen del Gasto</h3></div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-muted-foreground">Tipo:</p><p className="font-medium">{watchedValues.tipo || "(texto libre)"}</p></div>
                      <div><p className="text-muted-foreground">Proveedor:</p><p className="font-medium">{watchedValues.proveedor || "Sin especificar"}</p></div>
                      <div><p className="text-muted-foreground">Monto:</p><Badge variant="default" className="text-sm">${Number(watchedValues.monto).toFixed(2)}</Badge></div>
                    </div>
                  </CardContent></Card>
                </motion.div>
              )}
              <motion.div className="flex justify-end space-x-4 pt-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="button" variant="outline" onClick={() => router.push("/busy/gastosDE")}>Cancelar</Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="submit" disabled={isLoading} className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                    {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>) : initialData ? "Actualizar Gasto" : "Registrar Gasto"}
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
