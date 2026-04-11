"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Tag, Sparkles, Receipt, Package } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import { Card } from "@/components/ui/card"

import { Producto, Oferta } from "@/app/models/model"
import { useGetClientesQuery } from "@/lib/redux/services/ClienteApi"
import { useAddOfertaMutation } from "@/lib/redux/services/ofertasApi"
import { getAuthToken } from "@/lib/token"
import { formatCurrency } from "@/lib/utils"

interface QuickOfferDialogProps {
  producto: Producto
  trigger?: React.ReactNode
}

const formSchema = z.object({
  clienteId: z.string().min(1, "Seleccione un cliente"),
  cantidad: z.coerce.number().min(1, "La cantidad debe ser al menos 1"),
  precioUnitario: z.coerce.number().min(0, "El precio no puede ser negativo"),
  observaciones: z.string().optional(),
})

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
}

// Loading spinner component
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

export function QuickOfferDialog({ producto, trigger }: QuickOfferDialogProps) {
  const [open, setOpen] = useState(false)
  const { data: clientes, isLoading: isLoadingClientes } = useGetClientesQuery()
  const [addOferta, { isLoading: isSubmitting }] = useAddOfertaMutation()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clienteId: "",
      cantidad: 1,
      precioUnitario: producto.precioVenta,
      observaciones: "",
    },
  })

  const cantidad = form.watch("cantidad")
  const precioUnitario = form.watch("precioUnitario")
  const total = (cantidad || 0) * (precioUnitario || 0)

  const openOfertaPdf = async (ofertaId: string) => {
    const token = getAuthToken()
    const res = await fetch(`/api/ofertas/${ofertaId}/pdf`, {
      headers: token ? { Authorization: token } : undefined
    })
    
    if (!res.ok) {
      throw new Error("No se pudo generar el PDF")
    }
    
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const targetWindow = window.open(blobUrl, "_blank")
    
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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const payload = {
        clienteId: values.clienteId,
        fechaVencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        observaciones: values.observaciones,
        items: [
          {
            productoId: producto.id,
            cantidad: values.cantidad,
            precioUnitario: values.precioUnitario,
            total: values.cantidad * values.precioUnitario,
          },
        ],
        subtotal: values.cantidad * values.precioUnitario,
        impuestos: 0,
        total: values.cantidad * values.precioUnitario,
      } as Partial<Oferta>

      const createdOferta = await addOferta(payload).unwrap()
      toast.success('Oferta creada exitosamente')
      setOpen(false)
      form.reset()
      
      // Generate PDF
      try {
        await openOfertaPdf(createdOferta.id)
      } catch (pdfError) {
        console.error("Error generating PDF:", pdfError)
        toast.error('Oferta creada pero hubo un error al generar el PDF')
      }
    } catch (error) {
      console.error("Error creating offer:", error)
      toast.error('Error al crear la oferta')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="icon" title="Crear oferta rápida">
              <Tag className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <motion.div 
                className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Receipt className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <DialogTitle>Oferta Rápida</DialogTitle>
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
            </div>
            <DialogDescription>
              Crear una oferta para <strong>{producto.nombre}</strong>
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { toast.error('Completá los campos requeridos antes de continuar.') })} className="space-y-4 mt-4">
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {/* Producto Info Card */}
                <motion.div variants={fadeInUp}>
                  <Card className="p-3 mb-4 border-dashed bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{producto.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          Precio base: {formatCurrency(producto.precioVenta)}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>

                {/* Cliente */}
                <motion.div variants={fadeInUp}>
                  <FormField
                    control={form.control}
                    name="clienteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                              <SelectValue placeholder="Seleccione un cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingClientes ? (
                              <div className="p-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                <LoadingSpinner size={16} />
                                Cargando clientes...
                              </div>
                            ) : (
                              clientes?.map((cliente) => (
                                <SelectItem key={cliente.clienteId} value={cliente.clienteId}>
                                  {cliente.nombre}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                {/* Cantidad y Precio */}
                <motion.div 
                  className="grid grid-cols-2 gap-4 mt-4"
                  variants={fadeInUp}
                >
                  <FormField
                    control={form.control}
                    name="cantidad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            {...field} 
                            className="transition-all duration-200 focus:scale-[1.01]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="precioUnitario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Unitario</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            {...field} 
                            className="transition-all duration-200 focus:scale-[1.01]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                {/* Total */}
                <motion.div variants={fadeInUp}>
                  <Card className="mt-4 p-3 border-dashed bg-gradient-to-r from-primary/5 to-purple-600/5">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Estimado:</span>
                      <span className="font-bold text-lg text-primary">{formatCurrency(total)}</span>
                    </div>
                  </Card>
                </motion.div>

                {/* Observaciones */}
                <motion.div variants={fadeInUp}>
                  <FormField
                    control={form.control}
                    name="observaciones"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel>Observaciones (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Detalles adicionales..." 
                            className="resize-none transition-all duration-200 focus:scale-[1.01]" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>
              </motion.div>

              <DialogFooter className="mt-6">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear Oferta"
                    )}
                  </Button>
                </motion.div>
              </DialogFooter>
            </form>
          </Form>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
