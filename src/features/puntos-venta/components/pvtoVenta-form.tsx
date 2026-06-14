"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { sileo } from '@/lib/sileo-shim'
import { createPuntoDeVentaAction, updatePuntoDeVentaAction } from "@/features/puntos-venta/actions"
import { getListasPreciosAction } from "@/features/listas-precios"
import { LazyMotion, m as motion } from "framer-motion"
import { Store, MapPin, ArrowLeft, Loader2 } from "lucide-react"
import {
  parsePvFormValues,
  ptoVentaFormValuesSchema,
  type PtoVentaFormValues,
} from "@/features/puntos-venta/form-values"



interface PtoVentaFormProps {
  initialData?: {
    pvId: string
    nombre: string
    ubicacion: string | null
    stockPuntoVenta?: number
    listaPrecioId?: string | null
  }
}

interface ListaPrecioOption {
  id: string
  nombre: string
}

/**
 * @description Formulario para crear o editar un punto de venta.
 * Usa Server Actions (createPuntoDeVentaAction / updatePuntoDeVentaAction)
 * en lugar de RTK Query.
 *
 * @param {PtoVentaFormProps} props - Datos iniciales del punto de venta (opcional).
 * @returns {JSX.Element} Formulario de punto de venta.
 */
export function PtoVentaForm({ initialData }: PtoVentaFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [listasPrecios, setListasPrecios] = useState<ListaPrecioOption[]>([])
  const [hasListaPreciosFeature, setHasListaPreciosFeature] = useState<boolean | null>(null)

  useEffect(() => {
    getListasPreciosAction().then(result => {
      if (result.success) {
        setHasListaPreciosFeature(true)
        setListasPrecios(result.data ?? [])
      } else if (result.error?.code === 'FEATURE_NOT_AVAILABLE') {
        setHasListaPreciosFeature(false)
        form.setValue('listaPrecioId', 'default')
      }
    })
  }, [])

  const form = useForm<PtoVentaFormValues>({
    resolver: zodResolver(ptoVentaFormValuesSchema),
    defaultValues: {
      nombre: initialData?.nombre || "",
      ubicacion: initialData?.ubicacion ?? "",
      listaPrecioId: initialData?.listaPrecioId ?? "default",
    },
  })

  async function onSubmit(values: PtoVentaFormValues) {
    setIsLoading(true)
    try {
      const data = parsePvFormValues(values)

      if (initialData) {
        const result = await updatePuntoDeVentaAction({
          pvId: initialData.pvId,
          nombre: data.nombre,
          ubicacion: data.ubicacion,
          listaPrecioId: data.listaPrecioId,
        })

        if (!result.success) {
          throw new Error(result.error?.message || 'Error al actualizar el punto de venta')
        }
        sileo.success({ title: 'El punto de venta ha sido actualizado exitosamente.' })
      } else {
        const result = await createPuntoDeVentaAction({
          nombre: data.nombre,
          ubicacion: data.ubicacion,
          listaPrecioId: data.listaPrecioId,
        })

        if (!result.success) {
          throw new Error(result.error?.message || 'Error al crear el punto de venta')
        }
        sileo.success({ title: 'El punto de venta ha sido registrado exitosamente.' })
      }
      router.push("/busy/puntosDeVenta")
      router.refresh()
    } catch (error) {
      console.error("Error al guardar el punto de venta:", error)
      sileo.error({ title: 'Hubo un error al guardar el punto de venta.' })
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
              <Store className="h-5 w-5 text-white" />

            </motion.div>
            <div>
              <h2 className="text-xl font-semibold">
                {initialData ? "Editar Punto de Venta" : "Nuevo Punto de Venta"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {initialData 
                  ? "Modifica los datos del punto de venta existente" 
                  : "Crea un nuevo punto de venta para tu negocio"
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
                        <Store className="h-4 w-4 text-muted-foreground" />
                        Nombre
                        <span className="text-xs text-muted-foreground font-normal">(requerido)</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder="Ej: Tienda Principal, Sucursal Norte..."
                          {...field}
                          disabled={isLoading}
                          className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        />
                      </FormControl>
                      <FormDescription>
                        Ingrese el nombre descriptivo del punto de venta.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              {/* Ubicacion Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <FormField
                  control={form.control}
                  name="ubicacion"
                  render={({ field: { value, ...field } }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Ubicación
                        <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder="Ej: Calle Principal #123, Centro Comercial..."
                          {...field}
                          value={value ?? ""}
                          disabled={isLoading}
                          className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        />
                      </FormControl>
                      <FormDescription>
                        Ingrese la dirección o ubicación del punto de venta.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              {/* Lista de Precios Field — solo visible si el plan incluye el feature */}
              {hasListaPreciosFeature && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <FormField
                    control={form.control}
                    name="listaPrecioId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lista de precios</FormLabel>
                        <Select value={field.value || "default"} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Usar precio base" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="default">Usar precio base</SelectItem>
                            {listasPrecios?.map((lista) => (
                              <SelectItem key={lista.id} value={lista.id}>
                                {lista.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Si no se selecciona, el punto de venta usará precio base del producto.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>
              )}
              
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
                    onClick={() => router.push("/busy/puntosDeVenta")}
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
                    className="min-w-45 gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 cursor-pointer transition-colors duration-200"
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
                      "Actualizar punto de venta"
                    ) : (
                      "Crear punto de venta"
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
