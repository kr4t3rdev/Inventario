"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertTriangle, CheckCircle, Save, X, CreditCard, AlignLeft, Power, Building2 } from "lucide-react"
import { sileo } from '@/lib/sileo-shim'
import { getCuentasBancariasAction } from "@/features/contabilidad/actions-cuentas-bancarias"
import { CreateTipoPagoRequest, UpdateTipoPagoRequest, TipoPagoWithDetails, CuentaBancaria } from "@/app/models/model"
import { LazyMotion, m as motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const tipoPagoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional(),
  requiereCuenta: z.boolean(),
  cuentaDefecto: z.string().optional(),
  isActive: z.boolean()
}).refine((data) => {
  // Si requiere cuenta, debe tener una cuenta por defecto
  if (data.requiereCuenta && !data.cuentaDefecto) {
    return false
  }
  return true
}, {
  message: "Si el tipo de pago requiere cuenta, debe especificar una cuenta por defecto",
  path: ["cuentaDefecto"]
})

type TipoPagoFormData = z.infer<typeof tipoPagoSchema>

interface TipoPagoFormProps {
  tipoPago?: TipoPagoWithDetails
  onSubmit: (data: CreateTipoPagoRequest | UpdateTipoPagoRequest) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  mode: "create" | "edit"
}

export function TipoPagoForm({ tipoPago, onSubmit, onCancel, isLoading = false, mode}: TipoPagoFormProps) {
  const [showAccountWarning, setShowAccountWarning] = useState(false)
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(true);

  useEffect(() => {
    getCuentasBancariasAction().then(r => {
      if (r.success) setCuentasBancarias(r.data?.cuentas ?? []);
      setLoadingCuentas(false);
    })
  }, [])


  const form = useForm<TipoPagoFormData>({
    resolver: zodResolver(tipoPagoSchema),
    defaultValues: {
      nombre: tipoPago?.nombre || "",
      descripcion: tipoPago?.descripcion || "",
      requiereCuenta: tipoPago?.requiereCuenta ?? true,
      cuentaDefecto: tipoPago?.cuentaDefecto || "",
      isActive: tipoPago?.isActive ?? true
    }
  })

  const requiereCuenta = form.watch("requiereCuenta")
  const cuentaDefecto = form.watch("cuentaDefecto")

  // Limpiar cuenta por defecto si no requiere cuenta
  useEffect(() => {
    if (!requiereCuenta) {
      form.setValue("cuentaDefecto", "")
      setShowAccountWarning(false)
    }
  }, [requiereCuenta, form])

  // Resetear el formulario cuando cambie el tipoPago
  useEffect(() => {
    if (tipoPago) {
      form.reset({
        nombre: tipoPago.nombre || "",
        descripcion: tipoPago.descripcion || "",
        requiereCuenta: tipoPago.requiereCuenta ?? true,
        cuentaDefecto: tipoPago.cuentaDefecto || "",
        isActive: tipoPago.isActive ?? true
      })
    } else {
      form.reset({
        nombre: "",
        descripcion: "",
        requiereCuenta: true,
        cuentaDefecto: "",
        isActive: true
      })
    }
  }, [tipoPago, form])

  // Mostrar advertencia si requiere cuenta pero no tiene cuenta por defecto
  useEffect(() => {
    setShowAccountWarning(requiereCuenta && !cuentaDefecto)
  }, [requiereCuenta, cuentaDefecto])

  const handleSubmit = async (data: TipoPagoFormData) => {
    try {
      await onSubmit(data)
      // El toast de éxito se maneja en el componente padre
    } catch (error) {
      // El toast de error se maneja aquí para mostrar el error específico
      console.error("Error en el formulario:", error)
      sileo.error({ title: mode === 'create' 
          ? 'Error al crear el tipo de pago' 
          : 'Error al actualizar el tipo de pago' })
      // No re-lanzamos el error para evitar que se cierre el diálogo
    }
  }

  const cuentasActivas = cuentasBancarias?.filter((cuenta: CuentaBancaria) => cuenta.isActive)

  return (
    <Card className="w-full border-0 bg-transparent shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardDescription>
          {mode === "create" 
            ? "Configure un nuevo tipo de pago para las reconciliaciones. Los campos marcados con * son obligatorios."
            : "Modifique la configuración del tipo de pago existente."
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent className="px-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-6">
            {/* Nombre */}
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                    Nombre *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Efectivo, Transferencia Bancaria, Tarjeta de Crédito"
                      className="bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-blue-500 transition-all"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Nombre descriptivo del tipo de pago
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descripción */}
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <AlignLeft className="h-4 w-4 text-slate-500" />
                    Descripción
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descripción opcional del tipo de pago"
                      rows={3}
                      className="resize-none bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-blue-500 transition-all"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Información adicional sobre este tipo de pago
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Estado Activo */}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-2 text-base">
                        <Power className={cn("h-4 w-4", field.value ? "text-emerald-500" : "text-slate-400")} />
                        Estado Activo
                      </FormLabel>
                      <FormDescription className="text-xs">
                        Disponible para reconciliaciones
                      </FormDescription>
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

              {/* Requiere Cuenta Bancaria */}
              <FormField
                control={form.control}
                name="requiereCuenta"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-2 text-base">
                        <Building2 className={cn("h-4 w-4", field.value ? "text-blue-500" : "text-slate-400")} />
                        Requiere Cuenta
                      </FormLabel>
                      <FormDescription className="text-xs">
                        Asociar a cuenta bancaria
                      </FormDescription>
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
            </div>

            {/* Cuenta por Defecto - Animated */}
            <AnimatePresence>
              {requiereCuenta && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <FormField
                    control={form.control}
                    name="cuentaDefecto"
                    render={({ field }) => (
                      <FormItem className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/20 dark:bg-blue-900/10">
                        <FormLabel className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                          <Building2 className="h-4 w-4" />
                          Cuenta por Defecto
                        </FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={loadingCuentas}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-white dark:bg-slate-950 border-blue-200 dark:border-blue-800 focus:ring-blue-500">
                              <SelectValue placeholder="Seleccionar cuenta por defecto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Sin cuenta por defecto</SelectItem>
                            {cuentasActivas?.map((cuenta: any) => (
                              <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                                {cuenta.nombreBanco} - {cuenta.numeroCuenta} ({cuenta.moneda})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-blue-600/80 dark:text-blue-400/80">
                          Cuenta bancaria que se seleccionará automáticamente para este tipo de pago
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Advertencia si requiere cuenta pero no tiene cuenta por defecto */}
            <AnimatePresence>
              {showAccountWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Configuración Incompleta</AlertTitle>
                    <AlertDescription>
                      Este tipo de pago requiere cuenta bancaria pero no tiene una cuenta por defecto configurada. 
                      Los usuarios deberán seleccionar manualmente la cuenta durante la reconciliación.
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Información de uso (solo en modo edición) */}
            {mode === "edit" && tipoPago?._count && (
              <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Estado de Uso</AlertTitle>
                <AlertDescription>
                  Este tipo de pago tiene {" "}
                  <span className="font-bold">
                    {(tipoPago._count.reconciliacionesVenta + 
                      tipoPago._count.reconciliacionesServicio + 
                      tipoPago._count.reconciliacionesGasto)}
                  </span> {" "}
                  reconciliaciones asociadas.
                  {tipoPago._count.reconciliacionesVenta + 
                   tipoPago._count.reconciliacionesServicio + 
                   tipoPago._count.reconciliacionesGasto > 0 && 
                   " No se puede desactivar mientras tenga reconciliaciones."}
                </AlertDescription>
              </Alert>
            )}

            {/* Botones */}
            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-all shadow-md hover:shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {mode === "create" ? "Crear Tipo de Pago" : "Actualizar"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}