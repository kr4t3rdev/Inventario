"use client"

import { useMemo, useState, useEffect } from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ReconciliacionVentasForm } from "@/features/contabilidad/components/reconciliacion-ventas-form"
import { CuentasPorCobrarTable } from "@/features/contabilidad/components/cuentas-por-cobrar-table"
import {
  useGetCuentasPorCobrarQuery
} from "@/lib/redux/services/cuentasPorCobrarApi"
import { useGetFacturaQuery, useGetFacturasQuery } from "@/lib/redux/services/facturasApi"
import { useGetVentaQuery } from "@/features/ventas"
import type { CuentaPorCobrar, VentaPendiente } from "@/app/models/model"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Loader2, AlertCircle, TrendingUp, TrendingDown, DollarSign, Receipt, ArrowLeft, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { AnimatedNumber } from "@/components/ui/animated-number"
import Link from "next/link"

export const dynamic = 'force-dynamic'

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/6 dark:bg-slate-900/15',
);

/**
 * @description Página de Cuentas por Cobrar con dashboard de métricas y tabla de gestión.
 * @returns {JSX.Element} Vista principal de cuentas por cobrar.
 */
export default function CuentasPorCobrarPage() {
  const { data: cuentas, isLoading, error } = useGetCuentasPorCobrarQuery()
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaPorCobrar | null>(null)
  const [showReconciliacion, setShowReconciliacion] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  // --- Lógica de Reconciliación ---
  const facturaId = cuentaSeleccionada?.facturaId
  const numeroFactura = cuentaSeleccionada?.numeroFactura

  const { data: facturaById, isLoading: isLoadingFacturaById } = useGetFacturaQuery(facturaId ?? "", {
    skip: !facturaId
  })
  const { data: facturasByNumero, isLoading: isLoadingFacturasByNumero } = useGetFacturasQuery(
    { page: 1, limit: 1, search: numeroFactura },
    { skip: !numeroFactura || !!facturaId }
  )

  const factura = facturaById ?? facturasByNumero?.facturas?.[0]
  const ventaId = factura?.ventaId
  
  const { data: ventaData, isLoading: isLoadingVenta } = useGetVentaQuery(ventaId ?? "", { skip: !ventaId })

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
  
  const isResolvingFactura = (!!facturaId && isLoadingFacturaById) || (!!numeroFactura && !facturaId && isLoadingFacturasByNumero)
  const isResolvingVenta = !!ventaId && isLoadingVenta

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
  }

  // --- Procesamiento de Datos ---
  const cuentasParaMostrar = useMemo(() => {
    const list = cuentas || []
    const byKey = new Map<string, CuentaPorCobrar>()

    for (const c of list) {
      const key = c.facturaId || c.numeroFactura || c.id
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, c)
      } else {
        // keep the one with more info if possible
        if (!existing.facturaId && c.facturaId) {
          byKey.set(key, c)
        }
      }
    }
    return Array.from(byKey.values())
  }, [cuentas])

  // --- Métricas ---
  const metricas = useMemo(() => {
    const list = cuentasParaMostrar
    const totalPorCobrar = list.reduce((acc, c) => {
       const saldo = Number.isFinite(Number(c.saldoFactura))
        ? Number(c.saldoFactura)
        : Number(c.montoDeuda) - Number(c.montoPagado)
       return acc + Math.max(0, saldo)
    }, 0)
    
    const totalFacturado = list.reduce((acc, c) => acc + Number(c.montoDeuda || 0), 0)
    const totalCobrado = list.reduce((acc, c) => acc + Number(c.montoPagado || 0), 0)
    const porcentajeCobrado = totalFacturado > 0 ? (totalCobrado / totalFacturado) * 100 : 0
    
    const pendientesCount = list.filter(c => c.estado !== 'PAGADA').length
    const pagadasCount = list.filter(c => c.estado === 'PAGADA').length

    return {
      totalPorCobrar,
      totalFacturado,
      totalCobrado,
      porcentajeCobrado,
      pendientesCount,
      pagadasCount,
      totalCount: list.length
    }
  }, [cuentasParaMostrar])

  // --- Variantes de Animación ---
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.1
      }
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
    <SidebarProvider>
      <SidebarInset className="bg-background">
        <motion.div 
          className="container mx-auto py-6 px-4 space-y-8"
          variants={containerVariants}
          initial="hidden"
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
                  {metricas.totalCount} facturas registradas
                </Badge>
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <Receipt className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                </div>
              </div>
            </div>

            {/* Cards de métricas */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className={cn(surfaceCardClass, "border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Facturado
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    <AnimatedNumber value={metricas.totalFacturado} prefix="$" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metricas.totalCount} facturas de clientes
                  </p>
                </CardContent>
              </Card>

              <Card className={cn(surfaceCardClass, "border-l-4 border-l-chart-2 shadow-sm hover:shadow-md transition-shadow")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Cobrado
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    <AnimatedNumber value={metricas.totalCobrado} prefix="$" />
                  </div>
                  <p className="text-xs text-green-600 mt-1 font-medium">
                    {metricas.porcentajeCobrado.toFixed(1)}% cobrado
                  </p>
                </CardContent>
              </Card>

              <Card className={cn(surfaceCardClass, "border-l-4 border-l-destructive shadow-sm hover:shadow-md transition-shadow")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Por Cobrar
                  </CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    <AnimatedNumber value={metricas.totalPorCobrar} prefix="$" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metricas.pendientesCount} cuentas pendientes
                  </p>
                </CardContent>
              </Card>

              <Card className={cn(surfaceCardClass, "border-l-4 border-l-accent shadow-sm hover:shadow-md transition-shadow")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Estado General
                  </CardTitle>
                  <CreditCard className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    <AnimatedNumber value={metricas.pagadasCount} isInteger />
                    <span className="text-sm font-normal text-muted-foreground"> / {metricas.totalCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    facturas pagadas
                  </p>
                </CardContent>
              </Card>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <CuentasPorCobrarTable 
                cuentas={cuentasParaMostrar}
                isLoading={isLoading}
                error={error}
                onPagar={handlePagarCuenta}
            />
          </motion.div>

          <AnimatePresence>
            {showReconciliacion && (
              <Dialog open={showReconciliacion} onOpenChange={(open) => !open && handleCloseReconciliacion()}>
                <DialogContent className={cn(surfaceCardClass, "max-w-4xl max-h-[90vh] overflow-y-auto")}>
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
                    />
                  ) : null}
                </DialogContent>
              </Dialog>
            )}
          </AnimatePresence>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}
