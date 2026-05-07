/**
 * @description Formulario para crear tipos de contratos personalizados
 * @returns {JSX.Element} Componente de formulario
 */

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Loader2, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAuthToken } from '@/lib/token'

const tipoContratoSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  descripcion: z
    .string()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .optional(),
})

type TipoContratoFormValues = z.infer<typeof tipoContratoSchema>

interface TiposContratosFormProps {
  onSuccess?: () => void
  onCreated?: (tipo: any) => void
}

export function TiposContratosForm({
  onSuccess,
  onCreated,
}: TiposContratosFormProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const form = useForm<TipoContratoFormValues>({
    resolver: zodResolver(tipoContratoSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
    },
  })

  const onSubmit = async (values: TipoContratoFormValues) => {
    // Validación adicional: campo nombre
    if (!values.nombre || values.nombre.trim().length === 0) {
      form.setError('nombre', {
        type: 'manual',
        message: 'El nombre del tipo de contrato es obligatorio',
      })
      toast.error('El nombre del tipo de contrato es obligatorio')
      return
    }

    // Validación adicional: no permitir espacios en blanco solamente
    if (!/[a-zA-Z0-9]/.test(values.nombre)) {
      form.setError('nombre', {
        type: 'manual',
        message:
          'El nombre debe contener al menos un carácter alfanumérico',
      })
      toast.error(
        'El nombre debe contener al menos un carácter alfanumérico'
      )
      return
    }

    setIsLoading(true)
    setIsSuccess(false)

    try {
      const response = await fetch('/api/tipos-contratos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthToken(),
        },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (!response.ok) {
        // Manejar errores específicos
        if (response.status === 409) {
          form.setError('nombre', {
            type: 'manual',
            message: data.error || 'Este tipo de contrato ya existe',
          })
          toast.error(data.error || 'Este tipo de contrato ya existe')
        } else if (response.status === 400 && data.details) {
          // Errores de validación de Zod
          data.details.forEach((err: any) => {
            toast.error(`${err.field}: ${err.message}`)
          })
        } else {
          toast.error(data.error || 'Error al crear el tipo de contrato')
        }
        return
      }

      // Éxito
      setIsSuccess(true)
      toast.success('Tipo de contrato creado exitosamente')

      form.reset()
      onCreated?.(data)

      // Cerrar dialog después de 1.5s
      setTimeout(() => {
        setOpen(false)
        setIsSuccess(false)
        onSuccess?.()
      }, 1500)
    } catch (error) {
      console.error('Error al crear tipo de contrato:', error)
      toast.error('Error al crear el tipo de contrato')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Button
            size="sm"
            className="gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            Nuevo Tipo de Contrato
          </Button>
        </motion.div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <motion.div
              className="w-6 h-6 bg-linear-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              <Plus className="h-3 w-3 text-white" />
            </motion.div>
            Crear Tipo de Contrato
          </DialogTitle>
          <DialogDescription>
            Agregue un nuevo tipo de contrato personalizado al sistema
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  {/* Nombre */}
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="required-field">
                          Nombre del Tipo
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: Contrato de Distribución"
                            disabled={isLoading}
                            {...field}
                            autoFocus
                            className="focus:ring-2 focus:ring-primary/20"
                          />
                        </FormControl>
                        <FormDescription>
                          Nombre único del tipo de contrato (3-100 caracteres)
                        </FormDescription>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* Descripción */}
                  <FormField
                    control={form.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe brevemente el tipo de contrato..."
                            disabled={isLoading}
                            className="min-h-25 resize-none focus:ring-2 focus:ring-primary/20"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Máximo 500 caracteres. Detalles opcionales sobre este
                          tipo de contrato
                        </FormDescription>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* Botones */}
                  <div className="flex gap-2 justify-end pt-2">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isLoading}
                        onClick={() => {
                          setOpen(false)
                          form.reset()
                        }}
                      >
                        Cancelar
                      </Button>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Crear Tipo
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </form>
              </Form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-12 gap-4"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: 1 }}
                className="w-16 h-16 bg-linear-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center"
              >
                <CheckCircle2 className="h-8 w-8 text-white" />
              </motion.div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold text-foreground">
                  ¡Éxito!
                </h3>
                <p className="text-sm text-muted-foreground">
                  El tipo de contrato ha sido creado correctamente
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
