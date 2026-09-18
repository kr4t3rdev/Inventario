"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { LazyMotion, m as motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { ArrowRightLeft, Loader2, Info } from "lucide-react"
import { sileo } from '@/lib/sileo-shim'
import { useCuentasBancarias } from "@/features/contabilidad/hooks/use-cuentas-bancarias"
import { validarTransferenciaAction, createTransferenciaBancariaAction } from "@/features/contabilidad/actions"
import { TasaCambioDialog } from "@/features/contabilidad/components/tasa-cambio-dialog"
import { cn } from "@/lib/utils"
import type { CuentaBancaria } from "@/app/models/model"

const transferenciaBancariaSchema = z.object({
  cuentaOrigenId: z.string().min(1, "Debe seleccionar una cuenta origen"),
  cuentaDestinoId: z.string().min(1, "Debe seleccionar una cuenta destino"),
  monto: z.string().min(1, "El monto es requerido").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "El monto debe ser un número positivo"
  ),
  motivo: z.string().min(1, "El motivo es requerido"),
  descripcion: z.string().optional(),
})

type TransferenciaBancariaFormData = z.infer<typeof transferenciaBancariaSchema>

interface TransferenciaBancariaFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

const surfaceCardClass = cn(
  'w-full border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

const labelClass = cn(
  'text-sm font-medium text-slate-700',
  'dark:text-slate-200',
);

const inputClass = cn(
  'bg-white/50 text-slate-900 placeholder:text-slate-400 transition-all duration-300',
  'border-slate-200/60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40',
  'dark:bg-slate-900/10 dark:text-slate-100 dark:border-slate-800/60 dark:focus:bg-slate-950',
);

const outlineButtonClass = cn(
  'border-slate-200/70 bg-white/50 text-slate-700 shadow-sm transition-all duration-300',
  'hover:bg-white hover:border-blue-500/40 hover:text-blue-600 hover:shadow-md',
  'dark:border-slate-800/60 dark:bg-slate-900/10 dark:text-slate-200',
  'dark:hover:bg-slate-900/10 dark:hover:border-blue-400/40 dark:hover:text-blue-400',
);

export function TransferenciaBancariaForm({ onSuccess, onCancel }: TransferenciaBancariaFormProps) {
  const { cuentas: cuentasBancarias, isLoading: isLoadingCuentas } = useCuentasBancarias()
  const [showTasaDialog, setShowTasaDialog] = useState(false)
  const [validacionData, setValidacionData] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)



  const shouldReduceMotion = useReducedMotion()

  const fadeInUp = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: 'easeOut' as const,
      },
    },
  };

  const stagger = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.06,
      },
    },
  };

  const form = useForm<TransferenciaBancariaFormData>({
    resolver: zodResolver(transferenciaBancariaSchema),
    defaultValues: {
      cuentaOrigenId: "",
      cuentaDestinoId: "",
      monto: "",
      motivo: "",
      descripcion: "",
    },
  })

  const cuentaOrigen = cuentasBancarias.find(c => c.cuentaId === form.watch("cuentaOrigenId"))
  const cuentaDestino = cuentasBancarias.find(c => c.cuentaId === form.watch("cuentaDestinoId"))
  const monto = Number(form.watch("monto") || 0)

  // Verificar si las monedas son diferentes
  const requiereConversion = cuentaOrigen && cuentaDestino && 
    cuentaOrigen.moneda !== cuentaDestino.moneda

  const handleValidarTransferencia = async (data: TransferenciaBancariaFormData) => {
    try {
      const validacionRequest = {
        cuentaOrigenId: data.cuentaOrigenId,
        cuentaDestinoId: data.cuentaDestinoId,
        monto: Number(data.monto),
        motivo: data.motivo,
        descripcion: data.descripcion,
      }

      const response = await validarTransferenciaAction({
        cuentaOrigenId: data.cuentaOrigenId,
        cuentaDestinoId: data.cuentaDestinoId,
        monto: Number(data.monto),
        motivo: data.motivo,
        descripcion: data.descripcion,
      })

      if (!response.success) throw new Error(response.error?.message || 'Error al validar')

      const validacionDataOk = {
        ...validacionRequest,
        ...response,
        cuentaOrigen,
        cuentaDestino,
      }

      setValidacionData(validacionDataOk)

      if (requiereConversion) {
        setShowTasaDialog(true)
      } else {
        await ejecutarTransferencia(validacionDataOk)
      }
    } catch (error: any) {
      sileo.error({ title: error?.data?.error || 'Error al validar la transferencia' })
    }
  }

  const ejecutarTransferencia = async (data: any) => {
    setIsSubmitting(true)
    try {
      const payload = {
        cuentaOrigenId: data.cuentaOrigenId,
        cuentaDestinoId: data.cuentaDestinoId,
        montoOrigen: Number(data.monto),
        motivo: data.motivo,
        descripcion: data.descripcion,
        ...(data.tasaCambio ? { tasaCambio: Number(data.tasaCambio) } : {}),
        monedaPrincipal: data.monedaPrincipal
      }

      await createTransferenciaBancariaAction({
        cuentaOrigenId: data.cuentaOrigenId,
        cuentaDestinoId: data.cuentaDestinoId,
        montoOrigen: Number(data.monto),
        motivo: data.motivo,
        descripcion: data.descripcion,
        ...(data.tasaCambio ? { tasaCambio: Number(data.tasaCambio) } : {}),
        monedaPrincipal: data.monedaPrincipal
      })

      sileo.success({ title: 'Transferencia realizada exitosamente' })
      form.reset()
      setValidacionData(null)
      onSuccess?.()
    } catch (error: any) {
      sileo.error({ title: error?.data?.error || error?.message || 'Error al realizar la transferencia' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmarTasa = (tasaCambio: number) => {
    setShowTasaDialog(false)
    const data = { ...validacionData, tasaCambio }
    setValidacionData(data)
    ejecutarTransferencia(data)
  }

  const cuentasDisponibles = cuentasBancarias.filter(cuenta => cuenta.isActive)

  return (
    <>
      <motion.div variants={fadeInUp} initial="hidden" animate="show">
        <Form {...form}>
          <motion.form 
            onSubmit={form.handleSubmit(handleValidarTransferencia, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} 
            className="space-y-6"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div variants={fadeInUp}>
                <FormField
                  control={form.control}
                  name="cuentaOrigenId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Cuenta Origen</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value)} value={(field.value)}>
                        <FormControl>
                          <SelectTrigger className={inputClass}>
                            <SelectValue placeholder="Seleccionar cuenta origen" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {cuentasDisponibles
                            ?.filter(cuenta => cuenta.cuentaId !== form.watch("cuentaDestinoId"))
                            ?.map((cuenta) => (
                            <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                              <div className="flex flex-col">
                                <span>{cuenta.nombreBanco} - {cuenta.numeroCuenta}</span>
                                <span className="text-xs text-muted-foreground">
                                  Saldo: {cuenta.saldo} {cuenta.moneda}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div variants={fadeInUp}>
                <FormField
                  control={form.control}
                  name="cuentaDestinoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Cuenta Destino</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={inputClass}>
                            <SelectValue placeholder="Seleccionar cuenta destino" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {cuentasDisponibles
                            ?.filter(cuenta => cuenta.cuentaId !== form.watch("cuentaOrigenId"))
                            ?.map((cuenta) => (
                            <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                              {cuenta.nombreBanco} - {cuenta.numeroCuenta} ({cuenta.moneda})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
            </div>

            <motion.div variants={fadeInUp}>
              <FormField
                control={form.control}
                name="monto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>
                      Monto {cuentaOrigen && `(${cuentaOrigen.moneda})`}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          className={cn(inputClass, "pl-7")}
                        />
                      </div>
                    </FormControl>
                    {cuentaOrigen && monto > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-muted-foreground flex items-center gap-2 mt-1"
                      >
                        <Info className="h-3 w-3" />
                        <span>Saldo disponible: {cuentaOrigen.saldo} {cuentaOrigen.moneda}</span>
                        {monto > Number(cuentaOrigen.saldo) && (
                          <span className="text-red-500 font-medium ml-2 flex items-center gap-1">
                            ⚠️ Saldo insuficiente
                          </span>
                        )}
                      </motion.div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            {requiereConversion && (
              <motion.div 
                variants={fadeInUp}
                className="p-4 bg-yellow-50/50 border border-yellow-200/60 rounded-lg dark:bg-yellow-900/10 dark:border-yellow-700/30"
              >
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
                  <ArrowRightLeft className="h-4 w-4" />
                  <span className="font-medium">Conversión de moneda requerida</span>
                </div>
                <p className="text-sm text-yellow-600/90 dark:text-yellow-500/80 mt-1">
                  Esta transferencia requiere conversión de {cuentaOrigen?.moneda} a {cuentaDestino?.moneda}.
                  Se solicitará la tasa de cambio antes de proceder.
                </p>
              </motion.div>
            )}

            <motion.div variants={fadeInUp}>
              <FormField
                control={form.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Motivo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Reposición de caja chica, Pago a proveedores..."
                        {...field}
                        className={inputClass}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            <motion.div variants={fadeInUp}>
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Descripción (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detalles adicionales sobre la transferencia..."
                        rows={3}
                        {...field}
                        className={inputClass}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            <motion.div variants={fadeInUp} className="flex justify-end gap-3 pt-2">
              {onCancel && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onCancel}
                  className={outlineButtonClass}
                >
                  Cancelar
                </Button>
              )}
              <Button 
                type="submit" 
                disabled={!form.formState.isValid || monto > Number(cuentaOrigen?.saldo || 0) || isSubmitting}
                className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-all shadow-md hover:shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Validar Transferencia
                  </>
                )}
              </Button>
            </motion.div>
          </motion.form>
        </Form>
      </motion.div>

      {/* Diálogo de confirmación de tasa de cambio */}
      {showTasaDialog && cuentaOrigen && cuentaDestino && (
        <TasaCambioDialog
          isOpen={showTasaDialog}
          onClose={() => setShowTasaDialog(false)}
          monedaOrigen={cuentaOrigen.moneda}
          monedaDestino={cuentaDestino.moneda}
          monto={monto}
          onConfirm={handleConfirmarTasa}
        />
      )}
    </>
  )
}
