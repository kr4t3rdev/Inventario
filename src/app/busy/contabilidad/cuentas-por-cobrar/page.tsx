"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { ReconciliacionVentasForm } from "@/features/contabilidad/components/reconciliacion/reconciliacion-ventas-form"
import { CuentasPorCobrarTable } from "@/features/contabilidad/components/cuentas-por-cobrar-table"
import { getCuentasPorCobrarAction, getCxcMetricsAction } from "@/features/contabilidad"
import { getVentaByIdAction } from "@/features/ventas"
import type { GetCuentasPorCobrarResult, CxcMetrics } from "@/features/contabilidad"
import type { CuentaPorCobrar, VentaPendiente } from "@/app/models/model"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Loader2, AlertCircle, TrendingUp, TrendingDown, DollarSign, Receipt, ArrowLeft, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getAuthToken } from "@/lib/token"
import { LazyMotion, m as motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { AnimatedNumber } from "@/components/ui/animated-number"
import Link from "next/link"

export const dynamic = 'force-dynamic'

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/6 dark:bg-slate-900/15',
);

/** @description Hook que evita hydration mismatch: retorna false en SSR, true tras mount. */
function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}

/**
 * @description Página de Cuentas por Cobrar con dashboard de métricas y tabla de gestión.
 * Usa Server Actions para data fetching en lugar de RTK Query.
 * @returns {JSX.Element} Vista principal de cuentas por cobrar.
 */
export default function CuentasPorCobrarPage() {
  const [cuentasData, setCuentasData] = useState<GetCuentasPorCobrarResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaPorCobrar | null>(null)
  const [showReconciliacion, setShowReconciliacion] = useState(false)
  const shouldReduceMotion = useReducedMotion()
  const hasMounted = useHasMounted()

  const [metricas, setMetricas] = useState<CxcMetrics | null>(null)

  // ── Debounce search ───────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400)
    return () => clearTimeout(t)
  }, [searchTerm])

  // ── Reset page when filters change ────────────────────
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  // ── Data Fetching via Server Action ────────────────────
  const LIMIT = 20

  const loadCuentas = useCallback(async (pageNum: number, search: string) => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const result = await getCuentasPorCobrarAction({ page: pageNum, limit: LIMIT, search: search || undefined })
      if (result.success && result.data) {
        setCuentasData(result.data)
      } else {
        setFetchError(result.error?.message ?? 'Error al cargar cuentas')
      }
    } catch (err) {
      setFetchError('Error de conexión al cargar cuentas')
      console.error('Error fetching CxC:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── Load metrics separately ───────────────────────────
  const loadMetrics = useCallback(async () => {
    const result = await getCxcMetricsAction({})
    if (result.success && result.data) {
      setMetricas(result.data)
    }
  }, [])

  useEffect(() => {
    loadCuentas(page, debouncedSearch)
    loadMetrics()
  }, [page, debouncedSearch, loadCuentas, loadMetrics])

  const cuentas = useMemo(() =>
    (cuentasData?.cuentas ?? []) as unknown as CuentaPorCobrar[],
    [cuentasData],
  )

  const totalPages = cuentasData?.pagination?.totalPages ?? 1

  // ── Lógica de Reconciliación ──────────────────────────
  const facturaId = cuentaSeleccionada?.facturaId
  const numeroFactura = cuentaSeleccionada?.numeroFactura

  const facturaData = useRef<any>(null)
  const [isResolvingFactura, setIsResolvingFactura] = useState(false)
  const [ventaData, setVentaData] = useState<any>(null)
  const [isResolvingVenta, setIsResolvingVenta] = useState(false)

  // Resolver factura cuando cambia la cuenta seleccionada
  useEffect(() => {
    if (!cuentaSeleccionada || !showReconciliacion) return

    let cancelled = false
    const token = getAuthToken()

    async function resolve() {
      setIsResolvingFactura(true)
      facturaData.current = null
      setVentaData(null)

      try {
        let factura: any = null

        if (facturaId) {
          const res = await fetch(`/api/facturas/${facturaId}`, {
            headers: token ? { Authorization: token } : {},
          })
          if (res.ok) factura = await res.json()
        } else if (numeroFactura) {
          const res = await fetch(`/api/facturas?search=${encodeURIComponent(numeroFactura)}&limit=1`, {
            headers: token ? { Authorization: token } : {},
          })
          if (res.ok) {
            const data = await res.json()
            factura = data.facturas?.[0] ?? data
          }
        }

        if (cancelled) return
        facturaData.current = factura

        // Resolver venta vinculada
        const vtaId = factura?.ventaId
        if (vtaId) {
          setIsResolvingVenta(true)
          try {
            const vtaResult = await getVentaByIdAction(vtaId)
            if (vtaResult.success && vtaResult.data && !cancelled) {
              setVentaData(vtaResult.data)
            }
          } catch {
            // venta no encontrada o error de auth — continuar sin venta
          }
        }
      } catch (e) {
        console.error('Error resolving factura/venta:', e)
      } finally {
        if (!cancelled) {
          setIsResolvingFactura(false)
          setIsResolvingVenta(false)
        }
      }
    }

    resolve()
    return () => { cancelled = true }
  }, [cuentaSeleccionada, showReconciliacion, facturaId, numeroFactura])

  const saldoPendiente = cuentaSeleccionada
    ? (Number.isFinite(Number(cuentaSeleccionada.saldoFactura))
      ? Math.max(0, Number(cuentaSeleccionada.saldoFactura))
      : Math.max(0, Number(cuentaSeleccionada.montoDeuda) - Number(cuentaSeleccionada.montoPagado)))
    : 0

  const ventaParaReconciliar: VentaPendiente | null = useMemo(() => {
    if (!ventaData || !cuentaSeleccionada) return null
    return {
      ...ventaData,
      total: saldoPendiente,
      ordenId: numeroFactura || ventaData.ordenId,
      reconciliada: false,
      montoTotal: saldoPendiente
    }
  }, [ventaData, cuentaSeleccionada, saldoPendiente, numeroFactura])

  const [isTimeOut, setIsTimeOut] = useState(false)

  useEffect(() => {
    if (showReconciliacion && !ventaParaReconciliar) {
        const timer = setTimeout(() => setIsTimeOut(true), 5000)
        return () => clearTimeout(timer)
    }
    setIsTimeOut(false)
  }, [showReconciliacion, ventaParaReconciliar])

  const isLoadingData = showReconciliacion && !ventaParaReconciliar && (isResolvingFactura || isResolvingVenta || (!isTimeOut && (!!facturaId || !!numeroFactura)))
  const dataMissing = showReconciliacion && !ventaParaReconciliar && !isLoadingData

  const handlePagarCuenta = (cuenta: CuentaPorCobrar) => {
    if (cuenta.tipoCuenta === 'PRESTAMO_CASH') return
    setCuentaSeleccionada(cuenta)
    setShowReconciliacion(true)
    setIsTimeOut(false)
  }

  const handleCloseReconciliacion = () => {
    setShowReconciliacion(false)
    setCuentaSeleccionada(null)
    setIsTimeOut(false)
    loadCuentas(page, debouncedSearch)
  }

  // ── Procesamiento de Datos ────────────────────────────
  const cuentasParaMostrar = useMemo(() => {
    const list = cuentas || []
    const byKey = new Map<string, CuentaPorCobrar>()

    for (const c of list) {
      const key = c.facturaId || c.numeroFactura || c.id
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, c)
      } else {
        if (!existing.facturaId && c.facturaId) {
          byKey.set(key, c)
        }
      }
    }
    return Array.from(byKey.values())
  }, [cuentas])

  // ── Variantes de Animación ────────────────────────────
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 50, damping: 15 }
    }
  }

  return (
        <motion.div
          className="container mx-auto py-6 px-4 space-y-8"
          variants={containerVariants}
          initial={hasMounted ? "hidden" : false}
          animate="show"
        >
          {/* Header */}
          <motion.div variants={itemVariants}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                    <Link href="/busy/contabilidad">
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Volver
                    </Link>
                  </Button>
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Cuentas por Cobrar
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gestione las facturas pendientes de cobro y registre pagos de clientes.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="h-9 px-4 text-sm font-medium">
                  {metricas?.totalCuentas ?? 0} facturas registradas
                </Badge>
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <Receipt className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                </div>
              </div>
            </div>

            {/* Cards de métricas */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className={cn(surfaceCardClass, "border-l-4 border-l-destructive shadow-sm hover:shadow-md transition-shadow")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendiente</CardTitle>
                  <DollarSign className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    <AnimatedNumber value={metricas?.totalPendiente ?? 0} prefix="$" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">por cobrar de clientes</p>
                </CardContent>
              </Card>

              <Card className={cn(surfaceCardClass, "border-l-4 border-l-chart-2 shadow-sm hover:shadow-md transition-shadow")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Por Vencer</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    <AnimatedNumber value={metricas?.porVencer ?? 0} isInteger />
                  </div>
                  <p className="text-xs text-green-600 mt-1 font-medium">cuentas al día</p>
                </CardContent>
              </Card>

              <Card className={cn(surfaceCardClass, "border-l-4 border-l-destructive shadow-sm hover:shadow-md transition-shadow")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Vencidas</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    <AnimatedNumber value={metricas?.vencidas ?? 0} isInteger />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">cuentas vencidas</p>
                </CardContent>
              </Card>

              <Card className={cn(surfaceCardClass, "border-l-4 border-l-accent shadow-sm hover:shadow-md transition-shadow")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Cuentas</CardTitle>
                  <CreditCard className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    <AnimatedNumber value={metricas?.totalCuentas ?? 0} isInteger />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">facturas registradas</p>
                </CardContent>
              </Card>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <CuentasPorCobrarTable
                cuentas={cuentasParaMostrar}
                isLoading={isLoading}
                error={fetchError}
                onPagar={handlePagarCuenta}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
            />
          </motion.div>

          <AnimatePresence>
            {showReconciliacion && (
              <Dialog open={showReconciliacion} onOpenChange={(open) => !open && handleCloseReconciliacion()}>
                <DialogContent className={cn(surfaceCardClass, "max-w-4xl max-h-[90vh] overflow-y-auto")}>
                  <DialogTitle className="sr-only">
                    Reconciliar {cuentaSeleccionada?.cliente?.nombre || cuentaSeleccionada?.numeroFactura || 'cuenta por cobrar'}
                  </DialogTitle>
                  {isLoadingData ? (
                    <div className="flex flex-col items-center justify-center p-12 space-y-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="text-muted-foreground">Cargando información de la factura y venta...</p>
                    </div>
                  ) : dataMissing ? (
                    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                        <h3 className="text-lg font-semibold">No se encontró información</h3>
                        <p className="text-muted-foreground max-w-md">
                            No pudimos vincular esta cuenta por cobrar con una venta o factura en el sistema.
                            Verifique si la factura existe o si es un registro manual antiguo.
                        </p>
                        <div className="flex gap-2 mt-4">
                            <Button variant="outline" onClick={handleCloseReconciliacion}>
                                Cerrar
                            </Button>
                        </div>
                    </div>
                  ) : ventaParaReconciliar ? (
                    <ReconciliacionVentasForm
                      venta={ventaParaReconciliar}
                      open={true}
                      onClose={handleCloseReconciliacion}
                      onSuccess={() => loadCuentas(page, debouncedSearch)}
                    />
                  ) : null}
                </DialogContent>
              </Dialog>
            )}
          </AnimatePresence>
        </motion.div>
  )
}
