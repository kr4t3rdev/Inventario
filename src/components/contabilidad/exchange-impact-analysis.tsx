"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown, ArrowUpDown, DollarSign, AlertTriangle, Info } from "lucide-react"
import { useGetExchangeImpactAnalysisQuery } from "@/features/contabilidad/api/contabilidadApi"
import { formatCurrencySimple, formatDate } from "@/lib/redux/utils/contabilidadUtils"
import { DateRangePicker } from "./date-range-picker"
import { ExportDialog } from "./export-dialog"

interface ExchangeImpactAnalysisProps {
  fechaInicio?: string
  fechaFin?: string
}

export function ExchangeImpactAnalysis({ fechaInicio, fechaFin }: ExchangeImpactAnalysisProps) {
  const [filtros, setFiltros] = useState({
    fechaInicio: fechaInicio || "",
    fechaFin: fechaFin || "",
    monedaBase: "CUP",
    tipoAnalisis: "general"
  })

  const { data: analisis, isLoading, error } = useGetExchangeImpactAnalysisQuery(filtros)
  console.log('data:', analisis);

  const handleFiltroChange = (key: string, value: string) => {
    setFiltros(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleDateRangeChange = (fechaInicio: string, fechaFin: string) => {
    setFiltros(prev => ({
      ...prev,
      fechaInicio,
      fechaFin
    }))
  }

  const handleExport = async (config: any) => {
    const params = new URLSearchParams({
      formato: config.formato,
      ...(config.fechaInicio && { fechaInicio: config.fechaInicio }),
      ...(config.fechaFin && { fechaFin: config.fechaFin }),
      monedaBase: filtros.monedaBase,
      tipoAnalisis: filtros.tipoAnalisis,
      incluirDetalles: config.incluirDetalles.toString()
    })

    const token = sessionStorage.getItem('token');
    const response = await fetch(`/api/contabilidad/reportes/exchange-impact?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('Error al exportar')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analisis-exchange-${new Date().toISOString().split('T')[0]}.${config.formato}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const getImpactColor = (impacto: number) => {
    if (impacto > 0) return "text-green-600"
    if (impacto < 0) return "text-red-600"
    return "text-gray-600"
  }

  const getImpactIcon = (impacto: number) => {
    if (impacto > 0) return <TrendingUp className="h-4 w-4" />
    if (impacto < 0) return <TrendingDown className="h-4 w-4" />
    return <ArrowUpDown className="h-4 w-4" />
  }

  const getRiesgoColor = (nivel: string) => {
    switch (nivel) {
      case 'alto': return 'bg-red-100 text-red-800'
      case 'medio': return 'bg-yellow-100 text-yellow-800'
      case 'bajo': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Error al cargar el análisis de impacto del exchange</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Análisis de Impacto del Exchange
            </span>
            <ExportDialog
              tipoReporte="exchange"
              onExport={handleExport}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <DateRangePicker
              fechaInicio={filtros.fechaInicio}
              fechaFin={filtros.fechaFin}
              onChange={handleDateRangeChange}
            />

            <Select
              value={filtros.monedaBase}
              onValueChange={(value) => handleFiltroChange('monedaBase', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Moneda base" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUP">CUP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filtros.tipoAnalisis}
              onValueChange={(value) => handleFiltroChange('tipoAnalisis', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de análisis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Análisis General</SelectItem>
                <SelectItem value="por_cuenta">Por Cuenta</SelectItem>
                <SelectItem value="por_moneda">Por Moneda</SelectItem>
                <SelectItem value="volatilidad">Volatilidad</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : analisis ? (
        <>
          {/* Resumen de impacto */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  {getImpactIcon(analisis.resumen.gananciaPerdidaTotal)}
                  <div>
                    <p className="text-sm text-muted-foreground">Ganancia/Pérdida Total</p>
                    <p className={`text-2xl font-bold ${getImpactColor(analisis.resumen.gananciaPerdidaTotal)}`}>
                      {formatCurrencySimple(analisis.resumen.gananciaPerdidaTotal, filtros.monedaBase)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Convertido</p>
                    <p className="text-2xl font-bold">
                      {formatCurrencySimple(analisis.resumen.totalConvertido, filtros.monedaBase)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Nivel de Riesgo</p>
                    <Badge className={getRiesgoColor(analisis.resumen.nivelRiesgo)}>
                      {analisis.resumen.nivelRiesgo.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Volatilidad Promedio</p>
                    <p className="text-2xl font-bold">
                      {(analisis.resumen.volatilidadPromedio * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Análisis por moneda */}
          {analisis.porMoneda && analisis.porMoneda.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Impacto por Moneda</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analisis.porMoneda.map((moneda) => (
                    <div key={moneda.codigo} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{moneda.codigo}</Badge>
                          <span className="font-medium">{moneda.nombre}</span>
                        </div>
                        <div className={`font-semibold ${getImpactColor(moneda.impactoTotal)}`}>
                          {formatCurrencySimple(moneda.impactoTotal, filtros.monedaBase)}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Volumen Convertido</p>
                          <p className="font-medium">
                            {formatCurrencySimple(moneda.volumenConvertido, moneda.codigo)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tasa Promedio</p>
                          <p className="font-medium">{moneda.tasaPromedio.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Volatilidad</p>
                          <div className="flex items-center gap-2">
                            <Progress value={moneda.volatilidad * 100} className="flex-1" />
                            <span className="text-sm">{(moneda.volatilidad * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>

                      {moneda.transaccionesSignificativas && moneda.transaccionesSignificativas.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-2">Transacciones Significativas</p>
                          <div className="space-y-1">
                            {moneda.transaccionesSignificativas.slice(0, 3).map((tx, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>{formatDate(tx.fecha)}</span>
                                <span className={getImpactColor(tx.impacto)}>
                                  {formatCurrencySimple(tx.impacto, filtros.monedaBase)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Análisis por cuenta */}
          {analisis.porCuenta && analisis.porCuenta.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Impacto por Cuenta Bancaria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Moneda</TableHead>
                        <TableHead>Conversiones</TableHead>
                        <TableHead>Volumen</TableHead>
                        <TableHead className="text-right">Impacto</TableHead>
                        <TableHead>Riesgo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analisis.porCuenta.map((cuenta) => (
                        <TableRow key={cuenta.cuentaId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{cuenta.nombreBanco}</p>
                              <p className="text-xs text-muted-foreground">
                                {cuenta.numeroCuenta}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{cuenta.moneda}</Badge>
                          </TableCell>
                          <TableCell>{cuenta.totalConversiones}</TableCell>
                          <TableCell>
                            {formatCurrencySimple(cuenta.volumenTotal, cuenta.moneda)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${getImpactColor(cuenta.impactoTotal)}`}>
                            {formatCurrencySimple(cuenta.impactoTotal, filtros.monedaBase)}
                          </TableCell>
                          <TableCell>
                            <Badge className={getRiesgoColor(cuenta.nivelRiesgo)}>
                              {cuenta.nivelRiesgo}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recomendaciones */}
          {analisis.recomendaciones && analisis.recomendaciones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Recomendaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analisis.recomendaciones.map((recomendacion, idx) => (
                    <div key={idx} className="flex gap-3 p-3 border rounded-lg">
                      <div className={`p-1 rounded-full ${recomendacion.prioridad === 'alta' ? 'bg-red-100' :
                          recomendacion.prioridad === 'media' ? 'bg-yellow-100' : 'bg-blue-100'
                        }`}>
                        <AlertTriangle className={`h-4 w-4 ${recomendacion.prioridad === 'alta' ? 'text-red-600' :
                            recomendacion.prioridad === 'media' ? 'text-yellow-600' : 'text-blue-600'
                          }`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{recomendacion.titulo}</p>
                        <p className="text-sm text-muted-foreground">{recomendacion.descripcion}</p>
                        {recomendacion.impactoEstimado && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Impacto estimado: {formatCurrencySimple(recomendacion.impactoEstimado, filtros.monedaBase)}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="self-start">
                        {recomendacion.prioridad}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No hay datos disponibles para el período seleccionado
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}