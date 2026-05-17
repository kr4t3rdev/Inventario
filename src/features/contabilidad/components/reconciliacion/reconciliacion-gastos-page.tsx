"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import {
  Receipt,
  Calendar,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  ShoppingCart,
  RefreshCw,
  TrendingUp,
  Filter,
  FileText,
} from "lucide-react"
import { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { GastosPendientesTable } from "../gastos-pendientes-table"
import { ReconciliacionGastosForm } from "./reconciliacion-gastos-form"
import { getGastosPendientesAction } from "@/features/contabilidad/actions-reconciliacion"
import { GastoPendiente } from "@/app/models/model"
import { cn } from "@/lib/utils"
import {
  StaggerContainer,
  StaggerItem,
  AnimatedCard
} from "@/components/ui/animations"

const MONEDA_SIMBOLOS: Record<string, string> = {
  CUP: "CUP",
  USD: "$",
  EUR: "€",
}

const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
)

interface GastoPendienteResponse {
  gastos: GastoPendiente[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export function ReconciliacionGastosPage() {
  const shouldReduceMotion = useReducedMotion()
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [selectedGastos, setSelectedGastos] = useState<string[]>([])
  const [showReconciliacionForm, setShowReconciliacionForm] = useState(false)
  const [gastoToReconcile, setGastoToReconcile] = useState<GastoPendiente | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [response, setResponse] = useState<GastoPendienteResponse>({
    gastos: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
  })
  const [isLoading, setIsLoading] = useState(true)

  const fechaInicio = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined
  const fechaFin = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined

  const loadGastos = async () => {
    setIsLoading(true)

    try {
      const result = await getGastosPendientesAction({
        fechaDesde: fechaInicio,
        fechaHasta: fechaFin,
        soloNoReconciliados: true,
        page: currentPage,
        limit: pageSize,
      })

      if (result.success) {
        const payload = result.data as unknown as GastoPendienteResponse | undefined
        setResponse(payload ?? {
          gastos: [],
          pagination: { page: currentPage, limit: pageSize, total: 0, totalPages: 0 },
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadGastos()
  }, [fechaInicio, fechaFin, currentPage, pageSize])

  const { gastos, pagination } = response

  const totalGastos = gastos?.length || 0
  const totalMonto = gastos?.reduce((sum: number, gasto: GastoPendiente) => sum + (gasto.monto || 0), 0) || 0


  const gastosPorTipo = gastos?.reduce((acc: Record<string, number>, gasto: GastoPendiente) => {
    acc[gasto.tipo] = (acc[gasto.tipo] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const montosPorTipo = gastos?.reduce((acc: Record<string, number>, gasto: GastoPendiente) => {
    acc[gasto.tipo] = (acc[gasto.tipo] || 0) + gasto.monto
    return acc
  }, {} as Record<string, number>)

  const formatCurrency = (amount: number, currency: string = "CUP") => {
    const symbol = MONEDA_SIMBOLOS[currency] || currency
    return `${symbol} ${amount?.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const handleReconciliar = (gastoSeleccionado: GastoPendiente) => {
    setGastoToReconcile(gastoSeleccionado)
    setShowReconciliacionForm(true)
  }

  const handleReconciliacionSuccess = () => {
    setSelectedGastos([])
    setShowReconciliacionForm(false)
    setGastoToReconcile(null)
    loadGastos()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleCloseReconciliacionForm = () => {
    setShowReconciliacionForm(false)
    setGastoToReconcile(null)
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

  return (
    <StaggerContainer className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      {/* Header */}
      <StaggerItem>
        <AnimatedCard>
          <Card className={surfaceCardClass}>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">Reconciliación de Gastos</h1>
                    <p className="text-muted-foreground text-sm">
                       Reconcilie salarios, gastos DE, compras, servicios y costos de servicios vendidos con sus cuentas bancarias
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <DateRangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    className="w-[300px]"
                  />
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => loadGastos()}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </motion.div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
      </StaggerItem>

      {/* Summary Cards */}
      <StaggerItem>
        <AnimatedCard>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className={cn(surfaceCardClass, 'border-l-4 border-l-primary')}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Gastos</p>
                    <p className="text-2xl font-bold">{totalGastos}</p>
                    <p className="text-xs text-muted-foreground">Pendientes de reconciliar</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Receipt className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cn(surfaceCardClass, 'border-l-4 border-l-accent')}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Monto Total</p>
                    <p className="text-2xl font-bold">{formatCurrency((totalMonto ?? 0))}</p>
                    <p className="text-xs text-muted-foreground">En gastos pendientes</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <DollarSign className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cn(surfaceCardClass, 'border-l-4 border-l-chart-2')}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Salarios</p>
                    <p className="text-2xl font-bold">{gastosPorTipo?.salario || 0}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(montosPorTipo?.salario || 0)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Users className="h-6 w-6 text-green-600 dark:text-green-300" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cn(surfaceCardClass, 'border-l-4 border-l-chart-4')}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Otros Gastos</p>
                    <p className="text-2xl font-bold">{(gastosPorTipo?.gastoDE || 0) + (gastosPorTipo?.compra || 0) + (gastosPorTipo?.servicio || 0)}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency((montosPorTipo?.gastoDE || 0) + (montosPorTipo?.compra || 0) + (montosPorTipo?.servicio || 0))}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <TrendingDown className="h-6 w-6 text-orange-600 dark:text-orange-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </AnimatedCard>
      </StaggerItem>

      {/* Breakdown by Type */}
      {(totalGastos ?? 0) > 0 && (
        <StaggerItem>
          <AnimatedCard>
            <Card className={surfaceCardClass}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Filter className="h-5 w-5" />
                  Desglose por Tipo de Gasto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/10 rounded-lg">
                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div>
                        <p className="font-medium">Salarios</p>
                        <p className="text-sm text-muted-foreground">
                          {gastosPorTipo?.salario || 0} empleados
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(montosPorTipo?.salario || 0)}</p>
                      <Badge variant="secondary" className="text-xs">
                        {(totalMonto ?? 0) > 0 ? Math.round(((montosPorTipo?.salario || 0) / (totalMonto ?? 0)) * 100) : 0}%
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                        <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                      </div>
                      <div>
                        <p className="font-medium">Gastos DE</p>
                        <p className="text-sm text-muted-foreground">
                          {gastosPorTipo?.gastoDE || 0} gastos
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(montosPorTipo?.gastoDE || 0)}</p>
                      <Badge variant="secondary" className="text-xs">
                        {(totalMonto ?? 0) > 0 ? Math.round(((montosPorTipo?.gastoDE || 0) / (totalMonto ?? 0)) * 100) : 0}%
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <ShoppingCart className="h-5 w-5 text-green-600 dark:text-green-300" />
                      </div>
                      <div>
                        <p className="font-medium">Compras</p>
                        <p className="text-sm text-muted-foreground">
                          {gastosPorTipo?.compra || 0} compras
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(montosPorTipo?.compra || 0)}</p>
                      <Badge variant="secondary" className="text-xs">
                        {(totalMonto ?? 0) > 0 ? Math.round(((montosPorTipo?.compra || 0) / (totalMonto ?? 0)) * 100) : 0}%
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <FileText className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                      </div>
                      <div>
                        <p className="font-medium">Servicios Recibidos</p>
                        <p className="text-sm text-muted-foreground">
                          {gastosPorTipo?.servicio || 0} servicios
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(montosPorTipo?.servicio || 0)}</p>
                      <Badge variant="secondary" className="text-xs">
                        {(totalMonto ?? 0) > 0 ? Math.round(((montosPorTipo?.servicio || 0) / (totalMonto ?? 0)) * 100) : 0}%
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                        <DollarSign className="h-5 w-5 text-pink-600 dark:text-pink-300" />
                      </div>
                      <div>
                        <p className="font-medium">Costos Serv. Vendidos</p>
                        <p className="text-sm text-muted-foreground">
                          {gastosPorTipo?.venta_servicio || 0} servicios
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(montosPorTipo?.venta_servicio || 0)}</p>
                      <Badge variant="secondary" className="text-xs">
                        {(totalMonto ?? 0) > 0 ? Math.round(((montosPorTipo?.venta_servicio || 0) / (totalMonto ?? 0)) * 100) : 0}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </StaggerItem>
      )}

      {/* Date Range Info */}
      {dateRange?.from && (
        <StaggerItem>
          <AnimatedCard>
            <Card className={surfaceCardClass}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Mostrando gastos desde{" "}
                    <span className="font-medium">
                      {format(dateRange.from, "dd 'de' MMMM, yyyy")}
                    </span>
                    {dateRange.to && (
                      <>
                        {" "}hasta{" "}
                        <span className="font-medium">
                          {format(dateRange.to, "dd 'de' MMMM, yyyy")}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </StaggerItem>
      )}

      {/* Gastos Table */}
      <StaggerItem>
        <AnimatedCard>
          <GastosPendientesTable
            onReconciliar={handleReconciliar}
            selectedGastos={selectedGastos}
            onSelectionChange={setSelectedGastos}
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            gastos={gastos}
          />
        </AnimatedCard>
      </StaggerItem>

      {/* Reconciliation Form */}
      {showReconciliacionForm && gastoToReconcile && (
        <ReconciliacionGastosForm
          gasto={gastoToReconcile}
          open={showReconciliacionForm}
          onClose={handleCloseReconciliacionForm}
          onSuccess={handleReconciliacionSuccess}
        />
      )}
    </StaggerContainer>
  )
}
