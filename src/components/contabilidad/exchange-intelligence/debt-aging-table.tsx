"use client"

/**
 * @description Tabla de envejecimiento de deudas con acciones de integración
 * Muestra deudas priorizadas con botones para iniciar pagos y crear recordatorios
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react"
import type { DeudaPriorizada } from "@/types/exchange-intelligence"
import { Debt_payment_actions as DebtPaymentActions } from "./debt-payment-actions"

// ============================================================================
// INTERFACES
// ============================================================================

interface DebtAgingTableProps {
  deudas: DeudaPriorizada[]
  loading?: boolean
  on_payment_success?: () => void
  on_reminder_created?: () => void
}

// ============================================================================
// COMPONENTE
// ============================================================================

/**
 * @description Tabla de deudas priorizadas con acciones de pago
 * @param deudas - Lista de deudas priorizadas
 * @param loading - Indicador de carga
 * @param on_payment_success - Callback cuando se registra un pago
 * @param on_reminder_created - Callback cuando se crea un recordatorio
 * @returns Tabla con deudas y acciones
 */
export function debt_aging_table({
  deudas,
  loading = false,
  on_payment_success,
  on_reminder_created
}: DebtAgingTableProps) {
  
  /**
   * @description Obtiene el ícono de tendencia según el tipo
   * @param tendencia - Tipo de tendencia
   * @returns Componente de ícono
   */
  const get_tendencia_icon = (tendencia: 'alcista' | 'bajista' | 'estable') => {
    switch (tendencia) {
      case 'alcista':
        return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'bajista':
        return <TrendingDown className="h-4 w-4 text-green-500" />
      case 'estable':
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  /**
   * @description Obtiene el color del badge de prioridad
   * @param prioridad - Valor de prioridad (0-1)
   * @returns Variante del badge
   */
  const get_prioridad_variant = (prioridad: number): "destructive" | "default" | "secondary" => {
    if (prioridad > 0.8) return "destructive"
    if (prioridad > 0.6) return "default"
    return "secondary"
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Envejecimiento de Deuda</CardTitle>
          <CardDescription>Cargando deudas priorizadas...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (deudas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Envejecimiento de Deuda</CardTitle>
          <CardDescription>No hay deudas activas en moneda extranjera</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm">✓ No hay deudas pendientes</p>
            <p className="text-xs mt-2">Todas las deudas están pagadas o no hay deudas registradas</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Contar deudas urgentes (prioridad > 0.8)
  const deudas_urgentes = deudas.filter(d => d.prioridad > 0.8).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Envejecimiento de Deuda</CardTitle>
            <CardDescription>
              {deudas.length} deuda{deudas.length !== 1 ? 's' : ''} activa{deudas.length !== 1 ? 's' : ''} en moneda extranjera
            </CardDescription>
          </div>
          {deudas_urgentes > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {deudas_urgentes} Urgente{deudas_urgentes !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entidad</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Monto Local</TableHead>
                <TableHead className="text-center">Antigüedad</TableHead>
                <TableHead className="text-center">Tendencia</TableHead>
                <TableHead className="text-center">Prioridad</TableHead>
                <TableHead className="text-right">Impacto 30d</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deudas.map((deuda) => (
                <TableRow key={deuda.deuda_id}>
                  {/* Entidad */}
                  <TableCell className="font-medium">
                    {deuda.entidad}
                  </TableCell>

                  {/* Moneda */}
                  <TableCell>
                    <Badge variant="outline">{deuda.moneda}</Badge>
                  </TableCell>

                  {/* Monto */}
                  <TableCell className="text-right font-medium">
                    {deuda.monto.toLocaleString()}
                  </TableCell>

                  {/* Monto Local */}
                  <TableCell className="text-right text-muted-foreground">
                    {deuda.monto_local.toLocaleString()}
                  </TableCell>

                  {/* Antigüedad */}
                  <TableCell className="text-center">
                    <span className={
                      deuda.antiguedad_dias > 180 ? "text-red-600 font-medium" :
                      deuda.antiguedad_dias > 90 ? "text-amber-600" :
                      "text-muted-foreground"
                    }>
                      {deuda.antiguedad_dias} días
                    </span>
                  </TableCell>

                  {/* Tendencia */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {get_tendencia_icon(deuda.tendencia_moneda)}
                      <span className="text-sm">
                        {deuda.tendencia_porcentaje > 0 ? '+' : ''}
                        {deuda.tendencia_porcentaje.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>

                  {/* Prioridad */}
                  <TableCell className="text-center">
                    <Badge variant={get_prioridad_variant(deuda.prioridad)}>
                      {(deuda.prioridad * 100).toFixed(0)}%
                    </Badge>
                  </TableCell>

                  {/* Impacto 30 días */}
                  <TableCell className="text-right">
                    {deuda.impacto_30_dias > 0 ? (
                      <span className="text-amber-600 font-medium">
                        +{deuda.impacto_30_dias.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  {/* Acciones */}
                  <TableCell className="text-right">
                    <DebtPaymentActions
                      deuda={deuda}
                      on_payment_success={on_payment_success}
                      on_reminder_created={on_reminder_created}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Resumen */}
        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Deudas</p>
              <p className="text-lg font-semibold">{deudas.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Deudas Urgentes</p>
              <p className="text-lg font-semibold text-red-600">{deudas_urgentes}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Impacto Total 30d</p>
              <p className="text-lg font-semibold text-amber-600">
                +{deudas.reduce((sum, d) => sum + d.impacto_30_dias, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
