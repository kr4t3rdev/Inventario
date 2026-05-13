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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Loader2,
  SlidersHorizontal,
  ArrowUpCircle,
  ArrowDownCircle,
  Building2,
  Clock,
  User,
  AlertCircle,
  Plus,
  List,
} from 'lucide-react'
import { getCuentasBancariasAction } from '@/features/contabilidad/actions-cuentas-bancarias'

/** @description Esquema de validación para crear ajuste bancario */
const ajusteSchema = z.object({
  cuentaId: z.string().min(1, 'Seleccione una cuenta'),
  tipo: z.enum(['ingreso', 'egreso'], {
    required_error: 'Seleccione el tipo de ajuste',
  }),
  monto: z.number({ invalid_type_error: 'Ingrese un monto válido' })
    .positive('El monto debe ser positivo'),
  moneda: z.string().min(1, 'Seleccione una moneda'),
  descripcion: z.string().min(1, 'La descripción es obligatoria'),
  motivo: z.string().min(1, 'El motivo es obligatorio'),
})

type AjusteFormData = z.infer<typeof ajusteSchema>

interface Ajuste {
  ajusteId: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  moneda: string
  descripcion: string
  motivo: string
  realizadoPor: string
  createdAt: string
  cuentaBancaria: {
    nombreBanco: string
    numeroCuenta: string
    moneda: string
  }
}

interface CuentaOption {
  cuentaId: string
  nombreBanco: string
  numeroCuenta: string
  moneda: string
  saldo: number
}

/**
 * @description Página de ajustes bancarios. Permite crear nuevos ajustes
 * y visualizar el historial de ajustes realizados.
 * @returns {JSX.Element} Página de ajustes bancarios
 */
export function AjustesBancariosPage() {
  const [activeTab, setActiveTab] = useState<'crear' | 'historial'>('crear')
  const [isCreating, setIsCreating] = useState(false)
  const [cuentas, setCuentas] = useState<CuentaOption[]>([])
  const [isLoadingCuentas, setIsLoadingCuentas] = useState(true)
  const [ajustes, setAjustes] = useState<Ajuste[]>([])
  const [isLoadingAjustes, setIsLoadingAjustes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    getCuentasBancariasAction().then((r: any) => {
      if (r.success) {
        setCuentas(r.data?.cuentas ?? [])
      }
      setIsLoadingCuentas(false)
    })
  }, [])

  const fetchAjustes = async () => {
    setIsLoadingAjustes(true)
    try {
      const response = await fetch('/api/contabilidad/ajustes/all')
      if (!response.ok) throw new Error('Error al cargar ajustes')
      const json = await response.json()
      setAjustes(json.ajustes ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoadingAjustes(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'historial') {
      fetchAjustes()
    }
  }, [activeTab])

  const form = useForm<AjusteFormData>({
    resolver: zodResolver(ajusteSchema),
    defaultValues: {
      cuentaId: '',
      tipo: 'ingreso',
      monto: 0,
      moneda: 'CUP',
      descripcion: '',
      motivo: '',
    },
  })

  const cuentaId = form.watch('cuentaId')
  const cuentaSeleccionada = cuentas.find((c) => c.cuentaId === cuentaId)

  const resetForm = (): void => {
    form.reset()
  }

  const onSubmit = async (data: AjusteFormData) => {
    try {
      setIsCreating(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch('/api/contabilidad/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al crear el ajuste')
      }

      const result = await response.json()

      setSuccessMessage(
        result.advertenciaSaldoNegativo
          ? 'Ajuste creado. ADVERTENCIA: Saldo negativo en la cuenta.'
          : 'Ajuste bancario creado exitosamente'
      )

      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setIsCreating(false)
    }
  }

  const formatMonto = (monto: number, moneda: string): string => {
    return `${monto.toLocaleString('es-CU', { minimumFractionDigits: 2 })} ${moneda}`
  }

  return (
    <div className="space-y-6 p-6">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'crear' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('crear')}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuevo Ajuste
        </Button>
        <Button
          variant={activeTab === 'historial' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('historial')}
          className="gap-2"
        >
          <List className="h-4 w-4" />
          Historial
        </Button>
      </div>

      {activeTab === 'crear' && (
        <div className="space-y-6">
          {successMessage && (
            <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-800 dark:text-emerald-300">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {isLoadingCuentas ? (
            <div className="flex items-center justify-center p-12" role="status" aria-label="Cargando cuentas">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card className="border-0 shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  Crear Ajuste Bancario
                </CardTitle>
                <CardDescription>
                  Registre un ingreso o egreso para corregir el saldo de una cuenta bancaria.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Cuenta */}
                      <FormField
                        control={form.control}
                        name="cuentaId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cuenta Bancaria</FormLabel>
                            <Select value={field.value} onValueChange={(value) => {
                              field.onChange(value)
                              const cuenta = cuentas.find((c) => c.cuentaId === value)
                              if (cuenta) {
                                form.setValue('moneda', cuenta.moneda)
                              }
                            }}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccione cuenta" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {cuentas.map((cuenta) => (
                                  <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                                    {cuenta.nombreBanco} - {cuenta.numeroCuenta} ({cuenta.moneda})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {cuentaSeleccionada && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <Building2 className="inline h-3 w-3 mr-1" />
                                Saldo: {Number(cuentaSeleccionada.saldo).toLocaleString('es-CU', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Tipo */}
                      <FormField
                        control={form.control}
                        name="tipo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Ajuste</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccione tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ingreso">
                                  <span className="flex items-center gap-2">
                                    <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                                    Ingreso
                                  </span>
                                </SelectItem>
                                <SelectItem value="egreso">
                                  <span className="flex items-center gap-2">
                                    <ArrowDownCircle className="h-4 w-4 text-red-500" />
                                    Egreso
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Monto */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="monto"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monto</FormLabel>
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

                      {/* Moneda */}
                      <FormField
                        control={form.control}
                        name="moneda"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Moneda</FormLabel>
                            <FormControl>
                              <Input {...field} disabled />
                            </FormControl>
                            <p className="text-xs text-muted-foreground mt-1">
                              Moneda de la cuenta seleccionada
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Motivo */}
                    <FormField
                      control={form.control}
                      name="motivo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Motivo</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Corrección de saldo inicial, Ajuste por diferencia" {...field} />
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
                          <FormLabel>Descripción</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Detalle del ajuste bancario"
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button type="button" variant="outline" onClick={resetForm} disabled={isCreating}>
                        Limpiar
                      </Button>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          <>
                            <SlidersHorizontal className="mr-2 h-4 w-4" />
                            Crear Ajuste
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'historial' && (
        <div className="space-y-4">
          {isLoadingAjustes ? (
            <div className="flex items-center justify-center p-12" role="status" aria-label="Cargando ajustes">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : ajustes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <SlidersHorizontal className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Sin ajustes registrados</h3>
              <p className="text-sm text-muted-foreground">
                No hay ajustes bancarios en el historial.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {ajustes.map((ajuste) => (
                <div
                  key={ajuste.ajusteId}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="mt-0.5">
                    {ajuste.tipo === 'ingreso' ? (
                      <ArrowUpCircle className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={ajuste.tipo === 'ingreso' ? 'default' : 'destructive'}>
                        {ajuste.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                      </Badge>
                      <span className="font-medium">
                        {formatMonto(ajuste.monto, ajuste.moneda)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{ajuste.descripcion}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {ajuste.cuentaBancaria.nombreBanco} - {ajuste.cuentaBancaria.numeroCuenta}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(ajuste.createdAt).toLocaleString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ajuste.realizadoPor.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
