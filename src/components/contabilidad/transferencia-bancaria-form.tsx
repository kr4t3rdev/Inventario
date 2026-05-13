'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, ArrowRightLeft, Building2, FileText } from 'lucide-react'
import { getCuentasBancariasAction } from '@/features/contabilidad/actions-cuentas-bancarias'

/** @description Esquema de validación para formulario de transferencia bancaria */
const transferenciaSchema = z.object({
  cuentaOrigenId: z.string().min(1, 'Seleccione la cuenta origen'),
  cuentaDestinoId: z.string().min(1, 'Seleccione la cuenta destino'),
  montoOrigen: z.number({ invalid_type_error: 'Ingrese un monto válido' })
    .positive('El monto debe ser positivo'),
  motivo: z.string().min(1, 'El motivo es requerido'),
  descripcion: z.string().optional(),
  tasaCambio: z.number({ invalid_type_error: 'Ingrese una tasa válida' })
    .positive('La tasa debe ser positiva')
    .optional()
}).refine((data) => data.cuentaOrigenId !== data.cuentaDestinoId, {
  message: 'La cuenta origen y destino deben ser diferentes',
  path: ['cuentaDestinoId'],
})

type TransferenciaFormData = z.infer<typeof transferenciaSchema>

interface CuentaOption {
  cuentaId: string
  nombreBanco: string
  numeroCuenta: string
  moneda: string
  saldo: number
}

interface TransferenciaBancariaFormProps {
  /** @description Callback al completar la transferencia exitosamente */
  onSuccess?: () => void
  /** @description Callback al cancelar el formulario */
  onCancel?: () => void
}

/**
 * @description Formulario para crear una transferencia bancaria entre cuentas.
 * Valida saldo, monedas distintas, y ejecuta la transferencia vía API.
 * @param {TransferenciaBancariaFormProps} props - Props del componente
 * @returns {JSX.Element} Formulario de transferencia bancaria
 */
export function TransferenciaBancariaForm({ onSuccess, onCancel }: TransferenciaBancariaFormProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [cuentas, setCuentas] = useState<CuentaOption[]>([])
  const [isLoadingCuentas, setIsLoadingCuentas] = useState(true)

  useEffect(() => {
    getCuentasBancariasAction().then((r: any) => {
      if (r.success) {
        setCuentas(r.data?.cuentas ?? [])
      }
      setIsLoadingCuentas(false)
    })
  }, [])

  const form = useForm<TransferenciaFormData>({
    resolver: zodResolver(transferenciaSchema),
    defaultValues: {
      cuentaOrigenId: '',
      cuentaDestinoId: '',
      montoOrigen: 0,
      motivo: '',
      descripcion: '',
    },
  })

  const cuentaOrigenId = form.watch('cuentaOrigenId')
  const cuentaDestinoId = form.watch('cuentaDestinoId')

  const cuentaOrigen = cuentas.find((c) => c.cuentaId === cuentaOrigenId)
  const cuentaDestino = cuentas.find((c) => c.cuentaId === cuentaDestinoId)
  const monedasDistintas = cuentaOrigen && cuentaDestino && cuentaOrigen.moneda !== cuentaDestino.moneda

  const onSubmit = async (data: TransferenciaFormData) => {
    try {
      setIsCreating(true)

      const payload: Record<string, unknown> = {
        cuentaOrigenId: data.cuentaOrigenId,
        cuentaDestinoId: data.cuentaDestinoId,
        montoOrigen: data.montoOrigen,
        motivo: data.motivo,
        descripcion: data.descripcion || undefined,
      }

      if (data.tasaCambio && data.tasaCambio > 0) {
        payload.tasaCambio = data.tasaCambio
      }

      const response = await fetch('/api/contabilidad/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al crear la transferencia')
      }

      onSuccess?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado'
      console.error('Error creating transferencia:', message)
    } finally {
      setIsCreating(false)
    }
  }

  const resetForm = (): void => {
    form.reset()
    onCancel?.()
  }

  if (isLoadingCuentas) {
    return (
      <div className="flex items-center justify-center p-12" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          Nueva Transferencia
        </CardTitle>
        <CardDescription>
          Complete los datos para realizar una transferencia entre cuentas bancarias.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Cuenta Origen */}
            <FormField
              control={form.control}
              name="cuentaOrigenId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta Origen</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      if (cuentaDestinoId === value) {
                        form.setValue('cuentaDestinoId', '')
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione cuenta origen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cuentas.map((cuenta) => (
                        <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                          {cuenta.nombreBanco} - {cuenta.numeroCuenta} ({cuenta.moneda}) &mdash; Saldo:{' '}
                          {Number(cuenta.saldo).toLocaleString('es-CU', {
                            minimumFractionDigits: 2,
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {cuentaOrigen && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <Building2 className="inline h-3 w-3 mr-1" />
                      Saldo disponible: {Number(cuentaOrigen.saldo).toLocaleString('es-CU', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      {cuentaOrigen.moneda}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cuenta Destino */}
            <FormField
              control={form.control}
              name="cuentaDestinoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta Destino</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione cuenta destino" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cuentas
                        .filter((c) => c.cuentaId !== cuentaOrigenId)
                        .map((cuenta) => (
                          <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                            {cuenta.nombreBanco} - {cuenta.numeroCuenta} ({cuenta.moneda})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {cuentaDestino && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <Building2 className="inline h-3 w-3 mr-1" />
                      {cuentaDestino.nombreBanco} &mdash; Moneda: {cuentaDestino.moneda}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Monedas distintas - mostrar advertencia */}
            {monedasDistintas && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                Las cuentas tienen monedas diferentes ({cuentaOrigen.moneda} &rarr;{' '}
                {cuentaDestino.moneda}). Debe ingresar la tasa de cambio.
              </div>
            )}

            {/* Monto + Tasa de Cambio */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="montoOrigen"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Monto{cuentaOrigen ? ` (${cuentaOrigen.moneda})` : ''}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={field.value || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          field.onChange(val === '' ? '' : Number(val))
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {monedasDistintas && (
                <FormField
                  control={form.control}
                  name="tasaCambio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Tasa de Cambio ({cuentaOrigen.moneda} &rarr; {cuentaDestino.moneda})
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          placeholder="1.0000"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            field.onChange(val === '' ? undefined : Number(val))
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Motivo */}
            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Pago a proveedor, Transferencia entre cuentas" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descripción */}
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    Descripci&oacute;n <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalles adicionales de la transferencia"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isCreating}
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Realizar Transferencia
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
