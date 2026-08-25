"use client"

import { useState, useMemo, useEffect } from "react"
import { LazyMotion, m as motion, useReducedMotion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  CalendarIcon,
  ShoppingCart,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  DollarSign,
  HandCoins,
  TrendingUp,
  FileText,
} from "lucide-react"
import { VentasPendientesTable } from "../ventas-pendientes-table"
import { ReconciliacionVentasForm } from "./reconciliacion-ventas-form"
import { ResumenReconciliacion } from "./resumen-reconciliacion"
import { getVentasPendientesAction, getHistorialReconciliacionVentasAction } from "@/features/contabilidad/actions-reconciliacion"
import { createCuentaPorCobrarAction, getCuentasPorCobrarAction } from "@/features/contabilidad"
import type { VentaPendiente, ReconciliacionVenta } from "@/app/models/model"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import { buildCreateCuentaPorCobrarInputFromVenta } from "@/features/contabilidad/lib/cuentas-por-cobrar-flow"
import {
  PageTransition,
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

interface RecoProps {
  cuentaId?: string
}

export function ReconciliacionVentasPage({cuentaId}: RecoProps) {
  const { user } = useAuth()
  const shouldReduceMotion = useReducedMotion()
  const [showReconciliacionForm, setShowReconciliacionForm] = useState(false)
  const [ventasToReconcile, setVentasToReconcile] = useState<VentaPendiente[]>([])
  const [showResumen, setShowResumen] = useState(false)
  const [ultimasReconciliaciones, setUltimasReconciliaciones] = useState<ReconciliacionVenta[]>([])
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  useState(() => {
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(today.getDate() - 7)

    setFechaFin(today.toISOString().split('T')[0])
    setFechaInicio(weekAgo.toISOString().split('T')[0])
  })

  const [ventasData, setVentasData] = useState({ ventas: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } })
  const [historial_ventas_data, setHistorialVentasData] = useState({ reconciliaciones: [], estadisticas: { porMoneda: [], porTipoDePago: [], montoConvertidoTotal: 0, montoTotal: 0 }, pagination: {} })
  const [refetchTrigger, setRefetchTrigger] = useState(0)
  const ventasReconciliadas: ReconciliacionVenta[] = historial_ventas_data.reconciliaciones || []

  useEffect(() => {
    getVentasPendientesAction({ fechaInicio, fechaFin, page: currentPage, limit: pageSize }).then(r => {
      if (r.success) setVentasData(r.data as any)
    })
  }, [fechaInicio, fechaFin, currentPage, pageSize, refetchTrigger])

  useEffect(() => {
    getHistorialReconciliacionVentasAction({ fechaFin, fechaInicio, cuentaId }).then(r => {
      if (r.success) setHistorialVentasData(r.data as any)
    })
  }, [fechaInicio, fechaFin, cuentaId, refetchTrigger])

  const refetch = () => setRefetchTrigger(prev => prev + 1)
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState<any[]>([])

  useEffect(() => {
    getCuentasPorCobrarAction({ page: 1, limit: 1000 }).then(r => {
      if (r.success) setCuentasPorCobrar((r.data?.cuentas ?? []) as any[])
    }).catch(() => {})
  }, [refetchTrigger])

  const [allVentasData, setAllVentasData] = useState({ pagination: {}, ventas: [] })

  useEffect(() => {
    getVentasPendientesAction({ fechaInicio, fechaFin, page: 1, limit: 10000 }).then(r => {
      if (r.success) setAllVentasData(r.data as any)
    })
  }, [fechaInicio, fechaFin, refetchTrigger])

  const { ventas, pagination } = ventasData
   
  const allVentasMerged = useMemo(() => {
    const apiVentas = Array.isArray(allVentasData?.ventas) ? allVentasData.ventas : [];
    // API now returns saldoPendiente calculated server-side
    const apiVentaKeys = new Set(apiVentas.map((v: any) => v.ordenId || v.ventaId));

    const arVentas = cuentasPorCobrar
      .filter(cuenta => {
        if (cuenta.estado === "PAGADA") return false;
        const key = cuenta.numeroFactura || cuenta.facturaId || cuenta.id;
        return !apiVentaKeys.has(key);
      })
      .map(cuenta => {
        const totalCuenta = cuenta.totalFactura ?? cuenta.totalVenta ?? cuenta.montoDeuda;
        const saldoPendiente = Number.isFinite(Number(cuenta.saldoFactura))
          ? Number(cuenta.saldoFactura)
          : (cuenta.montoDeuda - cuenta.montoPagado);
        return {
          ventaId: cuenta.factura?.ventaId || cuenta.facturaId || cuenta.id,
          ordenId: cuenta.numeroFactura || cuenta.facturaId,
          cliente: cuenta.cliente,
          createdAt: cuenta.createdAt,
          total: totalCuenta,
          montoTotal: totalCuenta,
          reconciliada: false,
          saldoPendiente,
        } as VentaPendiente;
      });

    return [...apiVentas, ...arVentas];
  }, [allVentasData, cuentasPorCobrar]);

  const allVentasArray = allVentasMerged


  const cuentasPendientes = cuentasPorCobrar.filter((cuenta) => cuenta.estado !== "PAGADA")
  const saldosPorFactura = cuentasPendientes.reduce((acc: Record<string, number>, cuenta) => {
    const key = cuenta.numeroFactura || cuenta.facturaId || cuenta.id
    const saldo = Number.isFinite(Number(cuenta.saldoFactura)) ? Math.max(0, Number(cuenta.saldoFactura)) : Math.max(0, cuenta.montoDeuda - cuenta.montoPagado)
    acc[key] = (acc[key] ?? 0) + saldo
    return acc
  }, {})
 
  const formatCurrency = (amount: number | string, currency: string = "CUP") => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    const symbol = MONEDA_SIMBOLOS[currency] || currency
    return `${symbol} ${numAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
 
  const handleReconciliarVentas = (ventasSeleccionadas: VentaPendiente[]) => {
    setVentasToReconcile(ventasSeleccionadas)
    setShowReconciliacionForm(true)
  }

  const handleCreateCuentaPorCobrar = async (venta: VentaPendiente) => {
    try {
      const result = await createCuentaPorCobrarAction(
        buildCreateCuentaPorCobrarInputFromVenta(venta),
      )

      if (!result.success) {
        toast.error(result.error?.message || 'No se pudo crear la cuenta por cobrar')
        return
      }

      toast.success('Cuenta por cobrar creada')
      refetch()
    } catch (_error) {
      toast.error('No se pudo crear la cuenta por cobrar')
    }
  }
 
  const handleReconciliacionSuccess = () => {
    setShowReconciliacionForm(false)
    setVentasToReconcile([])
    refetch()
  }
 
  const handleRefresh = () => {
    refetch()
  }
 
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }
 
  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }
 
  const ventasPendientes = allVentasArray.filter((v: VentaPendiente) => (v.saldoPendiente || 0) > 0.01)

  const totalPendiente = ventasPendientes.reduce((sum: number, venta: VentaPendiente) => {
    if (venta.saldoPendiente !== undefined) {
      return sum + venta.saldoPendiente
    }
    const key = venta.ordenId || venta.ventaId
    const saldo = saldosPorFactura[key]
    const monto = typeof saldo === "number"
      ? saldo
      : Number(venta?.total ?? (venta?.cantidad ? venta.cantidad * (venta?.producto?.precioVenta ?? 0) : 0))
    return sum + (isNaN(monto) ? 0 : monto)
  }, 0)

  const totalReconciliado = ventasReconciliadas.reduce((sum: number, venta: ReconciliacionVenta) => {
    const monto = Number(venta?.monto ?? 0)
    if (!Number.isFinite(monto)) {
      return sum
    }

    if (venta?.moneda === "CUP") {
      return sum + monto
    }

    const tasa = Number(venta?.tasaCambio ?? 0)
    return sum + (Number.isFinite(tasa) && tasa > 0 ? monto * tasa : monto)
  }, 0)

  const montoRecon = (ventasReconciliadas.filter((s: ReconciliacionVenta) => s?.cuentaBancaria?.moneda === 'USD') ?? 0).
  reduce((sum: number, venta: ReconciliacionVenta) => (sum + Number(venta.montoConvertido ?? 0)),  0)

  const montoUSD = montoRecon.toFixed(2)

  const montoReconCUP = (ventasReconciliadas.filter((s: ReconciliacionVenta) => s?.cuentaBancaria?.moneda === 'CUP') ?? 0).
  reduce((sum: number, venta: ReconciliacionVenta) => (sum + Number(venta.montoConvertido ?? 0)), 0)

  const pendientesPorMoneda = ventasPendientes.reduce((acc: Record<string, number>, venta: VentaPendiente) => {
    const moneda = "CUP"
    if (!acc[moneda]) acc[moneda] = 0
    if (venta.saldoPendiente !== undefined) {
      acc[moneda] += venta.saldoPendiente
    } else {
      const key = venta.ordenId || venta.ventaId
      const saldo = saldosPorFactura[key]
      const monto = typeof saldo === "number"
        ? saldo
        : Number(venta?.total ?? (venta?.cantidad ? venta.cantidad * (venta?.producto?.precioVenta ?? 0) : 0))
      acc[moneda] += isNaN(monto) ? 0 : monto
    }
    return acc
  }, {} as Record<string, number>)


  const reconciliadasPorMoneda = ventasReconciliadas.reduce((acc: Record<string, number>, venta: ReconciliacionVenta) => {
    const moneda = venta.moneda || "CUP"
    if (!acc[moneda]) acc[moneda] = 0
    const monto = Number(venta?.monto ?? 0)
    acc[moneda] += isNaN(monto) ? 0 : monto
    return acc
  }, {} as Record<string, number>)

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
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">Reconciliación de Ventas</h1>
                    <p className="text-muted-foreground text-sm">
                      Gestiona la reconciliación de ventas con cuentas bancarias
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                  <Input
                    id="fechaInicio"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="mt-2 bg-white/80 dark:bg-slate-900/50"
                  />
                </div>
                <div>
                  <Label htmlFor="fechaFin">Fecha Fin</Label>
                  <Input
                    id="fechaFin"
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="mt-2 bg-white/80 dark:bg-slate-900/50"
                  />
                </div>
                <div className="flex items-end">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full">
                    <Button onClick={handleRefresh} className="w-full gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Aplicar Filtros
                    </Button>
                  </motion.div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
      </StaggerItem>

      {/* Statistics */}
      <StaggerItem>
        <AnimatedCard>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className={cn(surfaceCardClass)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Monto total sin reconciliar</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">Quedan {ventasPendientes.length} ventas</div>
                <Badge variant="outline" className="mt-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                  {formatCurrency(totalPendiente)}
                </Badge>
              </CardContent>
            </Card>
            <Card className={cn(surfaceCardClass)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Ventas Reconciliada</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">Se han reconciliado {ventasReconciliadas.length} ventas</div>
                <Badge variant="outline" className="mt-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                  {formatCurrency(totalReconciliado)}
                </Badge>
              </CardContent>
            </Card>
            <Card className={cn(surfaceCardClass)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Monto Convertido</CardTitle>
                  <HandCoins className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">Se han convertido {montoUSD} en USD</div>
              </CardContent>
            </Card>
          </div>
        </AnimatedCard>
      </StaggerItem>

      {/* Sales Table */}
      <StaggerItem>
        <AnimatedCard>
          <VentasPendientesTable
            onReconciliar={handleReconciliarVentas}
            onCreateCuentaPorCobrar={handleCreateCuentaPorCobrar}
            canManageCuentasPorCobrar={user?.planFeatures?.['cuentas-cobrar'] === true}
            saldosPorFactura={saldosPorFactura}
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            refreshKey={refetchTrigger}
          />
        </AnimatedCard>
      </StaggerItem>

      {/* Recent Reconciliations */}
      {ventasReconciliadas.length > 0 && (
        <StaggerItem>
          <AnimatedCard>
            <Card className={surfaceCardClass}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Reconciliaciones Recientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {ventasReconciliadas.slice(0, 5).map((rec) => (
                    <div key={rec.reconciliacionId} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {(() => {
  if (rec.tipoReconciliacion === 'PRESTAMO_CASH') return 'Cobro Préstamo';
  if (rec.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO') return 'Desembolso Préstamo';
  if (rec.tipoReconciliacion === 'DEUDA_CASH') return 'Pago Deuda';
  if (rec.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO') return 'Desembolso Deuda';
  return rec.venta?.ventaId?.slice(-8) || 'Venta directa';
})()}
                        </Badge>
                        <span className="text-sm">
                          {rec.cuentaBancaria?.nombreBanco || "Cuenta"}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {rec.tipoPago?.nombre || "Tipo de pago"}
                        </Badge>
                        {rec.idTransferencia && (
                          <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                            Ref: {rec.idTransferencia}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(rec.monto, rec.moneda)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(rec.fechaReconciliacion).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {ventasReconciliadas.length > 0 && (
                  <div className="text-center mt-4">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUltimasReconciliaciones(ventasReconciliadas)
                          setShowResumen(true)
                        }}
                      >
                        Ver todas las reconciliaciones ({ventasReconciliadas.length})
                      </Button>
                    </motion.div>
                  </div>
                )}
              </CardContent>
            </Card>
          </AnimatedCard>
        </StaggerItem>
      )}

      {/* Reconciliation Form Dialog */}
      {ventasToReconcile.length === 1 ? (
         <ReconciliacionVentasForm
           venta={ventasToReconcile[0]}
           open={showReconciliacionForm}
            onClose={() => {
              setShowReconciliacionForm(false)
              setVentasToReconcile([])
            }}
           onSuccess={handleReconciliacionSuccess}
           saldoRestante={ventasToReconcile[0].saldoPendiente ?? ventasToReconcile[0].total ?? 0}
           allowPartial={true}
         />
     ) : ventasToReconcile.length > 1 ? (
       <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
         <motion.div 
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="rounded-lg p-6 max-w-md w-full border-4 bg-background"
         >
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
               <FileText className="h-5 w-5 text-amber-600" />
             </div>
             <h3 className="text-lg font-semibold">Reconciliación Múltiple</h3>
           </div>
           <p className="text-muted-foreground mb-4">
             Has seleccionado {ventasToReconcile.length} ventas. Por favor, reconcilia una a la vez para mayor precisión.
           </p>
           <div className="flex justify-end gap-2">
             <Button variant="destructive" onClick={() => {
               setShowReconciliacionForm(false)
               setVentasToReconcile([])
             }}>
               Cancelar
             </Button>
           </div>
         </motion.div>
       </div>
     ) : null}

      {/* Summary Dialog */}
      {showResumen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ResumenReconciliacion
              reconciliaciones={ultimasReconciliaciones}
              onClose={() => setShowResumen(false)}
              titulo="Historial de Reconciliaciones"
            />
          </div>
        </div>
      )}
    </StaggerContainer>
  )
}
