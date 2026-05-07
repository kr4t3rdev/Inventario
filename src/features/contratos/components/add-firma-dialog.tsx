'use client'

import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Textarea } from "@/components/ui/textarea"
import { sileo } from '@/lib/sileo-shim'
import { getAuthToken } from "@/lib/token"
import { Plus, UserPlus, Sparkles, Loader2, PenTool } from "lucide-react"
import { motion } from "framer-motion"

// Schema para el formulario
const firmaSchema = z.object({
  firmanteId: z.string().min(1, "Seleccione un firmante"),
  tipoFirma: z.enum(["CLIENTE", "PROVEEDOR", "INTERNO"]),
  comentarios: z.string().optional(),
})

type FirmaFormValues = z.infer<typeof firmaSchema>

interface AddFirmaDialogProps {
  contratoId: string
  onSuccess: () => void
  users: Array<{ userId: string, name: string }>
}

export function AddFirmaDialog({ contratoId, onSuccess, users }: AddFirmaDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FirmaFormValues>({
    resolver: zodResolver(firmaSchema),
    defaultValues: {
      firmanteId: "",
      tipoFirma: "INTERNO",
      comentarios: "",
    },
  })

  async function onSubmit(data: FirmaFormValues) {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/contratos/${contratoId}/firmas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": getAuthToken(),
        },
        body: JSON.stringify({
          ...data,
          estado: 'PENDIENTE',
        }),
      })

      if (!response.ok) {
        throw new Error("Error al agregar firma")
      }

      sileo.success({ title: 'Solicitud de firma agregada exitosamente' })
      setOpen(false)
      form.reset()
      onSuccess()
    } catch (error) {
      console.error(error)
      sileo.error({ title: 'Error al agregar la solicitud de firma' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button size="sm" className="gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
            <Plus className="h-4 w-4" />
            Agregar Firma
          </Button>
        </motion.div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] border-dashed">
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
                <UserPlus className="h-4 w-4 text-white" />
              </motion.div>
              Agregar Solicitud de Firma
              <motion.div
                className="absolute right-10 top-4"
                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                transition={{ 
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
              >
                <Sparkles className="h-4 w-4 text-yellow-500" />
              </motion.div>
            </DialogTitle>
            <DialogDescription>
              Seleccione el usuario que debe firmar este contrato.
            </DialogDescription>
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
                  name="firmanteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        Firmante
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                            <SelectValue placeholder="Seleccione un usuario" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.userId} value={user.userId}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                  name="tipoFirma"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <PenTool className="h-4 w-4 text-muted-foreground" />
                        Tipo de Firma
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                            <SelectValue placeholder="Seleccione tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="INTERNO">Interno</SelectItem>
                          <SelectItem value="CLIENTE">Cliente</SelectItem>
                          <SelectItem value="PROVEEDOR">Proveedor</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <FormField
                  control={form.control}
                  name="comentarios"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comentarios (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Instrucciones adicionales para el firmante..."
                          className="resize-none transition-all duration-200 focus:scale-[1.01] min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <DialogFooter>
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
                    "Agregar Solicitud"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
