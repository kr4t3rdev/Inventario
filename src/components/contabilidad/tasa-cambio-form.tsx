"use client"

import React, { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useGetMonedasQuery, useUpdateTasaCambioMutation } from "@/lib/redux/services/contabilidadApi"
import { sileo } from 'sileo'

const tasaCambioSchema = z.object({
  monedaOrigenId: z.string().min(1, "Selecciona la moneda de origen"),
  tasa: z.string()
    .min(1, "La tasa es requerida")
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
    }, "La tasa debe ser un número positivo"),
})

type TasaCambioFormData = z.infer<typeof tasaCambioSchema>

interface TasaCambioFormProps {
  onClose: () => void
  onSuccess: () => void
}

export function TasaCambioForm({ onClose, onSuccess }: TasaCambioFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [previewConversion, setPreviewConversion] = useState<{
    origen: number
    destino: number
  } | null>(null)

  const { data: monedasDatas = [] } = useGetMonedasQuery()
  const [updateTasaCambio] = useUpdateTasaCambioMutation()

  const monedas = Array.isArray(monedasDatas) ? (monedasDatas) :  Array.isArray((monedasDatas as any)?.data) ? (monedasDatas as any)?.data : Object.values(monedasDatas ?? [])

  const monedaPrincipal = monedas.find((m: any) => m.esPrincipal)
  const monedasSecundarias = monedas.filter((m: any) => !m.esPrincipal && m.isActive)

  const form = useForm<TasaCambioFormData>({
    resolver: zodResolver(tasaCambioSchema),
    defaultValues: {
      monedaOrigenId: "",
      tasa: "",
    },
  })

  const watchedValues = form.watch()

  // Actualizar preview cuando cambien los valores
  React.useEffect(() => {
    if (watchedValues.tasa && !isNaN(parseFloat(watchedValues.tasa))) {
      const tasa = parseFloat(watchedValues.tasa)
      setPreviewConversion({
        origen: 1,
        destino: tasa,
      })
    } else {
      setPreviewConversion(null)
    }
  }, [watchedValues.tasa])

  const onSubmit = async (data: TasaCambioFormData) => {
    setIsSubmitting(true)
    try {
      await updateTasaCambio({
        monedaOrigenId: data.monedaOrigenId,
        monedaDestino: monedaPrincipal?.codigo || "",
        tasa: parseFloat(data.tasa),
      }).unwrap()

      sileo.success({ title: 'Tasa de cambio actualizada correctamente' })
      onSuccess()
    } catch (error: any) {
      console.error("Error al actualizar tasa:", error)
      sileo.error({ title: error?.data?.error || 'Error al actualizar la tasa de cambio' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedMoneda = monedasSecundarias.find((m: any) => m.codigo === watchedValues.monedaOrigenId)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Actualizar Tasa de Cambio</DialogTitle>
          <DialogDescription>
            Define la tasa de conversión de una moneda secundaria a {monedaPrincipal?.nombre || "la moneda principal"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-4">
            <FormField
              control={form.control}
              name="monedaOrigenId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda de Origen</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {monedasSecundarias.map((moneda: any) => (
                        <SelectItem key={moneda.codigo} value={moneda.codigo}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{moneda.codigo}</span>
                            <span className="text-muted-foreground">
                              {moneda.simbolo} - {moneda.nombre}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Moneda que se convertirá a {monedaPrincipal?.codigo || "moneda principal"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tasa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tasa de Cambio</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="0.0000"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Cuántos {monedaPrincipal?.codigo || "unidades de moneda principal"} equivalen a 1 {selectedMoneda?.codigo || "unidad de moneda origen"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {previewConversion && selectedMoneda && monedaPrincipal && (
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground mb-2">Vista Previa de Conversión:</div>
                  <div className="flex items-center justify-center gap-4 text-lg">
                    <div className="text-center">
                      <div className="font-bold">{previewConversion.origen}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedMoneda.simbolo} {selectedMoneda.codigo}
                      </div>
                    </div>
                    <div className="text-muted-foreground">=</div>
                    <div className="text-center">
                      <div className="font-bold text-primary">
                        {previewConversion.destino.toFixed(4)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {monedaPrincipal.simbolo} {monedaPrincipal.codigo}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                {isSubmitting ? "Actualizando..." : "Actualizar Tasa"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}