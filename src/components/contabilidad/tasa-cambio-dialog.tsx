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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingUp } from "lucide-react"
import { useGetMonedasQuery, useGetTasasActualesQuery } from "@/lib/redux/services/contabilidadApi"

const tasaConfirmacionSchema = z.object({
  tasaConfirmada: z.string()
    .min(1, "La tasa es requerida")
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
    }, "La tasa debe ser un número positivo"),
})

type TasaConfirmacionData = z.infer<typeof tasaConfirmacionSchema>

interface TasaCambioDialogProps {
  isOpen: boolean
  onClose: () => void
  monedaOrigen: string
  monedaDestino: string
  monto: number
  onConfirm: (tasa: number, montoConvertido: number) => void
  titulo?: string
  descripcion?: string
}

export function TasaCambioDialog({
  isOpen,
  onClose,
  monedaOrigen,
  monedaDestino,
  monto,
  onConfirm,
  titulo = "Confirmar Tasa de Cambio",
  descripcion = "Confirma o ajusta la tasa de cambio para esta transacción"
}: TasaCambioDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: tasasActualesData = [], isLoading } = useGetTasasActualesQuery()
  const { data: monedasData = [] } = useGetMonedasQuery()
  
  // Obtener la moneda principal desde la API
  const monedas = Array.isArray(monedasData) 
    ? monedasData 
    : Array.isArray((monedasData as { data?: unknown })?.data) 
    ? (monedasData as { data: unknown[] }).data 
    : Object.values(monedasData ?? [])
  const monedaPrincipal = (monedas as any[]).find((m: any) => m.esPrincipal)?.codigo
  
  // Normalizar el array de tasas para extraer el valor correcto
  const tasaActualMoneda = React.useMemo(() => {
    // Normalizar la respuesta de la API siguiendo el patrón de otros componentes
    let tasasActuales: unknown[] = []

    if (Array.isArray(tasasActualesData)) {
      tasasActuales = tasasActualesData
    } else if (tasasActualesData && typeof tasasActualesData === 'object' && 'data' in tasasActualesData) {
      const data = (tasasActualesData as { data: unknown }).data
      // Check if data has tasas property (new API format)
      if (data && typeof data === 'object' && 'tasas' in data && Array.isArray((data as { tasas: unknown[] }).tasas)) {
        tasasActuales = (data as { tasas: unknown[] }).tasas
      } else if (Array.isArray(data)) {
        tasasActuales = data
      } else {
        tasasActuales = [data]
      }
    } else if (tasasActualesData && typeof tasasActualesData === 'object') {
      tasasActuales = Object.values(tasasActualesData)
    }

    // Asegurar siempre un array plano de objetos de tasa
    const tasasActualesArray = Array.isArray(tasasActuales)
      ? tasasActuales
      : (typeof tasasActuales === "object" ? Object.values(tasasActuales) : [])

    const tasasActualesList = tasasActualesArray
      .flatMap((t: unknown) => {
        if (!t) return []
        if (Array.isArray(t)) return t
        if ((t as { tasas?: unknown[] })?.tasas) return (t as { tasas: unknown[] }).tasas
        return [t]
      })
      .flat()
      .filter(Boolean)

  // Buscar la tasa que coincida con las monedas especificadas
    const tasaEncontrada = tasasActualesList.find((tasa: any) => 
      (tasa?.monedaOrigen?.codigo === monedaOrigen || tasa?.monedaOrigenId === monedaOrigen) && 
      tasa?.monedaDestino === monedaDestino
    )
    
    if (tasaEncontrada) {
      return (tasaEncontrada as any).tasa
    }

    // Si no se encuentra en las tasas actuales, buscar en el objeto moneda directamente
    const monedaEncontrada = (monedas as any[]).find((m: any) => m.codigo === monedaOrigen)
    if (monedaEncontrada && monedaEncontrada.tasaCambio) {
      return Number(monedaEncontrada.tasaCambio)
    }
    
    return null
  }, [tasasActualesData, monedas, monedaOrigen, monedaDestino])

  
  const form = useForm<TasaConfirmacionData>({
    resolver: zodResolver(tasaConfirmacionSchema),
    defaultValues: {
      tasaConfirmada: tasaActualMoneda?.toString() || "",
    },
  })

  // Actualizar el valor por defecto cuando se carga la tasa
  React.useEffect(() => {
    if (tasaActualMoneda) {
      form.setValue("tasaConfirmada", tasaActualMoneda.toString())
    }
  }, [tasaActualMoneda, form])

  const watchedTasa = form.watch("tasaConfirmada")
  const tasaNumero = parseFloat(watchedTasa) || 0
  const montoConvertido = monto * tasaNumero
  const montoConvertido2 = monto / tasaNumero

  const diferenciaTasa = tasaActualMoneda ?
    Math.abs(tasaNumero - parseFloat(tasaActualMoneda.toString())) / parseFloat(tasaActualMoneda.toString()) * 100 : 0

  const onSubmit = async (data: TasaConfirmacionData) => {
    setIsSubmitting(true)
    try {
      const tasa = parseFloat(data.tasaConfirmada)
      const convertido = monto * tasa
      onConfirm(tasa, convertido)
    } catch (error) {
      console.error("Error al confirmar tasa:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {titulo}
          </DialogTitle>
          <DialogDescription>
            {descripcion}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información de la transacción */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Monto Original</div>
                  <div className="font-medium text-lg">
                    {monto.toLocaleString()} {monedaOrigen}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Monto Convertido</div>
                  <div className="font-medium text-lg text-primary">
                    {
                      montoConvertido?.toLocaleString()
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información de tasa actual */}
          {tasaActualMoneda && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">Tasa Actual del Sistema</div>
                  <Badge variant="secondary">
                    Actual
                  </Badge>
                </div>
                <div className="text-lg font-medium">
                  1 {monedaOrigen} = {tasaActualMoneda} {monedaDestino}
                </div>
                {diferenciaTasa > 5 && (
                  <div className="flex items-center gap-2 mt-2 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      La tasa difiere {diferenciaTasa.toFixed(1)}% de la tasa actual
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-4">
              <FormField
                control={form.control}
                name="tasaConfirmada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tasa de Cambio a Aplicar</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0000000001"
                        min="0.0000"
                        placeholder="0.000000000"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      Cuántos {monedaDestino} equivalen a 1 {monedaOrigen}
                    </FormDescription>
                    <FormMessage />
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
                <Button type="submit" disabled={isSubmitting || isLoading}>
                  {isSubmitting ? "Confirmando..." : "Confirmar Tasa"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}