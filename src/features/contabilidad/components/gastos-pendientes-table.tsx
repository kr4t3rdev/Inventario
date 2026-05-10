"use client"

import { useState, useEffect } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Search,
  Receipt,
  DollarSign,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  Building2,
  ShoppingCart,
  FileText,
} from "lucide-react"
import { getGastosPendientesAction } from "@/features/contabilidad/actions-reconciliacion"
import { GastoPendiente } from "@/app/models/model"
import { cn } from "@/lib/utils"
import {
  StaggerContainer,
  StaggerItem,
  AnimatedCard
} from "@/components/ui/animations"

interface GastosPendientesTableProps {
  onReconciliar?: (gasto: GastoPendiente) => void
  selectedGastos?: string[]
  onSelectionChange?: (gastoIds: string[]) => void
  fechaInicio?: string
  fechaFin?: string
  currentPage?: number
  totalPages?: number
  totalItems?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  gastos?: GastoPendiente[]
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

const TIPO_GASTO_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  salario: { label: "Salario", icon: User, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200/80" },
  gastoDE: { label: "Gasto DE", icon: Building2, color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200/80" },
  compra: { label: "Compra", icon: ShoppingCart, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200/80" }
}

export function GastosPendientesTable({
  onReconciliar,
  selectedGastos = [],
  onSelectionChange,
  fechaInicio,
  fechaFin,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 50,
  onPageChange,
  onPageSizeChange,
  gastos: gastosProp
}: GastosPendientesTableProps) {
  const shouldReduceMotion = useReducedMotion()
  const [searchTerm, setSearchTerm] = useState("")
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("all")
  const [localCurrentPage, setLocalCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setLocalCurrentPage(1)
  }, [searchTerm, periodoFiltro, fechaInicio, fechaFin])
  
  const [response, setResponse] = useState<{ gastos?: GastoPendiente[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    getGastosPendientesAction({
      fechaDesde: fechaInicio,
      fechaHasta: fechaFin
    }).then(r => {
      if (r.success) setResponse(r.data as any)
      setIsLoading(false)
    }).catch(e => { setError(e); setIsLoading(false) })
  }, [fechaInicio, fechaFin])

  const gastos = gastosProp || response?.gastos

  const preFiltered = gastos

  const filteredGastos = preFiltered?.filter((gasto) => {
    if (!searchTerm && periodoFiltro === "all") return true

    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = !searchTerm || (
      gasto.descripcion.toLowerCase().includes(searchLower) ||
      gasto.referenciaId.toLowerCase().includes(searchLower) ||
      gasto.monto.toString().includes(searchLower) ||
      (gasto.detalles?.empleado?.nombre?.toLowerCase().includes(searchLower)) ||
      (gasto.detalles?.empleado?.apellido?.toLowerCase().includes(searchLower)) ||
      (gasto.detalles?.proveedor?.toLowerCase().includes(searchLower)) ||
      (gasto.detalles?.producto?.toLowerCase().includes(searchLower))
    )

    const matchesPeriodo = periodoFiltro === "all" || gasto.periodo === periodoFiltro

    return matchesSearch && matchesPeriodo
  })

  const totalItemsAPI = filteredGastos?.length || 0
  const startIndex = (localCurrentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedGastos = filteredGastos?.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setLocalCurrentPage(page)
  }

  const periodos = Array.from(new Set(gastos?.map(g => g.periodo).filter(Boolean)))

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return
    if (checked) {
      const allGastoIds = (paginatedGastos ?? []).map(gasto => gasto.referenciaId)
      onSelectionChange(allGastoIds)
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectGasto = (gastoId: string, checked: boolean) => {
    if (!onSelectionChange) return
    if (checked) {
      onSelectionChange([gastoId])
    } else {
      onSelectionChange(selectedGastos.filter(id => id !== gastoId))
    }
  }

  const formatCurrency = (amount: number | string, currency: string = "CUP") => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    const symbol = MONEDA_SIMBOLOS[currency] || currency
    return `${symbol} ${numAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getGastoIcon = (tipo: string) => {
    const config = TIPO_GASTO_LABELS[tipo]
    if (!config) return Receipt
    return config.icon as React.ComponentType<{ className?: string }>
  }

  const getGastoDetails = (gasto: GastoPendiente) => {
    const vendorToString = (vendor: unknown) => {
      if (!vendor) return ''
      if (typeof vendor === 'string') return vendor
      if (typeof vendor === 'object' && vendor !== null) {
        return (vendor as { nombre?: string; vendorId?: string }).nombre ??
               (vendor as { nombre?: string; vendorId?: string }).vendorId ?? ''
      }
      return ''
    }

    switch (gasto.tipo) {
      case 'salario':
        return {
          primary: `${gasto?.detalles?.empleado?.nombre} ${gasto?.detalles?.empleado?.apellido}`,
          secondary: gasto?.detalles?.empleado?.cargo,
          extra: `Base: ${formatCurrency(gasto?.detalles?.salarioBases || 0)}`
        }
      case 'gastoDE':
        return {
          primary: gasto?.detalles?.proveedor,
          secondary: gasto.tipo,
        }
      case 'compra':
        return {
          primary: gasto?.detalles?.producto,
          secondary: vendorToString(gasto?.detalles?.vendor),
          extra: `Cant: ${gasto.detalles?.cantidad || 0}`
        }
      default:
        return {
          primary: gasto?.descripcion,
          secondary: '',
          extra: ''
        }
    }
  }

  const selectedCount = selectedGastos.length
  const canReconciliar = selectedCount === 1 && onReconciliar

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
                <Receipt className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-destructive font-medium">Error al cargar los gastos pendientes</p>
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
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Receipt className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                  </div>
                  Gastos Pendientes de Reconciliar
                </CardTitle>

                {canReconciliar && (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={() => {
                        const selectedGasto = filteredGastos?.find(g => selectedGastos.includes(g.referenciaId))
                        if (selectedGasto && onReconciliar) {
                          onReconciliar(selectedGasto)
                        }
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Reconciliar Gasto
                    </Button>
                  </motion.div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar gastos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/80 dark:bg-slate-900/50"
                  />
                </div>

                <div className="flex gap-2">
                  {periodos.length > 0 && (
                    <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
                      <SelectTrigger className="w-[160px] bg-white/80 dark:bg-slate-900/50">
                        <Calendar className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los períodos</SelectItem>
                        {periodos.map(periodo => (
                          <SelectItem key={periodo} value={(periodo ?? '-')}>
                            {periodo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="flex gap-4 text-sm">
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Pendientes: {filteredGastos?.filter((g: GastoPendiente) => g.reconciliado !== true).length}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    Página {localCurrentPage} de {totalPages}
                  </Badge>
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
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
                </div>
              ) : filteredGastos?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <Receipt className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-muted-foreground">No hay gastos</p>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm || periodoFiltro !== "all"
                      ? "No se encontraron gastos que coincidan con los filtros"
                      : "No hay gastos pendientes de reconciliar"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 dark:bg-slate-900/50 hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                          {onSelectionChange && (
                            <TableHead className="w-[50px]">
                              <Checkbox
                                checked={false}
                                onCheckedChange={() => {}}
                                disabled={true}
                              />
                            </TableHead>
                          )}
                          <TableHead className="font-semibold">Tipo</TableHead>
                          <TableHead className="font-semibold">Descripción</TableHead>
                          <TableHead className="font-semibold">Período</TableHead>
                          <TableHead className="font-semibold">Estado</TableHead>
                          <TableHead className="font-semibold">Monto</TableHead>
                          <TableHead className="font-semibold">Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedGastos?.map((gasto) => {
                          const Icon = getGastoIcon(gasto.tipo)
                          const details = getGastoDetails(gasto)
                          const tipoConfig = TIPO_GASTO_LABELS[gasto.tipo]

                          return (
                            <TableRow key={gasto.referenciaId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                              {onSelectionChange && (
                                <TableCell>
                                  <Checkbox
                                    checked={selectedGastos.includes(gasto.referenciaId)}
                                    onCheckedChange={(checked) => handleSelectGasto(gasto.referenciaId, checked as boolean)}
                                  />
                                </TableCell>
                              )}
                              <TableCell>
                                <Badge className={cn("border", tipoConfig?.color || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200/80")}>
                                  <Icon className="h-3 w-3 mr-1" />
                                  {tipoConfig?.label || gasto.tipo}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium text-sm">
                                    {gasto.descripcion}
                                  </div>
                                  {details.secondary && (
                                    <div className="text-xs text-muted-foreground">
                                      {details.secondary}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {gasto.periodo ? (
                                  <Badge variant="secondary" className="text-xs">
                                    {gasto.periodo}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">N/A</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={gasto.reconciliado === true ? "default" : "destructive"}
                                  className="text-xs"
                                >
                                  {gasto.reconciliado === true ? (
                                    <>
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Reconciliado
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pendiente
                                    </>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono">
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                                  {formatCurrency(gasto.monto)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  {formatDate(gasto.createdAt)}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
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
                                  <PaginationEllipsis />
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
