"use client"

import { useEffect, useState } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search,
  Wrench,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react"
import type { VentaServicio } from "../../app/models/model"
import { useGetServiciosPendientesQuery } from "@/features/contabilidad/api/contabilidadApi"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "../ui/pagination"
import { cn } from "@/lib/utils"
import {
  StaggerContainer,
  StaggerItem,
  AnimatedCard
} from "@/components/ui/animations"

interface ServiciosPendientesTableProps {
  onReconciliar?: (servicio: VentaServicio) => void
  selectedServicio?: string
  onSelectedServicioChange?: (servicioId: string) => void
  fechaInicio?: string
  fechaFin?: string
  servicios?: VentaServicio[]
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

export function ServiciosPendientesTable({
  onReconciliar,
  selectedServicio = "",
  onSelectedServicioChange,
  servicios: serviciosProp,
  fechaInicio,
  fechaFin,
  currentPage = 1,
  pageSize = 50,
  onPageChange,
  onPageSizeChange
}: ServiciosPendientesTableProps) {
  const shouldReduceMotion = useReducedMotion()
  const [searchTerm, setSearchTerm] = useState("")
  const itemsPerPage = 10

  useEffect(() => {
    onPageChange?.(1)
  },[searchTerm, fechaInicio, fechaFin, onPageChange])

  const { data: serviciosData = [], isLoading, error } = useGetServiciosPendientesQuery({
    fechaDesde: fechaInicio,
    fechaHasta: fechaFin
  }, { skip: !!serviciosProp })

  const serviciosFlat: VentaServicio[] = serviciosProp || (Array.isArray(serviciosData) ? serviciosData : (serviciosData.ventaServicios || []))

  const effectiveLoading = !serviciosProp && isLoading

  const filteredServicios = serviciosFlat?.filter((servicio) => {
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase()
    return (
      (servicio.ventaServicioId?.toLowerCase().includes(searchLower) ?? false) ||
      ((servicio.servicio?.descripcion || '').toLowerCase().includes(searchLower)) ||
      String(servicio.total ?? '').toLowerCase().includes(searchLower)
    )
  })

  const totalItems = filteredServicios.length || 0
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedServicios = filteredServicios?.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    onPageChange?.(page)
  }

  const handleSelectServicio = (ventaServicioId: string, checked: boolean) => {
    if (!onSelectedServicioChange) return
    if (checked) {
      onSelectedServicioChange(ventaServicioId)
    } else {
      onSelectedServicioChange("")
    }
  }

  const formatCurrency = (amount: number | string, currency: string = "CUP") => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    const symbol = MONEDA_SIMBOLOS[currency] || currency
    return `${symbol} ${numAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—'
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const selectedCount = selectedServicio ? 1 : 0
  const canReconciliar = selectedCount > 0 && onReconciliar

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.03,
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
                <Wrench className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-destructive font-medium">Error al cargar los servicios pendientes</p>
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
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  Servicios para Reconciliar
                </CardTitle>
                
                {canReconciliar && (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                      onClick={() => {
                        const selectedServicioData = filteredServicios.find(s => s.ventaServicioId === selectedServicio)
                        if (selectedServicioData && onReconciliar) {
                          onReconciliar(selectedServicioData)
                        }
                      }}
                      disabled={selectedCount === 0}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Reconciliar ({selectedCount})
                    </Button>
                  </motion.div>
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar servicios..."
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
              {effectiveLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
                </div>
              ) : filteredServicios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <Wrench className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-muted-foreground">No hay servicios pendientes</p>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm ? "No se encontraron servicios que coincidan con la búsqueda" : "No hay servicios pendientes en el período seleccionado"}
                  </p>
                </div>
              ) : (
                <>
                <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 dark:bg-slate-900/50 hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                          {onSelectedServicioChange && (
                            <TableHead className="w-[50px]">
                              <Checkbox
                                checked={false}
                                onCheckedChange={() => {}}
                                disabled={true}
                              />
                            </TableHead>
                          )}
                        <TableHead className="font-semibold">ID Servicio</TableHead>
                        <TableHead className="font-semibold">Fecha Servicio</TableHead>
                        <TableHead className="font-semibold">Descripción</TableHead>
                        <TableHead className="font-semibold">Cliente</TableHead>
                        <TableHead className="font-semibold">Precio</TableHead>
                        <TableHead className="font-semibold">Moneda</TableHead>
                        <TableHead className="font-semibold">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedServicios?.map((servicio, i) => (
                        <TableRow 
                          key={servicio.ventaServicioId || `${servicio.servicio?.descripcion || 'item'}-${i}`}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                        >
                          {onSelectedServicioChange && (
                            <TableCell>
                              <Checkbox
                                checked={servicio.ventaServicioId === selectedServicio}
                                onCheckedChange={(checked) => handleSelectServicio(servicio.ventaServicioId!, checked as boolean)}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-mono text-sm">
                            {servicio.ventaServicioId?.slice(0, 9) || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(servicio.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {servicio.servicio?.descripcion || '—'}
                          </TableCell>
                          <TableCell>
                            {servicio?.cliente?.nombre || '—'}
                          </TableCell>
                          <TableCell className="font-mono">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              {formatCurrency(Number(servicio.total ?? 0), servicio.servicio?.moneda || 'CUP')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {servicio.servicio?.moneda || "CUP"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              Pendiente
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center py-4 border-t border-slate-200/60 dark:border-slate-800">
                    <Pagination>
                      <PaginationContent className="gap-7">
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => handlePageChange(page)}
                                  isActive={page === currentPage}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          } else if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationEllipsis/>
                              </PaginationItem>
                            )
                          }
                          return null
                        })}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
