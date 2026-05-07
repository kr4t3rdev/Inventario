"use client"

/**
 * @description Componente de acciones de pago para deudas priorizadas
 * Integra el dashboard de inteligencia cambiaria con el módulo de tesorería
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  DollarSign,
  Calendar,
  Bell,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info
} from "lucide-react"
import { toast } from "sonner"
import type { DeudaPriorizada } from "@/types/exchange-intelligence"
import { useRegistrarPagoCapitalMutation, useGetCuentasBancariasQuery } from "@/features/contabilidad/api/contabilidadApi"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ============================================================================
// INTERFACES
// ============================================================================

interface DebtPaymentActionsProps {
  deuda: DeudaPriorizada
  on_payment_success?: () => void
  on_reminder_created?: () => void
}

interface PaymentFormData {
  monto_pagado: number
  cuenta_id: string
  comprobante: string
  observaciones: string
}

interface ReminderFormData {
  fecha_recordatorio: string
  mensaje: string
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

/**
 * @description Componente que proporciona acciones de integración con tesorería
 * @param deuda - Deuda priorizada del análisis de envejecimiento
 * @param on_payment_success - Callback cuando el pago se registra exitosamente
 * @param on_reminder_created - Callback cuando se crea un recordatorio
 * @returns Componente con botones de acción y diálogos
 */
export function Debt_payment_actions({
  deuda,
  on_payment_success,
  on_reminder_created
}: DebtPaymentActionsProps) {
  const router = useRouter()
  const [registrar_pago, { isLoading: is_paying }] = useRegistrarPagoCapitalMutation()
  const { data: cuentas_data } = useGetCuentasBancariasQuery()
  
  // Estados de diálogos
  const [show_payment_dialog, set_show_payment_dialog] = useState(false)
  const [show_reminder_dialog, set_show_reminder_dialog] = useState(false)
  const [show_details_dialog, set_show_details_dialog] = useState(false)
  
  // Estados de formularios
  const [payment_form, set_payment_form] = useState<PaymentFormData>({
    monto_pagado: deuda.monto,
    cuenta_id: "",
    comprobante: "",
    observaciones: ""
  })
  
  const [reminder_form, set_reminder_form] = useState<ReminderFormData>({
    fecha_recordatorio: "",
    mensaje: ""
  })

  const [is_creating_reminder, set_is_creating_reminder] = useState(false)

  const cuentas = cuentas_data?.cuentas || []

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /**
   * @description Maneja el inicio del proceso de pago
   */
  const handle_initiate_payment = () => {
    // Pre-llenar el formulario con datos recomendados
    const observaciones_recomendadas = generate_payment_recommendations()
    
    set_payment_form({
      monto_pagado: deuda.monto,
      cuenta_id: "",
      comprobante: "",
      observaciones: observaciones_recomendadas
    })
    
    set_show_payment_dialog(true)
  }

  /**
   * @description Genera recomendaciones para el pago
   */
  const generate_payment_recommendations = (): string => {
    const recomendaciones: string[] = []

    if (deuda.prioridad > 0.8) {
      recomendaciones.push('⚠️ PRIORIDAD CRÍTICA: Se recomienda pago inmediato.')
    } else if (deuda.prioridad > 0.6) {
      recomendaciones.push('⚡ PRIORIDAD ALTA: Considerar pago en los próximos 7 días.')
    }

    if (deuda.tendencia_moneda === 'alcista') {
      const tendencia_pct = deuda.tendencia_porcentaje.toFixed(2)
      recomendaciones.push(
        `📈 Moneda en tendencia alcista (+${tendencia_pct}% últimos 30 días). Pagar pronto minimiza pérdidas.`
      )
    }

    if (deuda.impacto_30_dias > 0) {
      const impacto = deuda.impacto_30_dias.toLocaleString()
      recomendaciones.push(
        `💰 Impacto proyectado en 30 días: ${impacto} ${deuda.moneda}. Pagar hoy evita este costo adicional.`
      )
    }

    if (deuda.antiguedad_dias > 180) {
      recomendaciones.push(
        `⏰ Deuda con ${deuda.antiguedad_dias} días de antigüedad. Considerar liquidación.`
      )
    }

    return recomendaciones.join('\n\n')
  }

  /**
   * @description Maneja el registro del pago
   */
  const handle_submit_payment = async () => {
    if (!payment_form.cuenta_id) {
      toast.error('Seleccione una cuenta bancaria')
      return
    }

    if (payment_form.monto_pagado <= 0) {
      toast.error('El monto debe ser mayor a cero')
      return
    }

    if (payment_form.monto_pagado > deuda.monto) {
      toast.error('El monto no puede ser mayor al saldo pendiente')
      return
    }

    try {
      await registrar_pago({
        id: deuda.deuda_id,
        montoPagado: payment_form.monto_pagado,
        cuentaId: payment_form.cuenta_id,
        comprobante: payment_form.comprobante || undefined,
        observaciones: payment_form.observaciones || undefined
      }).unwrap()

      toast.success('Pago registrado exitosamente', {
        description: `Se registró un pago de ${payment_form.monto_pagado.toLocaleString()} ${deuda.moneda}`
      })

      set_show_payment_dialog(false)
      on_payment_success?.()

      // Registrar en auditoría (se hace automáticamente en el servicio)
      console.log('[AUDIT] Pago registrado desde Exchange Intelligence Dashboard', {
        deuda_id: deuda.deuda_id,
        monto: payment_form.monto_pagado,
        timestamp: new Date().toISOString()
      })
    } catch (error: any) {
      console.error('Error al registrar pago:', error)
      toast.error('Error al registrar el pago', {
        description: error.data?.error || 'Ocurrió un error inesperado'
      })
    }
  }

  /**
   * @description Navega al módulo de capital con datos pre-llenados
   */
  const handle_navigate_to_treasury = () => {
    const params = new URLSearchParams({
      action: 'pagar',
      deuda_id: deuda.deuda_id,
      source: 'exchange-intelligence'
    })

    router.push(`/busy/contabilidad/capital?${params.toString()}`)
  }

  /**
   * @description Maneja la creación de un recordatorio
   */
  const handle_create_reminder = async () => {
    if (!reminder_form.fecha_recordatorio) {
      toast.error('Seleccione una fecha para el recordatorio')
      return
    }

    const fecha_seleccionada = new Date(reminder_form.fecha_recordatorio)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    if (fecha_seleccionada < hoy) {
      toast.error('La fecha del recordatorio debe ser futura')
      return
    }

    set_is_creating_reminder(true)

    try {
      // Crear notificación como recordatorio
      const mensaje = reminder_form.mensaje || 
        `Recordatorio: Pago pendiente a ${deuda.entidad} - ` +
        `Saldo: ${deuda.monto.toLocaleString()} ${deuda.moneda}`

      // TODO: Implementar API endpoint para crear recordatorios
      // Por ahora, simular creación exitosa
      await new Promise(resolve => setTimeout(resolve, 500))

      toast.success('Recordatorio creado', {
        description: `Se creará un recordatorio para el ${fecha_seleccionada.toLocaleDateString()}`
      })

      set_show_reminder_dialog(false)
      set_reminder_form({
        fecha_recordatorio: "",
        mensaje: ""
      })
      on_reminder_created?.()

      console.log('[AUDIT] Recordatorio creado desde Exchange Intelligence Dashboard', {
        deuda_id: deuda.deuda_id,
        fecha: reminder_form.fecha_recordatorio,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error al crear recordatorio:', error)
      toast.error('Error al crear el recordatorio')
    } finally {
      set_is_creating_reminder(false)
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex items-center gap-2">
      {/* Botón principal: Iniciar Pago */}
      <Button
        size="sm"
        onClick={handle_initiate_payment}
        disabled={is_paying}
        className="gap-2"
      >
        {is_paying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <DollarSign className="h-4 w-4" />
        )}
        Iniciar Pago
      </Button>

      {/* Botón: Ver Detalles */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => set_show_details_dialog(true)}
        className="gap-2"
      >
        <Info className="h-4 w-4" />
        Detalles
      </Button>

      {/* Botón: Crear Recordatorio */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => set_show_reminder_dialog(true)}
        className="gap-2"
      >
        <Bell className="h-4 w-4" />
      </Button>

      {/* Botón: Ir a Módulo de Capital */}
      <Button
        size="sm"
        variant="ghost"
        onClick={handle_navigate_to_treasury}
        className="gap-2"
      >
        <ExternalLink className="h-4 w-4" />
      </Button>

      {/* Diálogo: Formulario de Pago */}
      <Dialog open={show_payment_dialog} onOpenChange={set_show_payment_dialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Registrar Pago de Deuda</DialogTitle>
            <DialogDescription>
              {deuda.entidad} - Saldo pendiente: {deuda.monto.toLocaleString()} {deuda.moneda}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Indicadores de prioridad */}
            <div className="flex items-center gap-2">
              <Badge variant={
                deuda.prioridad > 0.8 ? "destructive" :
                deuda.prioridad > 0.6 ? "default" : "secondary"
              }>
                Prioridad: {(deuda.prioridad * 100).toFixed(0)}%
              </Badge>
              
              {deuda.tendencia_moneda === 'alcista' && (
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Tendencia Alcista
                </Badge>
              )}
            </div>

            {/* Monto a pagar */}
            <div className="space-y-2">
              <Label htmlFor="monto">Monto a Pagar</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0"
                max={deuda.monto}
                value={payment_form.monto_pagado}
                onChange={(e) => set_payment_form({
                  ...payment_form,
                  monto_pagado: parseFloat(e.target.value) || 0
                })}
                disabled={is_paying}
              />
              <p className="text-sm text-muted-foreground">
                Máximo: {deuda.monto.toLocaleString()} {deuda.moneda}
              </p>
            </div>

            {/* Cuenta bancaria */}
            <div className="space-y-2">
              <Label htmlFor="cuenta">Cuenta Bancaria (Origen)</Label>
              <Select
                value={payment_form.cuenta_id}
                onValueChange={(value) => set_payment_form({
                  ...payment_form,
                  cuenta_id: value
                })}
                disabled={is_paying}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {cuentas.map((cuenta) => (
                    <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                      {cuenta.nombreBanco} ({cuenta.moneda}) - Saldo: {cuenta.saldo.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Comprobante */}
            <div className="space-y-2">
              <Label htmlFor="comprobante">Nº Comprobante (Opcional)</Label>
              <Input
                id="comprobante"
                value={payment_form.comprobante}
                onChange={(e) => set_payment_form({
                  ...payment_form,
                  comprobante: e.target.value
                })}
                disabled={is_paying}
                placeholder="Ej: COMP-2024-001"
              />
            </div>

            {/* Observaciones con recomendaciones */}
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones y Recomendaciones</Label>
              <Textarea
                id="observaciones"
                value={payment_form.observaciones}
                onChange={(e) => set_payment_form({
                  ...payment_form,
                  observaciones: e.target.value
                })}
                disabled={is_paying}
                rows={6}
                className="font-mono text-sm"
              />
            </div>

            {/* Impacto proyectado */}
            {deuda.impacto_30_dias > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Impacto Proyectado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Si no se paga en los próximos 30 días, el impacto adicional estimado es de{' '}
                    <span className="font-semibold text-amber-700">
                      {deuda.impacto_30_dias.toLocaleString()} {deuda.moneda}
                    </span>
                    {' '}({deuda.impacto_porcentual.toFixed(2)}%)
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => set_show_payment_dialog(false)}
              disabled={is_paying}
            >
              Cancelar
            </Button>
            <Button
              onClick={handle_submit_payment}
              disabled={is_paying || !payment_form.cuenta_id}
            >
              {is_paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Crear Recordatorio */}
      <Dialog open={show_reminder_dialog} onOpenChange={set_show_reminder_dialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Crear Recordatorio de Pago</DialogTitle>
            <DialogDescription>
              Configura un recordatorio para pagar esta deuda
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fecha_recordatorio">Fecha del Recordatorio</Label>
              <Input
                id="fecha_recordatorio"
                type="date"
                value={reminder_form.fecha_recordatorio}
                onChange={(e) => set_reminder_form({
                  ...reminder_form,
                  fecha_recordatorio: e.target.value
                })}
                disabled={is_creating_reminder}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mensaje_recordatorio">Mensaje (Opcional)</Label>
              <Textarea
                id="mensaje_recordatorio"
                value={reminder_form.mensaje}
                onChange={(e) => set_reminder_form({
                  ...reminder_form,
                  mensaje: e.target.value
                })}
                disabled={is_creating_reminder}
                placeholder={`Recordatorio: Pago pendiente a ${deuda.entidad}`}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => set_show_reminder_dialog(false)}
              disabled={is_creating_reminder}
            >
              Cancelar
            </Button>
            <Button
              onClick={handle_create_reminder}
              disabled={is_creating_reminder}
            >
              {is_creating_reminder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Recordatorio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Detalles de la Deuda */}
      <Dialog open={show_details_dialog} onOpenChange={set_show_details_dialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detalles de la Deuda</DialogTitle>
            <DialogDescription>{deuda.entidad}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monto</p>
                <p className="text-lg font-semibold">
                  {deuda.monto.toLocaleString()} {deuda.moneda}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monto Local</p>
                <p className="text-lg font-semibold">
                  {deuda.monto_local.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Antigüedad</p>
                <p className="text-base">{deuda.antiguedad_dias} días</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Prioridad</p>
                <p className="text-base">{(deuda.prioridad * 100).toFixed(0)}%</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Tendencia de Moneda</p>
              <Badge variant={
                deuda.tendencia_moneda === 'alcista' ? "destructive" :
                deuda.tendencia_moneda === 'bajista' ? "default" : "secondary"
              } className="gap-1">
                {deuda.tendencia_moneda === 'alcista' && <TrendingUp className="h-3 w-3" />}
                {deuda.tendencia_moneda.toUpperCase()} ({deuda.tendencia_porcentaje.toFixed(2)}%)
              </Badge>
            </div>

            {deuda.impacto_30_dias > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Impacto en 30 días</p>
                <p className="text-lg font-semibold text-amber-600">
                  +{deuda.impacto_30_dias.toLocaleString()} {deuda.moneda}
                </p>
                <p className="text-sm text-muted-foreground">
                  ({deuda.impacto_porcentual.toFixed(2)}% adicional)
                </p>
              </div>
            )}

            {deuda.fecha_vencimiento && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fecha de Vencimiento</p>
                <p className="text-base">
                  {new Date(deuda.fecha_vencimiento).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => set_show_details_dialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
