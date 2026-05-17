"use client"

import { useState, useEffect } from "react"
import { LazyMotion, m as motion, useReducedMotion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Filter, Download, ArrowUpDown, TrendingUp, TrendingDown, Wallet, Receipt, FileText, Calendar, Eye } from "lucide-react"
import { getCuentasBancariasAction } from "@/features/contabilidad/actions-cuentas-bancarias"
import { getPrestamoCashHistorialAction } from "@/features/contabilidad/actions-prestamos-cash"
import { getDeudaCashByIdAction } from "@/features/contabilidad/actions-deudas-cash"
import { getMovimientosReportAction } from "@/features/contabilidad/actions"
import { formatCurrencySimple, formatDate } from "@/features/contabilidad/utils/contabilidadUtils"
import { DateRangePicker } from "./date-range-picker"
import { cn } from "@/lib/utils"
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  AnimatedCard
} from "@/components/ui/animations"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface MovimientosTableProps {
  cuentaId?: string
  fechaInicio?: string
  fechaFin?: string
  onExport?: (tipo: 'csv' | 'pdf') => void
}

const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
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
  'prestamo_cash_pago': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200/80',
  'prestamo_cash_desembolso': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200/80',
  'deuda_cash': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200/80',
}

export function MovimientosTable({
  cuentaId: initialCuentaId,
  fechaInicio: initialFechaInicio,
  fechaFin: initialFechaFin,
  onExport,
}: MovimientosTableProps) {
  const shouldReduceMotion = useReducedMotion()
  const [prestamoSheetOpen, setPrestamoSheetOpen] = useState(false)
  const [selectedPrestamoCashId, setSelectedPrestamoCashId] = useState<string | null>(null)
  const [selectedPrestamoLabel, setSelectedPrestamoLabel] = useState('')
  const [deudaSheetOpen, setDeudaSheetOpen] = useState(false)
  const [selectedDeudaCashId, setSelectedDeudaCashId] = useState<string | null>(null)
  const [selectedDeudaLabel, setSelectedDeudaLabel] = useState('')
  const [filtros, setFiltros] = useState({
    busqueda: "",
    cuentaId: initialCuentaId || "all",
    tipoMovimiento: "all",
    fechaInicio: initialFechaInicio || "",
    fechaFin: initialFechaFin || "",
    moneda: "all",
    page: 1,
    limit: 10
  })

  const [movimientos, setMovimientos] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [prestamoHistorial, setPrestamoHistorial] = useState<any>(null)
  const [deudaHistorial, setDeudaHistorial] = useState<any>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    getMovimientosReportAction({
      busqueda: filtros.busqueda || undefined,
      cuentaId: filtros.cuentaId !== 'all' ? filtros.cuentaId : undefined,
      tipoMovimiento: filtros.tipoMovimiento !== 'all' ? filtros.tipoMovimiento : undefined,
      fechaInicio: filtros.fechaInicio || undefined,
      fechaFin: filtros.fechaFin || undefined,
      moneda: filtros.moneda !== 'all' ? filtros.moneda : undefined,
      page: filtros.page,
      limit: filtros.limit
    }).then(r => {
      if (r.success) { setMovimientos(r.data); setIsLoading(false) }
      else { setError(r.error); setIsLoading(false) }
    }).catch(err => { setError(err); setIsLoading(false) })
  }, [
    filtros.busqueda,
    filtros.cuentaId,
    filtros.tipoMovimiento,
    filtros.fechaInicio,
    filtros.fechaFin,
    filtros.moneda,
    filtros.page,
    filtros.limit,
  ])

  useEffect(() => {
    if (selectedPrestamoCashId && prestamoSheetOpen) {
      getPrestamoCashHistorialAction(selectedPrestamoCashId).then(r => {
        if (r.success) setPrestamoHistorial(r.data)
      })
    }
  }, [selectedPrestamoCashId, prestamoSheetOpen])

  useEffect(() => {
    if (selectedDeudaCashId && deudaSheetOpen) {
      getDeudaCashByIdAction(selectedDeudaCashId).then(r => {
        if (r.success) setDeudaHistorial(r.data)
      })
    }
  }, [selectedDeudaCashId, deudaSheetOpen])
  const [cuentas, setCuentas] = useState<any[]>([])

  useEffect(() => {
    getCuentasBancariasAction().then(r => {
      if (r.success) setCuentas(r.data?.cuentas ?? [])
    })
  }, [])
  
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

  const limpiarFiltros = () => {
    setFiltros({
      busqueda: "",
      cuentaId: initialCuentaId || "all",
      tipoMovimiento: "all",
      fechaInicio: initialFechaInicio || "",
      fechaFin: initialFechaFin || "",
      moneda: "all",
      page: 1,
      limit: 10
    })
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
      case 'prestamo_cash_pago':
        return <TrendingUp className="h-3.5 w-3.5" />
      case 'gasto':
      case 'salario':
      case 'ajuste_egreso':
      case 'transferencia_salida':
      case 'prestamo_cash_desembolso':
      case 'deuda_cash':
        return <TrendingDown className="h-3.5 w-3.5" />
      default:
        return <ArrowUpDown className="h-3.5 w-3.5" />
    }
  }

  const getTipoMovimientoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'venta': 'Venta',
      'servicio': 'Servicio',
      'gasto': 'Gasto',
      'salario': 'Salario',
      'transferencia_entrada': 'Transferencia Entrada',
      'transferencia_salida': 'Transferencia Salida',
      'ajuste_ingreso': 'Ajuste Ingreso',
      'ajuste_egreso': 'Ajuste Egreso',
      'prestamo_cash_pago': 'Cobro Préstamo Cash',
      'prestamo_cash_desembolso': 'Desembolso Préstamo Cash',
      'deuda_cash': 'Deuda Cash',
    }
    return labels[tipo] || tipo
  }

  const openPrestamoDetalle = (movimiento: any): void => {
    const esPrestamoCash = movimiento.tipo === 'prestamo_cash_desembolso'
    const prestamoCashId = movimiento?.detalles?.prestamoCashId ?? movimiento.referencia ?? null

    if (!esPrestamoCash || !prestamoCashId) {
      return
    }

    setSelectedPrestamoCashId(prestamoCashId)
    setSelectedPrestamoLabel(movimiento?.detalles?.clientePrestamo || movimiento.descripcion)
    setPrestamoSheetOpen(true)
  }

  const openDeudaDetalle = (movimiento: any): void => {
    const esDeudaCash = movimiento.tipo === 'deuda_cash_desembolso'
    const deudaCashId = movimiento.referencia ?? null

    if (!esDeudaCash || !deudaCashId) {
      return
    }

    setSelectedDeudaCashId(deudaCashId)
    setSelectedDeudaLabel(movimiento.descripcion)
    setDeudaSheetOpen(true)
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
                <Receipt className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-destructive font-medium">Error al cargar los movimientos</p>
              <p className="text-muted-foreground text-sm mt-1">Por favor, intente nuevamente</p>
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>
    )
  }

  return (
    <StaggerContainer className="space-y-4" variants={containerVariants} initial="hidden" animate="show">
      {/* Header Card */}
      <StaggerItem>
        <AnimatedCard>
          <Card className={surfaceCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  Movimientos Bancarios
                </CardTitle>
                <div className="flex items-center gap-2">
                  {movimientos?.pagination && (
                    <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900">
                      {movimientos.pagination.total} registros
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        </AnimatedCard>
      </StaggerItem>

      {/* Filters Card */}
      <StaggerItem>
        <AnimatedCard>
          <Card className={surfaceCardClass}>
            <CardContent className="pt-4">
              <StaggerContainer className="space-y-4" variants={containerVariants}>
                <StaggerItem>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por descripción..."
                        value={filtros.busqueda}
                        onChange={(e) => handleFiltroChange('busqueda', e.target.value)}
                        className="pl-10 bg-white/80 dark:bg-slate-900/50"
                      />
                    </div>

                    <Select
                      value={filtros.cuentaId || 'all'}
                      onValueChange={(value) => handleFiltroChange('cuentaId', value)}
                    >
                      <SelectTrigger className="bg-white/80 dark:bg-slate-900/50">
                        <SelectValue placeholder="Todas las cuentas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las cuentas</SelectItem>
                        {cuentas.map((cuenta: any) => (
                          <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                            {cuenta.nombreBanco} - {cuenta.numeroCuenta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filtros.tipoMovimiento}
                      onValueChange={(value) => handleFiltroChange('tipoMovimiento', value)}
                    >
                      <SelectTrigger className="bg-white/80 dark:bg-slate-900/50">
                        <SelectValue placeholder="Tipo de movimiento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        <SelectItem value="venta">Ventas</SelectItem>
                        <SelectItem value="servicio">Servicios</SelectItem>
                        <SelectItem value="gasto">Gastos</SelectItem>
                        <SelectItem value="salario">Salarios</SelectItem>
                        <SelectItem value="ajuste_ingreso">Ajustes de Ingreso</SelectItem>
                        <SelectItem value="ajuste_egreso">Ajustes de Egreso</SelectItem>
                        <SelectItem value="transferencia_entrada">Transferencias Entrada</SelectItem>
                        <SelectItem value="transferencia_salida">Transferencias Salida</SelectItem>
                        <SelectItem value="prestamo_cash">Préstamos Cash</SelectItem>
                        <SelectItem value="deuda_cash">Deudas Cash</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={filtros.moneda}
                      onValueChange={(value) => handleFiltroChange('moneda', value)}
                    >
                      <SelectTrigger className="bg-white/80 dark:bg-slate-900/50">
                        <SelectValue placeholder="Moneda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las monedas</SelectItem>
                        <SelectItem value="CUP">CUP</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </StaggerItem>

                <StaggerItem>
                  <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <DateRangePicker
                      fechaInicio={filtros.fechaInicio}
                      fechaFin={filtros.fechaFin}
                      onChange={handleDateRangeChange}
                    />

                    <div className="flex gap-2">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button variant="outline" onClick={limpiarFiltros} className="gap-2">
                          <Filter className="h-4 w-4" />
                          Limpiar
                        </Button>
                      </motion.div>
                      {onExport && (
                        <>
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button variant="outline" onClick={() => onExport('csv')} className="gap-2">
                              <Download className="h-4 w-4" />
                              CSV
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button variant="outline" onClick={() => onExport('pdf')} className="gap-2">
                              <Download className="h-4 w-4" />
                              PDF
                            </Button>
                          </motion.div>
                        </>
                      )}
                    </div>
                  </div>
                </StaggerItem>
              </StaggerContainer>
            </CardContent>
          </Card>
        </AnimatedCard>
      </StaggerItem>

      {/* Table Card */}
      <StaggerItem>
        <AnimatedCard>
          <Card className={surfaceCardClass}>
            <CardContent className="p-0">
              {/* Tabla */}
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-900/50 hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                      <TableHead className="font-semibold">Fecha</TableHead>
                      <TableHead className="font-semibold">Cuenta</TableHead>
                      <TableHead className="font-semibold">Tipo</TableHead>
                      <TableHead className="font-semibold">Descripción</TableHead>
                      <TableHead className="font-semibold">Referencia</TableHead>
                      <TableHead className="font-semibold">Moneda</TableHead>
                      <TableHead className="font-semibold">Monto Original</TableHead>
                      <TableHead className="font-semibold">Tasa</TableHead>
                      <TableHead className="text-right font-semibold">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        </TableRow>
                      ))
                    ) : movimientos?.data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-muted-foreground">No se encontraron movimientos</p>
                              <p className="text-sm text-muted-foreground">Intente ajustar los filtros de búsqueda</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      movimientos?.data?.map((movimiento: any, index: number) => (
                        <TableRow 
                          key={movimiento.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {formatDate(movimiento.fecha)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{movimiento.cuenta}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("border", getTipoMovimientoColor(movimiento.tipo))}>
                              <span className="flex items-center gap-1">
                                {getTipoMovimientoIcon(movimiento.tipo)}
                                {getTipoMovimientoLabel(movimiento.tipo)}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{movimiento.descripcion}</p>
                              {movimiento.referencia && (
                                <p className="text-xs text-muted-foreground">
                                  Ref: {movimiento.referencia}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {movimiento.tipo === 'prestamo_cash_desembolso' ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-900/20 dark:text-violet-300"
                                onClick={() => openPrestamoDetalle(movimiento)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Ver préstamo
                                </Button>
                              ) : movimiento.tipo === 'deuda_cash_desembolso' ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
                                onClick={() => openDeudaDetalle(movimiento)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Ver deuda
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{movimiento.moneda}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono">
                              {formatCurrencySimple(movimiento.monto ?? 0, movimiento.moneda)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">
                              {movimiento.tasaCambio || '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                              <span className={cn(
                                "font-mono font-semibold",
                                movimiento.tipo.includes('ingreso') ||
                                  movimiento.tipo === 'venta' ||
                                  movimiento.tipo === 'servicio' ||
                                  movimiento.tipo === 'transferencia_entrada' ||
                                  movimiento.tipo === 'prestamo_cash_pago'
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              )}>
                              {formatCurrencySimple(movimiento.montoConvertido ?? 0, movimiento.moneda)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {movimientos?.pagination && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200/60 dark:border-slate-800">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((movimientos.pagination.page - 1) * movimientos.pagination.limit) + 1} a{' '}
                    {Math.min(movimientos.pagination.page * movimientos.pagination.limit, movimientos.pagination.total)} de{' '}
                    {movimientos.pagination.total} movimientos
                  </p>
                  <div className="flex gap-2">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={movimientos.pagination.page <= 1}
                        onClick={() => handleFiltroChange('page', String(movimientos.pagination.page - 1))}
                      >
                        Anterior
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={movimientos.pagination.page >= movimientos.pagination.totalPages}
                        onClick={() => handleFiltroChange('page', String(movimientos.pagination.page + 1))}
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

      <Sheet open={prestamoSheetOpen} onOpenChange={setPrestamoSheetOpen}>
        <SheetContent side="right" className="w-[420px] sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Detalle de préstamo cash</SheetTitle>
            <SheetDescription>
              {selectedPrestamoLabel
                ? `Historial completo de ${selectedPrestamoLabel}`
                : 'Historial completo del préstamo seleccionado.'}
            </SheetDescription>
          </SheetHeader>
          {prestamoHistorial ? (
            <div className="space-y-4 p-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Saldo pendiente</p>
                <p className="text-xl font-semibold">
                  {formatCurrencySimple(prestamoHistorial.resumen.saldoPendiente, prestamoHistorial.prestamo.moneda)}
                </p>
              </div>
              <div className="space-y-2">
                {prestamoHistorial.historial.length > 0 ? (
                  prestamoHistorial.historial.map((pago: any) => (
                    <div key={pago.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{formatDate(pago.fecha)}</p>
                      <p>{pago.tipoPago} · {pago.cuentaBancaria}</p>
                      <p>{formatCurrencySimple(pago.monto, pago.moneda)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">El préstamo todavía no registra pagos.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Seleccioná un préstamo para ver el detalle.</div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={deudaSheetOpen} onOpenChange={setDeudaSheetOpen}>
        <SheetContent side="right" className="w-[420px] sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Detalle de deuda cash</SheetTitle>
            <SheetDescription>
              {selectedDeudaLabel
                ? `Historial completo de ${selectedDeudaLabel}`
                : 'Historial completo de la deuda seleccionada.'}
            </SheetDescription>
          </SheetHeader>
          {deudaHistorial ? (
            <div className="space-y-4 p-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Monto capital</p>
                <p className="text-xl font-semibold">
                  {formatCurrencySimple(deudaHistorial.montoCapital, deudaHistorial.moneda)}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Detalle cargado desde la ficha de deuda.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Seleccioná una deuda para ver el detalle.</div>
          )}
        </SheetContent>
      </Sheet>
    </StaggerContainer>
  )
}
