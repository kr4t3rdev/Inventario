"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, Save, X, Building2, User } from "lucide-react"
import { toast } from "sonner"
import { showErrorToast } from "../toast-notifications"
import { useCreateInyeccionCapitalMutation, useGetCuentasBancariasQuery, useGetMonedasQuery } from "@/lib/redux/services/contabilidadApi"
import { Textarea } from "@/components/ui/textarea"
import { motion, AnimatePresence } from "framer-motion"

// Validation schema
const capitalSchema = z.object({
  tipo: z.enum(["CAPITAL_SOCIAL", "DEUDA_EXTERNA"]),
  montoRecibido: z.number().positive("El monto debe ser positivo"),
  moneda: z.string().min(1, "Seleccione una moneda"),
  cuentaId: z.string().min(1, "Seleccione una cuenta bancaria"),
  descripcion: z.string().optional(),
  
  // Specific fields
  socio: z.string().optional(),
  entidadPrestamista: z.string().optional(),
  tasaInteres: z.number().min(0).optional(),
  plazoMeses: z.number().int().positive().optional(),
  fechaInicioPago: z.string().optional(),
}).refine((data) => {
  if (data.tipo === "CAPITAL_SOCIAL") {
    return !!data.socio;
  }
  return true;
}, {
  message: "El nombre del socio es requerido para Capital Social",
  path: ["socio"],
}).refine((data) => {
  if (data.tipo === "DEUDA_EXTERNA") {
    return !!data.entidadPrestamista;
  }
  return true;
}, {
  message: "La entidad prestamista es requerida para Deuda Externa",
  path: ["entidadPrestamista"],
});

type CapitalFormData = z.infer<typeof capitalSchema>

interface CapitalFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function CapitalForm({ onSuccess, onCancel }: CapitalFormProps) {
  const [createInjection, { isLoading: isCreating }] = useCreateInyeccionCapitalMutation()
  const { data: cuentasData } = useGetCuentasBancariasQuery()
  const { data: monedasData } = useGetMonedasQuery()
  
  const cuentas = cuentasData?.cuentas || []
  const monedas = monedasData?.data || []

  const form = useForm<CapitalFormData>({
    resolver: zodResolver(capitalSchema),
    defaultValues: {
      tipo: "CAPITAL_SOCIAL",
      montoRecibido: 0,
      moneda: "CUP",
      cuentaId: "",
      descripcion: "",
      socio: "",
      entidadPrestamista: "",
      tasaInteres: 0,
      plazoMeses: 12,
    },
  })

  const tipo = form.watch("tipo")

  const onSubmit = async (data: CapitalFormData) => {
    try {
      await createInjection(data).unwrap()
      toast.success("Inyección de capital registrada exitosamente")
      form.reset()
      onSuccess?.()
    } catch (error: any) {
      console.error('Error al registrar inyección:', error)
      showErrorToast.generic(error.data?.error || "Error al registrar la inyección")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="w-full border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            Nueva Inyección de Capital
          </CardTitle>
          <CardDescription>
            Complete los detalles para registrar una nueva entrada de capital o deuda externa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Inyección</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isCreating}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900">
                          <SelectValue placeholder="Seleccione el tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CAPITAL_SOCIAL">Capital Social (Aportación)</SelectItem>
                        <SelectItem value="DEUDA_EXTERNA">Deuda Externa (Préstamo)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="montoRecibido"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto Recibido</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="pl-8 font-mono text-lg"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            disabled={isCreating}
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="moneda"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isCreating}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione moneda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {monedas.map((m) => (
                            <SelectItem key={m.codigo} value={m.codigo}>
                              {m.nombre} ({m.simbolo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cuentaId"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Cuenta Bancaria Destino</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isCreating}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione cuenta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {cuentas.map((c) => (
                            <SelectItem key={c.cuentaId} value={c.cuentaId}>
                              {c.nombreBanco} - {c.numeroCuenta} ({c.moneda})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <AnimatePresence mode="wait">
                  {tipo === "CAPITAL_SOCIAL" ? (
                    <motion.div
                      key="socio"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="md:col-span-2"
                    >
                      <FormField
                        control={form.control}
                        name="socio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del Socio</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input placeholder="Nombre del socio aportador" className="pl-9" {...field} disabled={isCreating} />
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="entidad"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="md:col-span-2"
                    >
                      <FormField
                        control={form.control}
                        name="entidadPrestamista"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Entidad Prestamista</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input placeholder="Banco o Entidad" className="pl-9" {...field} disabled={isCreating} />
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {tipo === "DEUDA_EXTERNA" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 dark:border-slate-800 pt-6 mt-2">
                      <FormField
                        control={form.control}
                        name="tasaInteres"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tasa de Interés (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                disabled={isCreating}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="plazoMeses"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plazo (Meses)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="1"
                                min="1"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                disabled={isCreating}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Aquí podría ir fecha inicio pago si se requiere */}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción / Notas</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Detalles adicionales sobre la operación..." 
                        className="resize-none" 
                        {...field} 
                        disabled={isCreating}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} disabled={isCreating}>
                    Cancelar
                  </Button>
                )}
                <Button type="submit" disabled={isCreating} className="bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 min-w-[150px]">
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Registrar Operación
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
