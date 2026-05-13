'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart3,
  Building2,
  ArrowRightLeft,
  AlertTriangle,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface ResumenPorMoneda {
  moneda: string
  saldoActual: number
  totalIngresos: number
  totalEgresos: number
  flujoNeto: number
  desglose: {
    ingresos: {
      ventas: number
      servicios: number
      ajustes: number
      inyecciones: Array<{ tipo: string; montoRecibido: number; moneda: string }>
    }
    egresos: {
      gastos: number
      ajustes: number
      pagosDeuda: number
      prestamosCash: number
    }
  }
}

interface Estadisticas {
  totalCuentas: number
  totalReconciliaciones: number
  totalTransferencias: number
  totalAjustes: number
  totalInyecciones: number
  periodo: {
    fechaInicio: string
    fechaFin: string
  }
}

interface ResumenResponse {
  resumenPorMoneda: ResumenPorMoneda[]
  cuentasBancarias: Array<{
    cuentaId: string
    nombreBanco: string
    numeroCuenta: string
    saldo: number
    moneda: string | null
    tipoCuenta: string
  }>
  estadisticas: Estadisticas
}

/**
 * @description Página de reportes y analytics contables.
 * Muestra resumen financiero con indicadores por moneda y estadísticas generales.
 * @returns {JSX.Element} Dashboard de reportes financieros
 */
export function ReportesAnalyticsPage() {
  const [data, setData] = useState<ResumenResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchResumen = async () => {
      try {
        const response = await fetch('/api/contabilidad/reportes/resumen')
        if (!response.ok) throw new Error('Error al cargar el resumen financiero')
        const json = await response.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setIsLoading(false)
      }
    }

    fetchResumen()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6 p-6" role="status" aria-label="Cargando reportes">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Error al cargar reportes</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const { resumenPorMoneda, estadisticas } = data

  return (
    <div className="space-y-6 p-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cuentas</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estadisticas.totalCuentas}</div>
            <p className="text-xs text-muted-foreground">Cuentas bancarias activas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reconciliaciones</CardTitle>
            <BarChart3 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estadisticas.totalReconciliaciones}</div>
            <p className="text-xs text-muted-foreground">Ventas, servicios y gastos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transferencias</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estadisticas.totalTransferencias}</div>
            <p className="text-xs text-muted-foreground">Entre cuentas bancarias</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ajustes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estadisticas.totalAjustes}</div>
            <p className="text-xs text-muted-foreground">Correcciones bancarias</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumen por Moneda */}
      {resumenPorMoneda.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Resumen Financiero por Moneda
            </CardTitle>
            <CardDescription>
              Ingresos, egresos y flujo neto desglosados por tipo de moneda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {resumenPorMoneda.map((resumen) => (
                <div
                  key={resumen.moneda}
                  className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      {resumen.moneda}
                    </Badge>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        resumen.flujoNeto >= 0 ? 'text-emerald-600' : 'text-red-600'
                      )}
                    >
                      {resumen.flujoNeto >= 0 ? (
                        <TrendingUp className="inline h-4 w-4 mr-1" />
                      ) : (
                        <TrendingDown className="inline h-4 w-4 mr-1" />
                      )}
                      Flujo neto:{' '}
                      {formatCurrency(Math.abs(resumen.flujoNeto), resumen.moneda)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Saldo Actual</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(resumen.saldoActual, resumen.moneda)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        <TrendingUp className="inline h-3 w-3 mr-0.5 text-emerald-500" />
                        Ingresos
                      </p>
                      <p className="text-lg font-semibold text-emerald-600">
                        {formatCurrency(resumen.totalIngresos, resumen.moneda)}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span>Ventas: {formatCurrency(resumen.desglose.ingresos.ventas, resumen.moneda)}</span>
                        <span>Servicios: {formatCurrency(resumen.desglose.ingresos.servicios, resumen.moneda)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        <TrendingDown className="inline h-3 w-3 mr-0.5 text-red-500" />
                        Egresos
                      </p>
                      <p className="text-lg font-semibold text-red-600">
                        {formatCurrency(resumen.totalEgresos, resumen.moneda)}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span>Gastos: {formatCurrency(resumen.desglose.egresos.gastos, resumen.moneda)}</span>
                        <span>Ajustes: {formatCurrency(resumen.desglose.egresos.ajustes, resumen.moneda)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {resumenPorMoneda.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <PiggyBank className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Sin datos financieros</h3>
            <p className="text-sm text-muted-foreground">
              No hay movimientos registrados en el per&iacute;odo seleccionado.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
