'use client'

import React, { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, DollarSign, TrendingDown, TrendingUp } from 'lucide-react'
import { useCreateAjusteBancarioMutation, useGetCuentasBancariasQuery, useGetMonedasQuery } from '@/lib/redux/services/contabilidadApi'
import { useAppSelector } from '@/lib/redux/hooks'
import { sileo } from '@/lib/sileo-shim'
import { CuentaBancaria, Moneda } from '../../app/models/model'

const ajusteBancarioSchema = z.object({
  cuentaId: z.string().min(1, 'Debe seleccionar una cuenta bancaria'),
  tipo: z.enum(['ingreso', 'egreso'], {
    required_error: 'Debe seleccionar el tipo de ajuste'
  }),
  monto: z.string()
    .min(1, 'El monto es requerido')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, 'El monto debe ser mayor a 0'),
  moneda: z.string().min(1, 'Debe seleccionar una moneda'),
  descripcion: z.string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(500, 'La descripción no puede exceder 500 caracteres'),
  motivo: z.string()
    .min(5, 'El motivo debe tener al menos 5 caracteres')
    .max(200, 'El motivo no puede exceder 200 caracteres')
})

type AjusteBancarioFormData = z.infer<typeof ajusteBancarioSchema>

interface AjusteBancarioFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function AjusteBancarioForm({ onSuccess, onCancel }: AjusteBancarioFormProps) {
    const [showWarning, setShowWarning] = useState(false)
    const [warningMessage, setWarningMessage] = useState('')

  const { data:cuentas = {cuentas:[]} } = useGetCuentasBancariasQuery()
  const cuentasBancarias: CuentaBancaria[] = cuentas.cuentas || []

  const { data:monedasData = {data:[]} } = useGetMonedasQuery()
  const monedas: Moneda[] = monedasData.data || []

  const [createAjuste, { isLoading }] = useCreateAjusteBancarioMutation()
  
  const monedaPrincipal = 'CUP'

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
    reset
  } = useForm<AjusteBancarioFormData>({
    resolver: zodResolver(ajusteBancarioSchema),
    defaultValues: {
      moneda: monedaPrincipal || 'CUP'
    }
  })

  const watchedValues = watch()
  const selectedCuenta = cuentasBancarias.find(c => c.cuentaId === watchedValues.cuentaId)
  const selectedMoneda = monedas.find(m => m.codigo === watchedValues.moneda)

  // Efecto para auto-seleccionar la moneda cuando se cambia la cuenta
  React.useEffect(() => {
    if (selectedCuenta && (!watchedValues.moneda || selectedCuenta.moneda !== watchedValues.moneda)) {
      // Solo cambiar si no hay moneda seleccionada o si no coincide
      reset((prev) => ({
        ...prev,
        moneda: selectedCuenta.moneda
      }))
    }
  }, [selectedCuenta, watchedValues.moneda, reset])

  // Validación en tiempo real: verificar que la moneda coincida con la cuenta
  const validacionMoneda = () => {
    if (!selectedCuenta || !selectedMoneda) return null

    if (selectedCuenta.moneda !== selectedMoneda.codigo) {
      return {
        error: `La moneda ${selectedMoneda.nombre} (${selectedMoneda.simbolo}) no coincide con la moneda de la cuenta bancaria seleccionada (${selectedCuenta.moneda}). Los ajustes deben realizarse en la misma moneda que la cuenta.`,
        cuentaMoneda: selectedCuenta.moneda,
        ajusteMoneda: selectedMoneda.codigo
      }
    }

    return null
  }

  const monedaError = validacionMoneda()

  // Calcular el nuevo saldo después del ajuste
  const calculateNewBalance = () => {
    if (!selectedCuenta || !watchedValues.monto || !watchedValues.tipo) return null

    const monto = Number(watchedValues.monto)
    const currentBalance = Number(selectedCuenta.saldo)

    if (watchedValues.tipo === 'ingreso') {
      return currentBalance + monto
    } else {
      return currentBalance - monto
    }
  }

  const newBalance = calculateNewBalance()

  // Verificar si el ajuste resultará en saldo negativo
  const checkNegativeBalance = () => {
    if (newBalance !== null && newBalance < 0) {
      setWarningMessage(
        `Este ajuste resultará en un saldo negativo de ${newBalance.toFixed(2)} ${selectedCuenta?.moneda}. ¿Está seguro de continuar?`
      )
      setShowWarning(true)
      return true
    }
    return false
  }

  const handleFormSubmit = (data: AjusteBancarioFormData) => {
    // Verificar saldo negativo
    if (checkNegativeBalance()) {
      return
    }

    submitAjuste(data)
  }

  const submitAjuste = async (data: AjusteBancarioFormData) => {
    try {
      const monto = Number(data.monto)

      await createAjuste({
        cuentaId: data.cuentaId,
        tipo: data.tipo,
        monto,
        moneda: data.moneda,
        descripcion: data.descripcion,
        motivo: data.motivo
      }).unwrap()

      sileo.success({ title: 'Ajuste bancario creado exitosamente.' })
      reset()
      setShowWarning(false)
      onSuccess?.()
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } }
      sileo.error({ title: err?.data?.error || 'Error al crear el ajuste bancario.' })
    }
  }



  const confirmWithNegativeBalance = () => {
    setShowWarning(false)
    handleSubmit(submitAjuste)()
  }

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Ajuste Bancario Manual
          </CardTitle>
          <CardDescription>
            Registre ajustes manuales para corregir discrepancias o movimientos externos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(handleFormSubmit)} noValidate className="space-y-6">
            {/* Selección de cuenta bancaria */}
            <div className="space-y-2">
              <Label htmlFor="cuentaId">Cuenta Bancaria *</Label>
              <Controller
                name="cuentaId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una cuenta bancaria" />
                    </SelectTrigger>
                    <SelectContent>
                      {cuentasBancarias
                        .filter(cuenta => cuenta.isActive)
                        .map((cuenta) => (
                          <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                            {cuenta.nombreBanco} - {cuenta.numeroCuenta}
                            (Saldo: {Number(cuenta.saldo).toFixed(2)} {cuenta.moneda})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <input type="hidden" {...register('cuentaId')} />
              {errors.cuentaId && (
                <p className="text-sm text-red-600">{errors.cuentaId.message}</p>
              )}
            </div>

            {/* Tipo de ajuste */}
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Ajuste *</Label>
              <Controller
                name="tipo"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione el tipo de ajuste" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingreso">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          Ingreso (Aumentar saldo)
                        </div>
                      </SelectItem>
                      <SelectItem value="egreso">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          Egreso (Disminuir saldo)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <input type="hidden" {...register('tipo')} />
              {errors.tipo && (
                <p className="text-sm text-red-600">{errors.tipo.message}</p>
              )}
            </div>

            {/* Monto y moneda */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monto">Monto *</Label>
                <Input
                  id="monto"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...register('monto')}
                />
                {errors.monto && (
                  <p className="text-sm text-red-600">{errors.monto.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="moneda">Moneda *</Label>
                <Controller
                  name="moneda"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || ''}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione moneda" />
                      </SelectTrigger>
                      <SelectContent>
                        {monedas
                          .filter(moneda => moneda.isActive)
                          .map((moneda) => (
                            <SelectItem key={moneda.codigo} value={moneda.codigo}>
                              {moneda.codigo} - {moneda.nombre}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <input type="hidden" {...register('moneda')} />
                {errors.moneda && (
                  <p className="text-sm text-red-600">{errors.moneda.message}</p>
                )}
                {monedaError && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      {monedaError.error}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>


            {/* Mostrar nuevo saldo calculado */}
            {selectedCuenta && newBalance !== null && (
              <Alert className={newBalance < 0 ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}>
                <AlertDescription>
                  <div className="flex gap-3 items-center justify-between">
                    <span>Saldo actual: {Number(selectedCuenta.saldo).toFixed(2)} {selectedCuenta.moneda}</span>

                    <span className={newBalance < 0 ? 'text-red-600 font-semibold' : 'text-blue-600 font-semibold'}>
                      Nuevo saldo: {newBalance.toFixed(2)} {selectedCuenta.moneda}
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción *</Label>
              <Textarea
                id="descripcion"
                placeholder="Describa detalladamente el ajuste realizado..."
                className="min-h-[80px]"
                {...register('descripcion')}
              />
              <p className="text-xs text-gray-500">
                Mínimo 10 caracteres, máximo 500 caracteres
              </p>
              {errors.descripcion && (
                <p className="text-sm text-red-600">{errors.descripcion.message}</p>
              )}
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo *</Label>
              <Input
                id="motivo"
                placeholder="Ej: Corrección por error contable, depósito no registrado..."
                {...register('motivo')}
              />
              <p className="text-xs text-gray-500">
                Mínimo 5 caracteres, máximo 200 caracteres
              </p>
              {errors.motivo && (
                <p className="text-sm text-red-600">{errors.motivo.message}</p>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Procesando...' : 'Crear Ajuste'}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>


      {/* Diálogo de advertencia de saldo negativo */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Advertencia de Saldo Negativo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {warningMessage}
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={confirmWithNegativeBalance}
                  variant="destructive"
                  className="flex-1"
                  disabled={isLoading}
                >
                  Continuar
                </Button>
                <Button
                  onClick={() => setShowWarning(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}