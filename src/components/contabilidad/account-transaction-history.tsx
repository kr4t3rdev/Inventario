"use client"

import { useState, useEffect } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, ArrowUpDown, Calendar, DollarSign, Info, Wallet, CreditCard, FileText, Filter, Download } from "lucide-react"
import { useGetCuentaTransactionHistoryQuery } from "@/lib/redux/services/contabilidadApi"
import { formatCurrency, formatDate, convertCurrency } from "@/lib/redux/utils/contabilidadUtils"
import { useGetMonedasQuery } from "@/lib/redux/services/contabilidadApi"
import { DateRangePicker } from "./date-range-picker"
import { ExportDialog } from "./export-dialog"
import { cn } from "@/lib/utils"
import {
  StaggerContainer,
  StaggerItem,
  AnimatedCard
} from "@/components/ui/animations"

interface AccountTransactionHistoryProps {
  cuentaId: string
  nombreCuenta: string
  numeroCuenta: string
  monedaCuenta: string
}

interface TasaCambio {
  monedaOrigenId: string
  monedaDestino: string
  tasa: number
}

interface ExchangeRatesResponse {
  success: boolean
  data?: {
    monedaPrincipal: {
      codigo: string
    }
    tasas: TasaCambio[]
  }
  error?: string
}

const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-950/50',
)

const typeColors: Record<string, string> = {
  'venta': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200/80',
  'servicio': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200/80',
  'gasto': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200/80',
  'salario': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200/80',
  'transferencia_entrada': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200/80',
  'transferencia_salida': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200/80',
  'ajuste_ingreso': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200/80',
  'ajuste_egreso': 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200/80',
}

export function AccountTransactionHistory({
  cuentaId,
  nombreCuenta,
  numeroCuenta,
  monedaCuenta
}: AccountTransactionHistoryProps) {
  const shouldReduceMotion = useReducedMotion()
  const [filtros, setFiltros] = useState({
    fechaInicio: "",
    fechaFin: "",
    tipoMovimiento: "",
    page: 1,
    limit: 10
  })

  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({})

  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        const token = sessionStorage.getItem('token')
        const response = await fetch('/api/contabilidad/exchange/tasas', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include'
        })

        if (response.ok) {
          const data: ExchangeRatesResponse = await response.json()
          if (data.success && data.data) {
            const rates: { [key: string]: number } = {}
            data.data.tasas.forEach((tasa) => {
              rates[`${tasa.monedaOrigenId}_${tasa.monedaDestino}`] = tasa.tasa
            })
            setExchangeRates(rates)
          }
        }
      } catch (error) {
        console.error('Error fetching exchange rates:', error)
      }
    }

    fetchExchangeRates()
  }, [])

  const { data: historial, isLoading, error } = useGetCuentaTransactionHistoryQuery({
    cuentaId,
    ...filtros
  })
  const { data: monedasData = { data: [] } } = useGetMonedasQuery()
  const monedas = monedasData.data || []
  
  const convertAmount = (amount: number, fromCurrency: string, toCurrency: string): number => {
    if (fromCurrency === toCurrency) {
      return amount
    }
    
    const converted = convertCurrency(amount, fromCurrency, toCurrency, exchangeRates)
    return converted !== null ? converted : amount
  }

  const getConvertedAmount = (transaccion: any): number => {
    if (transaccion.monedaOriginal === monedaCuenta) {
      return transaccion.montoOriginal
    }
    
    if (transaccion.tasaCambio && transaccion.tasaCambio > 0) {
      return transaccion.montoOriginal * transaccion.tasaCambio
    }
    
    return convertAmount(transaccion.montoOriginal, transaccion.monedaOriginal, monedaCuenta)
  }

  const calculateTotals = () => {
    if (!historial?.transacciones) {
      return { totalIngresos: historial?.resumen?.totalIngresos || 0, totalEgresos: historial?.resumen?.totalEgresos || 0 }
    }

    const totals = historial.transacciones.reduce((acc: { totalIngresos: number; totalEgresos: number }, t: any) => {
      const isIncome = t.tipoMovimiento.includes('ingreso') || 
        t.tipoMovimiento === 'venta' || 
        t.tipoMovimiento === 'servicio' || 
        t.tipoMovimiento === 'transferencia_entrada'
      const convertedAmount = getConvertedAmount(t)
      
      if (isIncome) {
        acc.totalIngresos += convertedAmount
      } else {
        acc.totalEgresos += convertedAmount
      }
      
      return acc
    }, { totalIngresos: 0, totalEgresos: 0 })

    return totals
  }

  const totals = calculateTotals()

  const formatCurrencySimple = (amount: number | undefined | null, currency: string) => {
    const safeAmount = amount ?? 0

    if (monedas.length > 0) {
      return formatCurrency(safeAmount, currency, monedas)
    }
    return `${currency} ${safeAmount.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const handleFiltroChange = (key: string, value: string) => {
    setFiltros(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? parseInt(value) : 1
    }))
  }

  const handleDateRangeChange = (fechaInicio: string, fechaFin: string) => {
    setFiltros(prev => ({
      ...prev,
      fechaInicio,
      fechaFin,
      page: 1
    }))
  }

  const handleExport = async (config: { formato: string; fechaInicio?: string; fechaFin?: string; incluirDetalles: boolean; incluirConversiones: boolean }) => {
    const params = new URLSearchParams({
      cuentaId,
      formato: config.formato,
      ...(config.fechaInicio && { fechaInicio: config.fechaInicio }),
      ...(config.fechaFin && { fechaFin: config.fechaFin }),
      incluirDetalles: config.incluirDetalles.toString(),
      incluirConversiones: config.incluirConversiones.toString()
    })

    const token = sessionStorage.getItem('token');
    const response = await fetch(`/api/contabilidad/cuentas/${cuentaId}/historial?${params}`, {
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
    a.download = `historial-${numeroCuenta}-${new Date().toISOString().split('T')[0]}.${config.formato}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const getTipoMovimientoColor = (tipo: string) => {
    return typeColors[tipo] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200/80'
  }

  const getTipoMovimientoIcon = (tipo: string) => {
    switch (tipo) {
      case 'venta':
      case 'servicio':
      case 'ajuste_ingreso':
      case 'transferencia_entrada':
        return <TrendingUp className="h-3.5 w-3.5" />
      case 'gasto':
      case 'salario':
      case 'ajuste_egreso':
      case 'transferencia_salida':
        return <TrendingDown className="h-3.5 w-3.5" />
      default:
        return <ArrowUpDown className="h-3.5 w-3.5" />
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.05,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.25,
        ease: 'easeOut' as const,
      },
    },
  }

  if (error) {
    return (
      <AnimatedCard>
        <Card className={cn(surfaceCardClass, 'border-red-200 dark:border-red-800')}>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
                <Wallet className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-destructive font-medium">Error al cargar el historial de transacciones</p>
              <p className="text-muted-foreground text-sm mt-1">Por favor, intente nuevamente</p>
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>
    )
  }

  return (
    <StaggerContainer className="space-y-4" variants={containerVariants} initial="hidden" animate="show">
      {/* Información de la cuenta */}
      <StaggerItem>
        <AnimatedCard>
          <Card className={surfaceCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  {nombreCuenta}
                </CardTitle>
                {historial?.resumen?.saldoActual && (
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
                    Saldo: {formatCurrencySimple(historial.resumen.saldoActual, monedaCuenta)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Número de cuenta</p>
                    <p className="font-medium">{numeroCuenta}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Moneda</p>
                    <Badge variant="outline" className="font-mono">{monedaCuenta}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo actual</p>
                    <p className="font-medium text-lg text-emerald-600 dark:text-emerald-400">
                      {historial?.resumen?.saldoActual ?
                        formatCurrencySimple(historial.resumen.saldoActual, monedaCuenta):
                        'Cargando...'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
      </StaggerItem>

      {/* Resumen del período */}
      {historial?.resumen && (
        <StaggerItem>
          <AnimatedCard>
            <div className="grid gap-4 md:grid-cols-4">
              <Card className={cn(surfaceCardClass, 'border-l-4 border-l-green-500')}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ingresos</p>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrencySimple(totals.totalIngresos, monedaCuenta)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(surfaceCardClass, 'border-l-4 border-l-red-500')}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-300" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Egresos</p>
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        {formatCurrencySimple(totals.totalEgresos, monedaCuenta)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(surfaceCardClass, 'border-l-4 border-l-blue-500')}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <ArrowUpDown className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Transferencias</p>
                      <p className="font-semibold">
                        {historial.resumen.totalTransferencias}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(surfaceCardClass, 'border-l-4 border-l-purple-500')}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Movimientos</p>
                      <p className="font-semibold">
                        {historial.resumen.totalMovimientos}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </AnimatedCard>
        </StaggerItem>
      )}

      {/* Filtros y historial */}
      <StaggerItem>
        <AnimatedCard>
          <Card className={surfaceCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  Historial de Transacciones
                </CardTitle>
                <ExportDialog
                  tipoReporte="movimientos"
                  cuentaId={cuentaId}
                  onExport={handleExport}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtros */}
              <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50">
                <DateRangePicker
                  fechaInicio={filtros.fechaInicio}
                  fechaFin={filtros.fechaFin}
                  onChange={handleDateRangeChange}
                />

                <Select
                  value={filtros.tipoMovimiento}
                  onValueChange={(value) => handleFiltroChange('tipoMovimiento', value === 'all' ? '' : value)}
                >
                  <SelectTrigger className="w-full sm:w-[200px] bg-white/80 dark:bg-slate-800/50">
                    <SelectValue placeholder="Tipo de movimiento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="venta">Ventas</SelectItem>
                    <SelectItem value="servicio">Servicios</SelectItem>
                    <SelectItem value="gasto">Gastos</SelectItem>
                    <SelectItem value="salario">Salarios</SelectItem>
                    <SelectItem value="transferencia_entrada">Transferencias Entrada</SelectItem>
                    <SelectItem value="transferencia_salida">Transferencias Salida</SelectItem>
                    <SelectItem value="ajuste_ingreso">Ajustes Ingreso</SelectItem>
                    <SelectItem value="ajuste_egreso">Ajustes Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tabla de transacciones */}
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-900/50 hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                      <TableHead className="font-semibold">Fecha</TableHead>
                      <TableHead className="font-semibold">Tipo</TableHead>
                      <TableHead className="font-semibold">Descripción</TableHead>
                      <TableHead className="font-semibold">Moneda</TableHead>
                      <TableHead className="font-semibold">Monto Original</TableHead>
                      <TableHead className="font-semibold">Tasa</TableHead>
                      <TableHead className="text-right font-semibold">Monto {monedaCuenta}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        </TableRow>
                      ))
                    ) : historial?.transacciones?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-muted-foreground">No se encontraron transacciones</p>
                              <p className="text-sm text-muted-foreground">para el período seleccionado</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      historial?.transacciones?.map((transaccion) => (
                        <TableRow key={transaccion.transaccionId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {formatDate(transaccion.fecha)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("border", getTipoMovimientoColor(transaccion.tipoMovimiento))}>
                              <span className="flex items-center gap-1">
                                {getTipoMovimientoIcon(transaccion.tipoMovimiento)}
                                {transaccion.tipoMovimiento}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{transaccion.descripcion}</p>
                              {transaccion.observaciones && (
                                <p className="text-xs text-muted-foreground">
                                  Ref: {transaccion.observaciones}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{transaccion.monedaOriginal}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono">
                              {formatCurrencySimple(transaccion.montoOriginal, transaccion.monedaOriginal)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {String(transaccion.monedaOriginal) !== String(monedaCuenta) ? (
                              <div className="flex items-center gap-1">
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-mono font-semibold",
                              transaccion?.tipoMovimiento?.includes('ingreso') ||
                                transaccion.tipoMovimiento === 'venta' ||
                                transaccion.tipoMovimiento === 'servicio' ||
                                transaccion.tipoMovimiento === 'transferencia_entrada'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            )}>
                              {transaccion?.tipoMovimiento?.includes('ingreso') ||
                                transaccion.tipoMovimiento === 'venta' ||
                                transaccion.tipoMovimiento === 'servicio' ||
                                transaccion.tipoMovimiento === 'transferencia_entrada' ? '+' : '-'}
                              {formatCurrencySimple(Math.abs(getConvertedAmount(transaccion)), monedaCuenta)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {historial?.pagination && (
                <div className="flex items-center justify-between px-2 py-4 border-t border-slate-200/60 dark:border-slate-800">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((historial.pagination.page - 1) * historial.pagination.limit) + 1} a{' '}
                    {Math.min(historial.pagination.page * historial.pagination.limit, historial.pagination.total)} de{' '}
                    {historial.pagination.total} transacciones
                  </p>
                  <div className="flex gap-2">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={historial.pagination.page <= 1}
                        onClick={() => handleFiltroChange('page', String(filtros.page - 1))}
                        className="cursor-pointer"
                      >
                        Anterior
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={historial.pagination.page >= historial.pagination.totalPages}
                        onClick={() => handleFiltroChange('page', String(filtros.page + 1))}
                        className="cursor-pointer"
                      >
                        Siguiente
                      </Button>
                    </motion.div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedCard>
      </StaggerItem>
    </StaggerContainer>
  )
}
