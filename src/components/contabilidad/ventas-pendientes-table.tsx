"use client"

import React, { useState, useMemo } from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search,
  ShoppingCart,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useGetVentasPendientesQuery
} from "@/features/contabilidad/api/contabilidadApi"
import { useGetCuentasPorCobrarQuery } from "@/lib/redux/services/cuentasPorCobrarApi"
import type { VentaPendiente } from "../../app/models/model"
import { cn } from "@/lib/utils"
import {
  StaggerContainer,
  StaggerItem,
  AnimatedCard
} from "@/components/ui/animations"

interface VentasPendientesTableProps {
  onReconciliar?: (ventas: VentaPendiente[]) => void
  saldosPorFactura?: Record<string, number>
  fechaInicio?: string
  fechaFin?: string
  currentPage?: number
  totalPages?: number
  totalItems?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

const MONEDA_SIMBOLOS: Record<string, string> = {
  CUP: "CUP",
  USD: "$",
  EUR: "€",
}

const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
)

export function VentasPendientesTable({
  onReconciliar,
  saldosPorFactura,
  fechaInicio,
  fechaFin,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 50,
  onPageChange,
  onPageSizeChange
}: VentasPendientesTableProps) {
  const shouldReduceMotion = useReducedMotion()
  const [searchTerm, setSearchTerm] = useState("")

  const { data: ventasData = { ventas: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }, isLoading: isLoadingVentas, error: errorVentas } = useGetVentasPendientesQuery({
    fechaInicio,
    fechaFin,
    page: currentPage,
    limit: pageSize
  })

  const { data: cuentasPorCobrarData, isLoading: isLoadingCuentas } = useGetCuentasPorCobrarQuery()

  const isLoading = isLoadingVentas || isLoadingCuentas
  const error = errorVentas

  const ventasCombinadas = useMemo(() => {
    const ventasFromApi = ventasData?.ventas || []
    const ventasApiMap = new Map(ventasFromApi.map(v => [v.ventaId, v]))
    
    const cuentasPorCobrar = cuentasPorCobrarData || []
    cuentasPorCobrar.forEach((cuenta: any) => {
      const ventaId = cuenta.factura?.ventaId || cuenta.facturaId
      if (ventaId && !ventasApiMap.has(ventaId) && cuenta.estado !== "PAGADA") {
        const totalCuenta = cuenta.totalFactura ?? cuenta.totalVenta ?? cuenta.montoDeuda
        const saldoPendienteCuenta = Number.isFinite(Number(cuenta.saldoFactura))
          ? Number(cuenta.saldoFactura)
          : (cuenta.montoDeuda - cuenta.montoPagado)

        ventasApiMap.set(ventaId, {
          ventaId: ventaId,
          ordenId: cuenta.numeroFactura,
          cliente: cuenta.cliente,
          createdAt: cuenta.createdAt,
          total: totalCuenta,
          cantidad: 1,
          puntoDeVenta: null,
          reconciliada: false,
          esCuentaPorCobrar: true,
          cuentaPorCobrarId: cuenta.cuentaPorCobrarId || cuenta.id,
          saldoPendiente: saldoPendienteCuenta,
          productoId: '',
          puntoDeVentaId: '',
          montoTotal: totalCuenta,
          updatedAt: cuenta.updatedAt
        } as unknown as VentaPendiente)
      }
    })
    
    return Array.from(ventasApiMap.values())
  }, [ventasData?.ventas, cuentasPorCobrarData])

  const filteredVentas = useMemo(() => {
    if (!searchTerm.trim()) return ventasCombinadas
    
    const term = searchTerm.toLowerCase()
    return ventasCombinadas.filter((venta: any) => {
      const clienteNombre = venta.cliente?.nombre || ''
      const ventaId = String(venta.ventaId || '')
      const ordenId = String(venta.ordenId || '')
      
      return clienteNombre.toLowerCase().includes(term) ||
             ventaId.toLowerCase().includes(term) ||
             ordenId.toLowerCase().includes(term)
    })
  }, [ventasCombinadas, searchTerm])

  const obtenerSaldoPendiente = (venta: VentaPendiente) => {
    if (typeof venta.saldoPendiente === 'number' && Number.isFinite(venta.saldoPendiente)) {
      return Math.max(0, venta.saldoPendiente)
    }

    if (saldosPorFactura) {
      const keyByOrden = venta.ordenId ? saldosPorFactura[String(venta.ordenId)] : undefined
      if (typeof keyByOrden === 'number' && Number.isFinite(keyByOrden)) {
        return Math.max(0, keyByOrden)
      }

      const keyByVentaId = venta.ventaId ? saldosPorFactura[String(venta.ventaId)] : undefined
      if (typeof keyByVentaId === 'number' && Number.isFinite(keyByVentaId)) {
        return Math.max(0, keyByVentaId)
      }
    }

    return Math.max(0, Number(venta.total ?? 0))
  }

  const formatCurrency = (amount: number | string | null | undefined, currency: string = "CUP") => {
    const symbol = MONEDA_SIMBOLOS[currency] || currency
    if (amount == null) {
      return `${symbol} 0.00`
    }
    const raw = typeof amount === "string" ? amount.replace(",", ".") : String(amount)
    const numAmount = parseFloat(raw)
    if (isNaN(numAmount)) {
      return `${symbol} 0.00`
    }
    return `${symbol} ${numAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const ventasPendientes = filteredVentas?.filter(venta => obtenerSaldoPendiente(venta) > 0.01) ?? []

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.03,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.2,
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
                <FileText className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-destructive font-medium">Error al cargar las ventas pendientes</p>
              <p className="text-muted-foreground text-sm mt-1">Por favor, intente nuevamente</p>
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>
    )
  }

  return (
    <StaggerContainer className="space-y-4" variants={containerVariants} initial="hidden" animate="show">
      {/* Header */}
      <StaggerItem>
        <AnimatedCard>
          <Card className={surfaceCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <ShoppingCart className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  Ventas para Reconciliar
                </CardTitle>
                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/20">
                  <Clock className="h-3 w-3 mr-1" />
                  {ventasPendientes.length} pendientes
                </Badge>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar ventas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/80 dark:bg-slate-900/50"
                  />
                </div>
              </div>
            </CardHeader>
          </Card>
        </AnimatedCard>
      </StaggerItem>

      {/* Table */}
      <StaggerItem>
        <AnimatedCard>
          <Card className={surfaceCardClass}>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
                </div>
              ) : filteredVentas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-muted-foreground">No hay ventas</p>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm ? "No se encontraron ventas que coincidan con la búsqueda" : "No hay ventas en el período seleccionado"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 dark:bg-slate-900/50 hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                          <TableHead className="font-semibold">ID Venta</TableHead>
                          <TableHead className="font-semibold">Fecha</TableHead>
                          <TableHead className="font-semibold">Punto de Venta</TableHead>
                          <TableHead className="font-semibold text-center">Cantidad</TableHead>
                          <TableHead className="font-semibold">Monto Total</TableHead>
                          <TableHead className="font-semibold">Sin Reconciliar</TableHead>
                          <TableHead className="font-semibold">Moneda</TableHead>
                          <TableHead className="font-semibold">Estado</TableHead>
                          <TableHead className="w-[120px] font-semibold">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredVentas.map((venta) => (
                          <TableRow
                            key={venta.ventaId}
                            className={cn(
                              "hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors",
                              obtenerSaldoPendiente(venta) <= 0.01 && "opacity-60"
                            )}
                          >
                            <TableCell className="font-mono text-sm">
                              {String(venta?.ventaId ?? "N/A").slice(-8)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {venta?.createdAt ? formatDate(venta.createdAt) : "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const pv = venta?.puntoDeVenta
                                if(!pv) return venta?.puntoDeVentaId ?? '-'
                                if(typeof pv === 'string') return pv
                                return pv?.nombre ?? venta?.puntoDeVentaId ?? '-'
                              })()}
                            </TableCell>
                            <TableCell className="text-center">
                              {venta.cantidad ?? 0}
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatCurrency((venta.total), "CUP")}
                            </TableCell>
                            <TableCell className="font-mono">
                              <span className={obtenerSaldoPendiente(venta) > 0 ? "text-amber-600 dark:text-amber-400" : ""}>
                                {formatCurrency(obtenerSaldoPendiente(venta), "CUP")}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {venta.moneda || "CUP"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {venta.reconciliada ? (
                                <Badge variant="default" className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Reconciliada
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="h-3 w-3" />
                                  Pendiente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {onReconciliar && obtenerSaldoPendiente(venta) > 0.01 && (
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => onReconciliar([venta])}
                                    className="gap-1"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Reconciliar
                                  </Button>
                                </motion.div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Mostrando {filteredVentas.length} de {totalItems} ventas
                        </span>
                        <Select
                          value={String(pageSize)}
                          onValueChange={(value) => onPageSizeChange?.(Number(value))}
                        >
                          <SelectTrigger className="w-[100px] bg-white/80 dark:bg-slate-900/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
                              className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>

                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const page = i + 1
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => onPageChange?.(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          })}

                          {totalPages > 5 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}

                          <PaginationItem>
                            <PaginationNext
                              onClick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
                              className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </AnimatedCard>
      </StaggerItem>
    </StaggerContainer>
  )
}
