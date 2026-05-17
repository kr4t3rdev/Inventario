"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { LazyMotion, m as motion, AnimatePresence } from "framer-motion"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { sileo } from '@/lib/sileo-shim'
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { getAuthToken } from "@/lib/token"
import { SerieFacturacion } from "@/app/models/model"
import { Pencil, Trash2, Plus, CheckCircle, XCircle, AlertCircle, FileText, Sparkles, Loader2 } from "lucide-react"

const serieSchema = z.object({
  prefijo: z.string().min(1, "Prefijo requerido").max(10, "Máximo 10 caracteres"),
  descripcion: z.string().min(1, "Descripción requerida"),
  activa: z.boolean(),
  esPorDefecto: z.boolean(),
})

type SerieFormValues = z.infer<typeof serieSchema>

/**
 * @description Componente para gestionar series de facturación
 * @returns {JSX.Element} Tabla de series de facturación con formulario
 */
export default function SeriesFacturacionTable() {
  const router = useRouter()
  const [series, setSeries] = useState<SerieFacturacion[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [editingSerie, setEditingSerie] = useState<SerieFacturacion | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<SerieFormValues>({
    resolver: zodResolver(serieSchema),
    defaultValues: {
      prefijo: "",
      descripcion: "",
      activa: true,
      esPorDefecto: false,
    },
  })

  const fetchSeries = async () => {
    try {
      const token = getAuthToken()
      const res = await fetch("/api/series-facturacion", {
        headers: token ? { Authorization: token } : undefined,
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Error al cargar series")
      const data = await res.json()
      setSeries(data)
    } catch (error) {
      console.error("Error fetching series:", error)
      sileo.error({ title: 'No se pudieron cargar las series de facturación' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSeries()
  }, [])

  const onSubmit = async (values: SerieFormValues) => {
    setIsSubmitting(true)
    try {
      const token = getAuthToken()
      const url = editingSerie 
        ? `/api/series-facturacion/${editingSerie.serieId}`
        : "/api/series-facturacion"
      const method = editingSerie ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Error al guardar serie")
      }

      sileo.success({ title: editingSerie ? 'Serie actualizada exitosamente' : 'Serie creada exitosamente' })
      setOpenDialog(false)
      form.reset()
      setEditingSerie(null)
      fetchSeries()
      router.refresh()
    } catch (error) {
      console.error("Error saving series:", error)
      sileo.error({ title: error instanceof Error ? error.message : 'Error al guardar serie' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (serieId: string) => {
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/series-facturacion/${serieId}`, {
        method: "DELETE",
        headers: token ? { Authorization: token } : undefined,
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Error al eliminar serie")
      }

      sileo.success({ title: 'Serie eliminada exitosamente' })
      setDeleteConfirm(null)
      fetchSeries()
      router.refresh()
    } catch (error) {
      console.error("Error deleting series:", error)
      sileo.error({ title: error instanceof Error ? error.message : 'Error al eliminar serie' })
    }
  }

  const handleEdit = (serie: SerieFacturacion) => {
    setEditingSerie(serie)
    form.reset({
      prefijo: serie.prefijo,
      descripcion: serie.descripcion,
      activa: serie.activa,
      esPorDefecto: serie.esPorDefecto,
    })
    setOpenDialog(true)
  }

  const columns: ColumnDef<SerieFacturacion>[] = [
    {
      accessorKey: "prefijo",
      header: "Prefijo",
      cell: ({ row }) => (
        <motion.div 
          className="font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {row.getValue("prefijo")}
        </motion.div>
      ),
    },
    {
      accessorKey: "descripcion",
      header: "Descripción",
      cell: ({ row }) => (
        <div className="max-w-xs truncate">{row.getValue("descripcion")}</div>
      ),
    },
    {
      accessorKey: "consecutivo",
      header: "Consecutivo",
      cell: ({ row }) => (
        <div className="font-mono bg-muted/50 px-2 py-1 rounded inline-block">
          {row.getValue("consecutivo")}
        </div>
      ),
    },
    {
      accessorKey: "activa",
      header: "Estado",
      cell: ({ row }) => {
        const activa = row.getValue("activa") as boolean
        return (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            <Badge 
              variant={activa ? "default" : "secondary"}
              className={activa 
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" 
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }
            >
              {activa ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Activa
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  Inactiva
                </>
              )}
            </Badge>
          </motion.div>
        )
      },
    },
    {
      accessorKey: "esPorDefecto",
      header: "Por Defecto",
      cell: ({ row }) => {
        const esPorDefecto = row.getValue("esPorDefecto") as boolean
        return esPorDefecto ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            <Badge 
              variant="outline" 
              className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-600"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Sí
            </Badge>
          </motion.div>
        ) : (
          <span className="text-muted-foreground">No</span>
        )
      },
    },
    {
      accessorKey: "_count.facturas",
      header: "Facturas",
      cell: ({ row }) => {
        const count = (row.original as any)._count?.facturas || 0
        return (
          <motion.div 
            className="text-center font-medium"
            key={count}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {count}
          </motion.div>
        )
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const serie = row.original
        const hasFacturas = (serie as any)._count?.facturas > 0
        
        return (
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(serie)}
                disabled={hasFacturas && !serie.activa}
                className="transition-all duration-200"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirm(serie.serieId)}
                disabled={hasFacturas || serie.esPorDefecto}
                className="transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
        )
      },
    },
  ]

  if (loading) {
    return (
      <motion.div 
        className="flex flex-col items-center justify-center h-64"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <p className="text-muted-foreground">Cargando series...</p>
      </motion.div>
    )
  }

  return (
    <>
      <motion.div 
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div 
            className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <FileText className="h-5 w-5 text-white" />
          </motion.div>
          <div className="relative">
            <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Series de Facturación
            </h1>
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
        
        <div className="flex items-center gap-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-sm text-muted-foreground">
              {series.length} {series.length === 1 ? "serie" : "series"} de facturación
            </p>
          </motion.div>
          
          <Dialog open={openDialog} onOpenChange={(open) => {
            setOpenDialog(open)
            if (!open) {
              setEditingSerie(null)
              form.reset()
            }
          }}>
            <DialogTrigger asChild>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Serie
                </Button>
              </motion.div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md border-dashed">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <motion.div
                      className="w-8 h-8 bg-linear-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center"
                      whileHover={{ scale: 1.05 }}
                    >
                      <FileText className="h-4 w-4 text-white" />
                    </motion.div>
                    {editingSerie ? "Editar Serie" : "Crear Nueva Serie"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-4 mt-4">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <FormField
                        control={form.control}
                        name="prefijo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prefijo</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Ej: SD, FA, NC" 
                                {...field} 
                                className="transition-all duration-200 focus:scale-[1.01]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <FormField
                        control={form.control}
                        name="descripcion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Ej: Serie para ventas directas, Serie para servicios..." 
                                {...field} 
                                className="transition-all duration-200 focus:scale-[1.01] min-h-[80px]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                    
                    <motion.div 
                      className="grid grid-cols-2 gap-4"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <FormField
                        control={form.control}
                        name="activa"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 dark:border-gray-700">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Activa</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Disponible para facturar
                              </p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="esPorDefecto"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 dark:border-gray-700">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Por Defecto</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Serie predeterminada
                              </p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </motion.div>
                    
                    <motion.div 
                      className="flex justify-end gap-2 pt-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpenDialog(false)}
                        disabled={isSubmitting}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                          </>
                        ) : editingSerie ? (
                          "Actualizar"
                        ) : (
                          "Crear"
                        )}
                      </Button>
                    </motion.div>
                  </form>
                </Form>
              </motion.div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <DataTable
          columns={columns}
          data={series}
          searchColumn="descripcion"
          searchPlaceholder="Buscar series por descripción..."
        />
      </motion.div>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md border-dashed">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                >
                  <AlertCircle className="w-5 h-5 text-destructive" />
                </motion.div>
                Confirmar Eliminación
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p>
                ¿Estás seguro de que deseas eliminar esta serie de facturación?
                Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(deleteConfirm!)}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  )
}
