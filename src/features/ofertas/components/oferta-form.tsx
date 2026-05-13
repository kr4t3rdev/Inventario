"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Trash2,
  Plus,
  Loader2,
  Sparkles,
  Receipt,
  Package,
  Calculator
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { sileo } from '@/lib/sileo-shim';
import { Skeleton } from "@/components/ui/skeleton";
import { useProductos } from '@/features/productos/hooks/use-productos'
import { useClientes } from "@/features/clientes/hooks/use-clientes";
import { createOfertaAction } from "@/features/ofertas/actions";
import { getAnticiposAction } from "@/features/contabilidad/actions-anticipos";
import { formatCurrency } from "@/lib/utils";
import { getAuthToken } from "@/lib/token";
import type { OfertaItem, Oferta } from "@/app/models/model";

interface CreateOfertaItem {
  productoId?: string;
  servicioId?: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

const itemSchema = z.object({
  type: z.enum(["producto", "servicio"]),
  itemId: z.string().min(1, "Seleccione un item"),
  cantidad: z.coerce.number().min(1, "Mínimo 1"),
  precioUnitario: z.coerce.number().min(0, "Precio inválido"),
  total: z.number()
})

const ofertaSchema = z.object({
  clienteId: z.string().min(1, 'El campo Cliente no ha sido seleccionado'),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  items: z.array(itemSchema).min(1, "Agregue al menos un item"),
  subtotal: z.number(),
  impuestos: z.number(),
  total: z.number()
})

type OfertaFormValues = z.infer<typeof ofertaSchema>;

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
}

function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <motion.div
      className="border-2 border-primary border-t-transparent rounded-full"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
  )
}

export function OfertaForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedAnticipoCobroId, setSelectedAnticipoCobroId] = useState<string>("")
  const anticiposFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_ANTICIPOS !== "false"

  const { productos, isLoading: isLoadingProductos } = useProductos()
  const { clientes, isLoading: isLoadingClientes } = useClientes()

  const form = useForm<OfertaFormValues>({
    resolver: zodResolver(ofertaSchema),
    defaultValues: {
      clienteId: "",
      items: [{ type: "producto", itemId: "", cantidad: 1, precioUnitario: 0, total: 0 }],
      subtotal: 0,
      impuestos: 0,
      total: 0
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  })

  const watchedItems = useWatch({ control: form.control, name: "items" })
  const watchedImpuestos = useWatch({ control: form.control, name: "impuestos" }) || 0
  const watchedClienteId = useWatch({ control: form.control, name: "clienteId" })
  const [anticiposCobroDisponibles, setAnticiposCobroDisponibles] = useState<{ anticipos: any[] } | undefined>(undefined)
  const [isLoadingAnticiposCobro, setIsLoadingAnticiposCobro] = useState(false)

  useEffect(() => {
    if (!anticiposFeatureEnabled || !watchedClienteId) {
      setAnticiposCobroDisponibles(undefined)
      return
    }

    let cancelled = false
    setIsLoadingAnticiposCobro(true)
    getAnticiposAction({ clienteId: watchedClienteId, moneda: 'CUP' }).then((res) => {
      if (!cancelled && res.success) {
        setAnticiposCobroDisponibles(res.data)
      }
    }).finally(() => {
      if (!cancelled) setIsLoadingAnticiposCobro(false)
    })
    return () => { cancelled = true }
  }, [anticiposFeatureEnabled, watchedClienteId])

  useEffect(() => {
    const subtotal = watchedItems.reduce((sum, item) => sum + (item.total || 0), 0)
    form.setValue("subtotal", subtotal)
    form.setValue("total", subtotal + watchedImpuestos)
  }, [watchedItems, watchedImpuestos, form])

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const currentItem = form.getValues(`items.${index}`);
    const newItem = { ...currentItem, [field]: value };

    if (field === "itemId" && typeof value === "string") {
      const product = productos?.find(p => p.id === value);
      if (product) {
        newItem.precioUnitario = product.precioVenta;
      }
    }
    const cantidad = typeof newItem.cantidad === "number" ? newItem.cantidad : 1;
    const precio = typeof newItem.precioUnitario === "number" ? newItem.precioUnitario : 0;
    newItem.total = cantidad * precio;
    form.setValue(`items.${index}`, newItem);
  };

  const openOfertaPdf = async (ofertaId: string, printWindow?: Window | null) => {
    const token = getAuthToken()
    const res = await fetch(`/api/ofertas/${ofertaId}/pdf`, {
      headers: token ? { Authorization: token } : undefined
    })
    if (!res.ok) {
      throw new Error("No se pudo generar el PDF")
    }
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const targetWindow = printWindow ?? window.open(blobUrl, "_blank")
    if (targetWindow) {
      targetWindow.location.href = blobUrl
      setTimeout(() => {
        try {
          targetWindow.focus()
          targetWindow.print()
        } catch (error) {
          console.error(error)
        }
      }, 500)
    } else {
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `oferta-${ofertaId}.pdf`
      link.style.display = "none"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
  }

  const onSubmit = async (data: OfertaFormValues) => {
    const printWindow = window.open("", "_blank")
    setIsSubmitting(true);
    try {
      const createItems = data.items.map(item => ({
        productoId: item.type === "producto" ? item.itemId : undefined,
        servicioId: item.type === "servicio" ? item.itemId : undefined,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        total: item.total
      }));

      const payload = {
        clienteId: data.clienteId,
        fechaVencimiento: data.fechaVencimiento,
        observaciones: data.observaciones,
        items: createItems,
        subtotal: data.subtotal,
        impuestos: data.impuestos,
        total: data.total
      } as Partial<Oferta>;

  // @ts-expect-error - createOfertaAction recibe un payload parcial tipado en runtime.
      const result = await createOfertaAction(payload);
      if (!result.success) {
  // @ts-expect-error - result.error puede ser string o respuesta tipada según la acción.
        throw new Error(result.error || "Error al crear la oferta")
      }
      const createdOferta = result.data
  // @ts-expect-error - createdOferta se resuelve desde la respuesta de la acción.
      await openOfertaPdf(createdOferta.id, printWindow);
      sileo.success({ title: 'Oferta creada exitosamente' });
      const nextUrl = selectedAnticipoCobroId
        ? `/busy/ofertas/${
  // @ts-expect-error - createdOferta se resuelve desde la respuesta de la acción.
        createdOferta.id}?anticipoCobroId=${encodeURIComponent(selectedAnticipoCobroId)
        }`
        : `/busy/ofertas/${
  // @ts-expect-error - createdOferta se resuelve desde la respuesta de la acción.
        createdOferta.id
        }`
      router.push(nextUrl);
    } catch (error) {
      if (printWindow) {
        printWindow.close()
      }
      sileo.error({ title: 'Error al crear la oferta' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isLoadingProductos || isLoadingClientes

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8 mb-6">
              <LoadingSpinner size={40} />
            </div>
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                <Skeleton className="h-10 w-full" />
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <Skeleton className="h-10 w-full" />
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <Skeleton className="h-10 w-full" />
              </motion.div>
              <div className="flex justify-end space-x-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-dashed overflow-hidden">
        <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
        <CardContent className="pt-6">
          <motion.div
            className="flex items-center gap-3 mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <motion.div
              className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Receipt className="h-5 w-5 text-white" />
            </motion.div>
            <div className="relative">
              <h2 className="text-lg font-semibold">Nueva Oferta</h2>
              <p className="text-sm text-muted-foreground">Cree una nueva oferta para un cliente</p>
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-6">
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                <motion.div variants={fadeInUp}>
                  <FormField
                    control={form.control}
                    name="clienteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                              <SelectValue placeholder="Seleccione cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientes?.map((cliente) => (
                              <SelectItem key={cliente.clienteId} value={cliente.clienteId}>
                                {cliente.nombre}
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
                    name="fechaVencimiento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha Vencimiento</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            className="transition-all duration-200 focus:scale-[1.01]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

              {anticiposFeatureEnabled && (
                <motion.div variants={fadeInUp}>
                  <FormItem>
                    <FormLabel>Cobro anticipado sugerido (opcional)</FormLabel>
                    <Select
                      value={selectedAnticipoCobroId || "__none__"}
                      onValueChange={(value) => setSelectedAnticipoCobroId(value === "__none__" ? "" : value)}
                    >
                      <FormControl>
                        <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                          <SelectValue placeholder="Sin anticipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sin anticipo</SelectItem>
                        {(anticiposCobroDisponibles?.anticipos || []).map((anticipo) => (
                          <SelectItem key={anticipo.anticipoId} value={anticipo.anticipoId}>
                            {`${anticipo.anticipoId.slice(0, 8)} · Saldo ${Number(anticipo.saldoDisponible).toFixed(2)} ${anticipo.moneda}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isLoadingAnticiposCobro
                      ? "Cargando anticipos..."
                      : "Se preseleccionará al facturar la oferta"}
                  </p>
                </motion.div>
              )}
              </motion.div>

              <motion.div
                className="space-y-4"
                variants={fadeInUp}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium">Items</h3>
                  </div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ type: "producto", itemId: "", cantidad: 1, precioUnitario: 0, total: 0 })}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Agregar Item
                    </Button>
                  </motion.div>
                </div>

                <AnimatePresence mode="popLayout">
                  {fields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      className="grid grid-cols-12 gap-2 items-end border p-4 rounded-md bg-card hover:bg-accent/50 transition-colors"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      layout
                    >
                      <div className="col-span-6">
                        <FormLabel className="text-xs">Producto</FormLabel>
                        <Select
                          value={form.watch(`items.${index}.itemId`)}
                          onValueChange={(val) => handleItemChange(index, "itemId", val)}
                        >
                          <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                            <SelectValue placeholder="Seleccione producto..." />
                          </SelectTrigger>
                          <SelectContent>
                            {productos?.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <FormLabel className="text-xs">Cantidad</FormLabel>
                        <Input
                          type="number"
                          min={1}
                          {...form.register(`items.${index}.cantidad`)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            handleItemChange(index, "cantidad", isNaN(val) ? 1 : val);
                          }}
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </div>
                      <div className="col-span-2">
                        <FormLabel className="text-xs">Precio</FormLabel>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          {...form.register(`items.${index}.precioUnitario`)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            handleItemChange(index, "precioUnitario", isNaN(val) ? 0 : val);
                          }}
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </div>
                      <div className="col-span-1 text-right pb-2 font-medium">
                        {formatCurrency(form.watch(`items.${index}.total`))}
                      </div>
                      <div className="col-span-1">
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              <motion.div
                className="flex justify-end"
                variants={fadeInUp}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="w-full md:w-1/3 border-dashed">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(form.watch("subtotal"))}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Impuestos:</span>
                      <Input
                        type="number"
                        className="w-24 text-right h-8 transition-all duration-200 focus:scale-[1.01]"
                        {...form.register("impuestos", { valueAsNumber: true })}
                      />
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span className="text-primary">{formatCurrency(form.watch("total"))}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                variants={fadeInUp}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                <FormField
                  control={form.control}
                  name="observaciones"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observaciones</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="transition-all duration-200 focus:scale-[1.01]"
                          placeholder="Notas adicionales..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                className="flex justify-end gap-4 pt-4"
                variants={fadeInUp}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => router.back()}
                  >
                    Cancelar
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
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
                    ) : (
                      "Crear Oferta"
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
