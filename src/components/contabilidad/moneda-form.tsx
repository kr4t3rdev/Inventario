"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useCreateMonedaMutation, useUpdateMonedaMutation } from "@/lib/redux/services/contabilidadApi"
import { sileo } from '@/lib/sileo-shim'

const monedaSchema = z.object({
  codigo: z.string()
    .min(3, "El código debe tener al menos 3 caracteres")
    .max(3, "El código debe tener exactamente 3 caracteres")
    .toUpperCase(),
  nombre: z.string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  simbolo: z.string()
    .min(1, "El símbolo es requerido")
    .max(5, "El símbolo no puede exceder 5 caracteres"),
  esPrincipal: z.boolean(),
  isActive: z.boolean(),
})

type MonedaFormData = z.infer<typeof monedaSchema>

interface MonedaFormProps {
  moneda?: any
  onClose: () => void
  onSuccess: () => void
}

export function MonedaForm({ moneda, onClose, onSuccess }: MonedaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!moneda

  const [createMoneda] = useCreateMonedaMutation()
  const [updateMoneda] = useUpdateMonedaMutation()

  const form = useForm<MonedaFormData>({
    resolver: zodResolver(monedaSchema),
    defaultValues: {
      codigo: moneda?.codigo || "",
      nombre: moneda?.nombre || "",
      simbolo: moneda?.simbolo || "",
      esPrincipal: moneda?.esPrincipal || false,
      isActive: moneda?.isActive ?? true,
    },
  })

  const onSubmit = async (data: MonedaFormData) => {
    setIsSubmitting(true)
    try {
      if (isEditing) {
        const { codigo, ...updateData } = data
        await updateMoneda({
          codigo: moneda.codigo, // Keep original codigo, don't allow changes
          ...updateData,
        }).unwrap()
        sileo.success({ title: 'Moneda actualizada correctamente' })
      } else {
        await createMoneda(data).unwrap()
        sileo.success({ title: 'Moneda creada correctamente' })
      }
      onSuccess()
    } catch (error: any) {
      console.error("Error al guardar moneda:", error)
      sileo.error({ title: error?.data?.error || 'Error al guardar la moneda' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Moneda" : "Nueva Moneda"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos de la moneda existente"
              : "Agrega una nueva moneda al sistema de exchange"
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-4">
            <FormField
              control={form.control}
              name="codigo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de Moneda</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="USD, EUR, CUP..."
                      {...field}
                      disabled={isEditing}
                      className="uppercase"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    Código ISO de 3 letras (ej: USD, EUR, CUP)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Moneda</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Dólar Americano, Euro, Peso Cubano..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Nombre completo de la moneda
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="simbolo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Símbolo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="$, €, CUP..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Símbolo que representa la moneda
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="esPrincipal"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Moneda Principal
                    </FormLabel>
                    <FormDescription>
                      Esta será la moneda base del sistema para conversiones
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

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Moneda Activa
                    </FormLabel>
                    <FormDescription>
                      Las monedas inactivas no aparecerán en las transacciones
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}