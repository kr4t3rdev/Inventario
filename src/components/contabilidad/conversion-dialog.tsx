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
import { ArrowRightLeft, Calculator } from "lucide-react"
import { useGetMonedasQuery, useConvertirMonedaMutation } from "@/lib/redux/services/contabilidadApi"
import type { Moneda as MonedaModel } from "../../app/models/model"
import { sileo } from 'sileo'

const conversionSchema = z.object({
  monedaOrigen: z.string().min(1, "Selecciona la moneda de origen"),
  monedaDestino: z.string().min(1, "Selecciona la moneda de destino"),
  monto: z.string()
    .min(1, "El monto es requerido")
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
    }, "El monto debe ser un número positivo"),
  tasaUtilizada: z.string()
    .min(1, "La tasa es requerida")
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
    }, "La tasa debe ser un número positivo"),
})

type ConversionData = z.infer<typeof conversionSchema>

interface ConversionDialogProps {
  onClose: () => void
}

export function ConversionDialog({ onClose }: ConversionDialogProps) {
  const [resultado, setResultado] = useState<{
    montoOriginal: number
    montoConvertido: number
    tasa: number
    monedaOrigen: string
    monedaDestino: string
  } | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  const { data: monedasData = [] } = useGetMonedasQuery()
  const [convertirMoneda] = useConvertirMonedaMutation()

  const normalizeArray = <T,>(input: unknown): T[] => {
    if (Array.isArray(input)) return input as T[]
    if (input && typeof input === "object") {
      const maybeRecord = input as Record<string, unknown>
      const candidate = maybeRecord.data
      if (Array.isArray(candidate)) return candidate as T[]
      return Object.values(maybeRecord) as T[]
    }
    return []
  }

  const monedas = normalizeArray<MonedaModel>(monedasData)
  

  const monedasActivas: MonedaModel[] = monedas.filter((m: MonedaModel) => m.isActive)

  const form = useForm<ConversionData>({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      monedaOrigen: "",
      monedaDestino: "",
      monto: "",
      tasaUtilizada: "",
    },
  })

  const watchedValues = form.watch()

  const onSubmit = async (data: ConversionData) => {
    setIsConverting(true)
    try {
      const response = await convertirMoneda({
        monedaOrigen: data.monedaOrigen,
        monedaDestino: data.monedaDestino,
        monto: parseFloat(data.monto),
        tasa: parseFloat(data.tasaUtilizada),
      }).unwrap()

      setResultado({
        montoOriginal: parseFloat(data.monto),
        montoConvertido: Number(response?.montoConvertido ?? 0),
        tasa: Number(response?.tasaUtilizada ?? parseFloat(data.tasaUtilizada)),
        monedaOrigen: data.monedaOrigen,
        monedaDestino: data.monedaDestino,
      })

      sileo.success({ title: 'Conversión realizada correctamente' })
    } catch {
      sileo.error({ title: 'Error al realizar la conversión' })
    } finally {
      setIsConverting(false)
    }
  }

  const handleSwapMonedas = () => {
    const origen = form.getValues("monedaOrigen")
    const destino = form.getValues("monedaDestino")

    form.setValue("monedaOrigen", destino)
    form.setValue("monedaDestino", origen)
    setResultado(null)
  }

  const handleReset = () => {
    form.reset()
    setResultado(null)
  }


  const monedaOrigenData = monedasActivas.find((m: MonedaModel) => m.codigo === watchedValues.monedaOrigen)
  const monedaDestinoData = monedasActivas.find((m: MonedaModel) => m.codigo === watchedValues.monedaDestino)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Convertidor de Monedas
          </DialogTitle>
          <DialogDescription>
            Convierte entre diferentes monedas usando las tasas actuales del sistema
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monedaOrigen"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda de Origen</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value)
                      setResultado(null)
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {monedasActivas.map((moneda) => (
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monedaDestino"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda de Destino</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value)
                      setResultado(null)
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {monedasActivas.map((moneda) => (
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSwapMonedas}
                disabled={!watchedValues.monedaOrigen || !watchedValues.monedaDestino}
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto a Convertir</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          setResultado(null)
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {monedaOrigenData && `Monto en ${monedaOrigenData.nombre} (${monedaOrigenData.simbolo})`}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tasaUtilizada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tasa de Cambio</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.000001"
                        min="0"
                        placeholder="0.000000"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          setResultado(null)
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {watchedValues.monedaOrigen && watchedValues.monedaDestino && 
                        `1 ${watchedValues.monedaOrigen} = ? ${watchedValues.monedaDestino}`}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {resultado && (
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center space-y-2">
                    <div className="text-sm text-muted-foreground">Resultado de la Conversión</div>
                    <div className="flex items-center justify-center gap-4 text-lg">
                      <div className="text-center">
                        <div className="font-bold">
                          {resultado.montoOriginal.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {monedaOrigenData?.simbolo} {resultado.monedaOrigen}
                        </div>
                      </div>
                      <div className="text-muted-foreground">=</div>
                      <div className="text-center">
                        <div className="font-bold text-primary text-xl">
                          {(resultado.montoOriginal * resultado.tasa)?.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {monedaDestinoData?.simbolo} {resultado.monedaDestino}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tasa aplicada: 1 {resultado.monedaOrigen} = {resultado.tasa?.toFixed(6)} {resultado.monedaDestino}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={resultado ? handleReset : onClose}
              >
                {resultado ? "Nueva Conversión" : "Cerrar"}
              </Button>
              <Button
                type="submit"
                disabled={isConverting || !watchedValues.monedaOrigen || !watchedValues.monedaDestino || !watchedValues.monto || !watchedValues.tasaUtilizada}
              >
                {isConverting ? "Convirtiendo..." : "Convertir"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}