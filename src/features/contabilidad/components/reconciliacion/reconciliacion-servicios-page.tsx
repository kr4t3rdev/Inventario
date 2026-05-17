"use client"

import { useState, useEffect , useRef} from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  CalendarIcon,
  Wrench,
  DollarSign,
  Clock,
  RefreshCw,
  TrendingUp,
  Filter,
} from "lucide-react"
import dynamic from "next/dynamic"

const ServiciosPendientesTable = dynamic(() => import("../servicios-pendientes-table").then(mod => ({default: mod.ServiciosPendientesTable})), {
  loading: () => (
    <div className="h-[300px] w-full flex items-center justify-center bg-muted/30 rounded-xl border-2 border-dashed">
      <div className="flex flex-col items-center gap-3">
        <motion.div
          className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <span className="text-muted-foreground">Cargando Servicios...</span>
      </div>
    </div>
  )
})
const ReconciliacionServiciosForm = dynamic(() => import('./reconciliacion-servicios-form').then(mod => ({default:mod.ReconciliacionServiciosForm}) ))
const ResumenReconciliacion = dynamic(() => import('./resumen-reconciliacion').then(mod => ({default:mod.ResumenReconciliacion})))

import { VentaServicio } from "@/app/models/model"
import {
  getServiciosPendientesAction,
  getHistorialReconciliacionServiciosAction,
} from "@/features/contabilidad/actions-reconciliacion"
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

export function ReconciliacionServiciosPage() {
  const shouldReduceMotion = useReducedMotion()
  const [selectedServicio, setSelectedServicio] = useState<string>("")
  const [showReconciliacionForm, setShowReconciliacionForm] = useState(false)
  const [servicioToReconcile, setServicioToReconcile] = useState<VentaServicio | null>(null)
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [serviciosPendientesData, setServiciosPendientesData] = useState<any>(null)
  const loadingServicios = useRef(false)

  const refetchServicios = () => {
    loadingServicios.current = true;
    getServiciosPendientesAction({
      fechaDesde: fechaInicio || undefined,
      fechaHasta: fechaFin || undefined,
      page: currentPage,
      limit: pageSize,
    }).then((r) => {
      if (r.success) setServiciosPendientesData(r.data)
      loadingServicios.current = false)
    })
  }

  useEffect(() => {
    refetchServicios()
  }, [fechaInicio, fechaFin, currentPage, pageSize])


  const { ventaServicios, pagination: originalPagination } = serviciosPendientesData || { ventaServicios: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }
  const allServicios: VentaServicio[] = ventaServicios || []

  const serviciosList: VentaServicio[] = allServicios.filter(servicio => {
    if (!servicio.reconciliaciones || servicio.reconciliaciones.length === 0) {
      return true
    }
    const totalReconciliado = servicio.reconciliaciones.reduce((sum, rec) => sum + (rec.montoConvertido || 0), 0)
    return totalReconciliado < (servicio.total || 0)
  })

  const pagination = {
    ...originalPagination,
    total: serviciosList.length,
    totalPages: Math.ceil(serviciosList.length / pageSize)
  }

  const [historialReconciliacionData, setHistorialReconciliacionData] = useState<any[]>([])
  const loadingHistorial = useRef(false)

  useEffect(() => {
    loadingHistorial.current = true)
    getHistorialReconciliacionServiciosAction({
      fechaDesde: fechaInicio || undefined,
      fechaHasta: fechaFin || undefined,
    }).then((r) => {
      if (r.success) setHistorialReconciliacionData(r.data?.reconciliaciones ?? [])
      loadingHistorial.current = false)
    })
  }, [fechaInicio, fechaFin])

  const historialReconciliacion = Array.isArray(historialReconciliacionData) ? (historialReconciliacionData) : []

  const formatCurrency = (amount: number | string, currency: string = "CUP") => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    const symbol = MONEDA_SIMBOLOS[currency] || currency
    return `${symbol} ${numAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const handleReconciliar = (servicio: VentaServicio) => {
    setServicioToReconcile(servicio)
    setShowReconciliacionForm(true)
  }

  const handleReconciliacionSuccess = () => {
    setSelectedServicio("")
    setShowReconciliacionForm(false)
    setServicioToReconcile(null)
    refetchServicios()
  }

  const handleRefresh = () => {
    refetchServicios()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const pendientes = serviciosList.filter((s) => {
    if (!s.reconciliaciones || s.reconciliaciones.length === 0) return true
    const totalReconciliado = s.reconciliaciones.reduce((sum, rec) => sum + (rec.montoConvertido || 0), 0)
    return totalReconciliado < (s.total || 0)
  })
  const reconciliados = serviciosList.filter((s) => {
    if (!s.reconciliaciones || s.reconciliaciones.length === 0) return false
    const totalReconciliado = s.reconciliaciones.reduce((sum, rec) => sum + (rec.montoConvertido || 0), 0)
    return totalReconciliado >= (s.total || 0)
  })
  const serviciosPendientesCount = pendientes.length
  const serviciosReconciliadosCount = reconciliados.length

  const totalPendiente = pendientes.reduce((sum, s) => sum + Number(s.total || 0), 0)

  const totalReconciliado = historialReconciliacion
    .reduce((sum: number, r: any) => sum + (r.montoConvertido || r.monto), 0)

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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">Reconciliación de Servicios</h1>
                    <p className="text-muted-foreground text-sm">
                      Gestiona la reconciliación de servicios prestados con cuentas bancarias
                    </p>
                  </div>
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button onClick={handleRefresh} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Actualizar
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
      </StaggerItem>

      {/* Filters */}
      <StaggerItem>
        <AnimatedCard>
          <Card className={surfaceCardClass}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="fechaInicio"
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="pl-10 bg-white/80 dark:bg-slate-900/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fechaFin">Fecha Fin</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="fechaFin"
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="pl-10 bg-white/80 dark:bg-slate-900/50"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
      </StaggerItem>

      {/* Summary Cards */}
      <StaggerItem>
        <AnimatedCard>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className={cn(surfaceCardClass, 'border-l-4 border-l-accent')}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Servicios Pendientes</p>
                    <p className="text-2xl font-bold">{serviciosPendientesCount}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Clock className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={cn(surfaceCardClass, 'border-l-4 border-l-chart-2')}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Monto Pendiente</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalPendiente)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <DollarSign className="h-6 w-6 text-green-600 dark:text-green-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </AnimatedCard>
      </StaggerItem>

      {/* Services Table */}
      <StaggerItem>
        <AnimatedCard>
          <ServiciosPendientesTable
            onReconciliar={handleReconciliar}
            selectedServicio={selectedServicio}
            onSelectedServicioChange={setSelectedServicio}
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            servicios={serviciosList}
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </AnimatedCard>
      </StaggerItem>

      {/* Reconciliation Summary */}
      {historialReconciliacion.length > 0 && (
        <StaggerItem>
          <AnimatedCard>
            <ResumenReconciliacion
              tipo="servicios"
              reconciliaciones={historialReconciliacion}
              titulo="Resumen de Reconciliaciones de Servicios"
            />
          </AnimatedCard>
        </StaggerItem>
      )}

      {/* Reconciliation Form Dialog */}
      {showReconciliacionForm && servicioToReconcile && (
        <ReconciliacionServiciosForm
          servicio={servicioToReconcile}
          open={showReconciliacionForm}
          onClose={() => {
            setShowReconciliacionForm(false)
            setServicioToReconcile(null)
          }}
          onSuccess={handleReconciliacionSuccess}
        />
      )}
    </StaggerContainer>
  )
}
