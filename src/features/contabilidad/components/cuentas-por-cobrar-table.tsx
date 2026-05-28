"use client"

import { useState, useMemo } from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
  Row,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowUpDown, ChevronDown, ChevronRight, Search, FileText, CreditCard, AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { CuentaPorCobrar } from "@/app/models/model"
import { Badge } from "@/components/ui/badge"
import React from "react"
import { getAuthToken } from "@/lib/token"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LazyMotion, m as motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface CuentasPorCobrarTableProps {
  cuentas: CuentaPorCobrar[]
  isLoading: boolean
  error: any
  onPagar?: (cuenta: CuentaPorCobrar) => void
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
}

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

/**
 * @description Formatea montos monetarios estáticos para la tabla.
 * @param {number} amount - Valor numérico a formatear.
 * @returns {string} Monto con símbolo y formato local.
 */
function formatTableCurrency(amount: number): string {
  return `$${amount.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Subcomponente para mostrar los pagos agrupados
function PagosExpandidos({ row }: { row: Row<CuentaPorCobrar> }) {
  const cuenta = row.original;
  const reconciliaciones = (cuenta as any)._reconciliaciones ?? cuenta.factura?.venta?.reconciliaciones;
  const shouldReduceMotion = useReducedMotion()

  // Agrupar por idTransferencia
  const pagosAgrupados = React.useMemo(() => {
    const reconciliacionesConFallback: any[] = [...((reconciliaciones ?? []) as any[])]

    if (reconciliacionesConFallback.length === 0) return [];

    const grupos: Record<string, { id: string, monto: number, fecha: Date, tipo: string, cuenta: string, cantidad: number }> = {};

    reconciliacionesConFallback.forEach((rec: any) => {
      // Usar idTransferencia como identificador principal (el valor que se ingresa en reconciliación)
      const idTransferencia = rec.idTransferencia?.trim();
      const reconciliacionId = rec.reconciliacionId;
      
      // La key para agrupar: si hay idTransferencia, úsalo; si no, usa reconciliacionId
      const key = idTransferencia || reconciliacionId;
      
      // El label a mostrar: priorizar idTransferencia si existe
      const label = idTransferencia || `Ref: ${reconciliacionId.slice(-8)}`;
      
      if (!grupos[key]) {
        grupos[key] = {
          id: label,
          monto: 0,
          fecha: new Date(rec.fechaReconciliacion),
          tipo: rec.tipoPago?.nombre || 'Desconocido',
          cuenta: rec.cuentaBancaria?.nombreBanco || 'Desconocido',
          cantidad: 0
        };
      }
      grupos[key].monto += Number(rec.monto);
      grupos[key].cantidad += 1;
    });

    return Object.values(grupos);
  }, [reconciliaciones]);

  if (pagosAgrupados.length === 0) {
    return (
      <motion.div 
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
        exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
        className="p-6 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          No hay pagos registrados para esta factura.
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
      exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
      className="p-4 bg-muted/30 rounded-lg border border-l-4 border-l-primary/30 ml-4 mt-2 mb-2"
    >
      <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <span>Detalle de Transferencias y Pagos</span>
        <Badge variant="secondary" className="text-xs font-normal">
          {pagosAgrupados.length} transacciones
        </Badge>
      </h4>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-xs w-[200px] font-semibold">ID Transferencia / Referencia</TableHead>
              <TableHead className="text-xs font-semibold">Fecha</TableHead>
              <TableHead className="text-xs font-semibold">Método</TableHead>
              <TableHead className="text-xs font-semibold">Cuenta Destino</TableHead>
              <TableHead className="text-xs text-center font-semibold">Cant. Pagos</TableHead>
              <TableHead className="text-xs text-right font-semibold">Importe Transferencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagosAgrupados.map((pago) => (
              <TableRow key={pago.id} className="hover:bg-muted/30">
                <TableCell className="text-xs font-mono font-medium">{pago.id}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{pago.fecha.toLocaleDateString()}</TableCell>
                <TableCell className="text-xs">{pago.tipo}</TableCell>
                <TableCell className="text-xs">{pago.cuenta}</TableCell>
                <TableCell className="text-xs text-center">
                  <Badge variant="outline" className="text-xs">
                    {pago.cantidad}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-right font-medium text-green-600">
                  {formatTableCurrency(pago.monto)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}

async function downloadFile(url: string, filename: string) {
  try {
    const token = getAuthToken()
    const res = await fetch(url, {
      headers: token ? { Authorization: token } : undefined,
    })
    if (!res.ok) {
      return false
    }
    const blob = await res.blob()
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
    return true
  } catch (error) {
    console.error("Error al descargar factura:", error)
    return false
  }
}

// Componente para el badge de antigüedad
function AgingBadge({ rango }: { rango: string }) {
  const config: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    '0-30': {
      label: 'Al día',
      className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
      icon: CheckCircle2,
    },
    '31-60': {
      label: '30+ días',
      className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
      icon: Clock,
    },
    '61-90': {
      label: '60+ días',
      className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
      icon: AlertCircle,
    },
    '90+': {
      label: '90+ días',
      className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
      icon: AlertCircle,
    },
  };

  const cfg = config[rango] ?? config['0-30'];
  const Icon = cfg.icon;

  return (
    <Badge variant="outline" className={`flex items-center gap-1.5 w-fit ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

// Componente para el badge de estado mejorado
function EstadoBadge({ estado }: { estado: string }) {
  const configs = {
    PENDIENTE: {
      variant: "destructive" as const,
      icon: AlertCircle,
      label: "Pendiente",
      className: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
    },
    PAGADA: {
      variant: "default" as const,
      icon: CheckCircle2,
      label: "Pagada",
      className: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
    },
    PARCIAL: {
      variant: "secondary" as const,
      icon: Clock,
      label: "Parcial",
      className: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
    }
  }

  const config = configs[estado as keyof typeof configs] || configs.PENDIENTE
  const Icon = config.icon

  return (
    <Badge 
      variant={config.variant}
      className={`flex items-center gap-1.5 w-fit ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

export function CuentasPorCobrarTable({
  cuentas, isLoading, error, onPagar,
  page, totalPages, onPageChange,
}: CuentasPorCobrarTableProps) {
  
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [expanded, setExpanded] = useState({})
  const [estadoFiltro, setEstadoFiltro] = useState<string>("TODOS")
  const [downloadInProgressKey, setDownloadInProgressKey] = useState<string | null>(null)
  const shouldReduceMotion = useReducedMotion()

  const columns: ColumnDef<CuentaPorCobrar>[] = [
    {
      id: "facturaFiltro",
      accessorFn: (row) => {
        const idFactura = row.facturaId || row.factura?.idFactura || ""
        const numero = row.numeroFactura || row.factura?.numeroFactura || ""
        const cliente = row.cliente?.nombre || ""
        return `${idFactura} ${numero} ${cliente}`.trim()
      },
      header: () => null,
      cell: () => null,
      enableHiding: true,
    },
    {
      id: "expander",
      header: () => null,
      cell: ({ row }) => {
        const tienePagos = ((row.original as any)._reconciliaciones?.length > 0) ||
                          (row.original.factura?.venta?.reconciliaciones && 
                          row.original.factura?.venta?.reconciliaciones.length > 0)
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 w-11 p-0"
                  onClick={() => row.toggleExpanded()}
                  disabled={!tienePagos}
                  aria-label={row.getIsExpanded() ? "Contraer detalles" : "Expandir detalles"}
                >
                  {row.getIsExpanded() ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className={`h-4 w-4 ${tienePagos ? 'text-primary' : 'text-muted-foreground'}`} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tienePagos ? (row.getIsExpanded() ? "Ver menos" : "Ver pagos") : "Sin pagos registrados"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      id: "idFactura",
      header: "ID Factura",
      cell: ({ row }) => {
        const cuenta = row.original as CuentaPorCobrar
        const idFactura = cuenta.facturaId || cuenta.factura?.idFactura
        if (!idFactura) return <div className="text-muted-foreground">-</div>
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="font-mono text-xs cursor-help">{idFactura.slice(-8)}</div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono text-xs">{idFactura}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      id: "numeroFactura",
      header: "Factura",
      cell: ({ row }) => {
        const cuenta = row.original as CuentaPorCobrar;
        if (cuenta.numeroFactura) {
          return <div className="font-medium text-foreground">{cuenta.numeroFactura}</div>;
        }
        if (cuenta.factura?.numeroFactura) {
          return <div className="font-medium text-foreground">{cuenta.factura.numeroFactura}</div>;
        }
        if (cuenta.facturaId) {
          return <div className="text-muted-foreground text-xs">{cuenta.facturaId.slice(-8)}</div>;
        }
        return <div className="text-muted-foreground">-</div>;
      },
    },
    {
      id: "cliente",
      accessorFn: (row) => row.cliente?.nombre,
      header: ({ column }) => (
        <Button 
          variant="ghost" 
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 -ml-2"
        >
          Cliente
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const nombre = row.getValue("cliente") as string
        return (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
              {nombre ? nombre.charAt(0).toUpperCase() : "?"}
            </div>
            <span className="font-medium">{nombre || 'Desconocido'}</span>
          </div>
        )
      },
    },
    {
      id: "totalFactura",
      header: "Total",
      cell: ({ row }) => {
        const cuenta = row.original as CuentaPorCobrar
        const total = Number(cuenta.totalFactura ?? cuenta.totalVenta ?? cuenta.factura?.total ?? 0)
        return <div className="font-semibold text-foreground tabular-nums">
          {formatTableCurrency(total)}
        </div>
      },
    },
    {
      id: "pendiente",
      header: "Pendiente",
      cell: ({ row }) => {
        const cuenta = row.original as CuentaPorCobrar;
        const saldo = Number.isFinite(Number(cuenta.saldoFactura))
          ? Math.max(0, Number(cuenta.saldoFactura))
          : Math.max(0, Number(cuenta.montoDeuda) - Number(cuenta.montoPagado))
        return (
          <div className={`font-bold tabular-nums ${saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatTableCurrency(saldo)}
          </div>
        )
      },
    },
    {
      id: "antiguedad",
      header: "Antigüedad",
      cell: ({ row }) => {
        const cuenta = row.original as CuentaPorCobrar;
        const rango = (cuenta as any).rangoAntiguedad ?? '0-30';
        return <AgingBadge rango={rango} />;
      },
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => {
        const estado = row.getValue("estado") as string
        return <EstadoBadge estado={estado} />
      },
    },
    {
      accessorKey: "createdAt",
      header: "Fecha",
      cell: ({ row }) => (
        <div className="text-muted-foreground text-sm">
          {new Date(row.getValue("createdAt")).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })}
        </div>
      ),
    },
    {
      id: "acciones",
      header: "Acciones",
      cell: ({ row }) => {
        const cuenta = row.original
        const saldoPendiente = Number.isFinite(Number(cuenta.saldoFactura))
          ? Number(cuenta.saldoFactura)
          : Number(cuenta.montoDeuda) - Number(cuenta.montoPagado)
        const puedePagar = saldoPendiente > 0.01 && cuenta.estado !== "PAGADA"
        
        const ventaId = cuenta.factura?.ventaId || cuenta.factura?.idFactura
        const invoiceNumber = cuenta.factura?.numeroFactura || cuenta.numeroFactura || cuenta.facturaId?.slice(-8) || "sin-factura"
        const downloadKey = cuenta.id || cuenta.facturaId || invoiceNumber
        const isDownloading = downloadInProgressKey === downloadKey
        
        return (
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={async () => {
                      if (!ventaId) {
                        toast.error("No hay factura disponible para descargar")
                        return
                      }
                      setDownloadInProgressKey(downloadKey)
                      const downloaded = await downloadFile(
                        `/api/facturas/${ventaId}/pdf`,
                        `factura-${invoiceNumber}.pdf`
                      )
                      setDownloadInProgressKey((currentKey) =>
                        currentKey === downloadKey ? null : currentKey
                      )
                      if (downloaded) {
                        toast.success("Factura descargada correctamente")
                      } else {
                        toast.error("No se pudo descargar la factura")
                      }
                    }}
                    disabled={!ventaId || isDownloading}
                    aria-label="Descargar PDF de la factura"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isDownloading ? "Descargando..." : "Descargar factura PDF"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {onPagar && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={puedePagar ? "default" : "ghost"}
                      size="sm"
                      onClick={() => onPagar(cuenta)}
                      disabled={!puedePagar}
                      className={cn(
                        "h-11 px-4",
                        puedePagar ? "bg-primary hover:bg-primary/90" : ""
                      )}
                    >
                      {puedePagar ? 'Pagar' : 'Pagado'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{puedePagar ? "Registrar pago" : "Factura ya pagada"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )
      },
    },
  ]

  // Filtrar por estado
  const cuentasFiltradas = useMemo(() => {
    if (estadoFiltro === "TODOS") return cuentas
    return cuentas.filter(c => c.estado === estadoFiltro)
  }, [cuentas, estadoFiltro])

  const table = useReactTable({
    data: cuentasFiltradas,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    state: {
      sorting,
      columnFilters,
      columnVisibility: {
        facturaFiltro: false,
        ...columnVisibility,
      },
      rowSelection,
      expanded,
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-[300px]" />
          <Skeleton className="h-10 w-[150px]" />
        </div>
        <Skeleton className="w-full h-100" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-destructive/5 rounded-lg border border-destructive/20">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-destructive mb-2">Error al cargar las cuentas por cobrar</h3>
        <p className="text-muted-foreground">Por favor, intente nuevamente más tarde.</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filtros y búsqueda */}
        <Card className={surfaceCardClass}>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-[300px]">
                  <Label htmlFor="cuentas-por-cobrar-search" className="sr-only">
                    Buscar cuentas por cobrar
                  </Label>
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cuentas-por-cobrar-search"
                    aria-label="Buscar cuentas por cobrar por ID, factura o cliente"
                    placeholder="Buscar por ID, factura o cliente..."
                    value={(table.getColumn("facturaFiltro")?.getFilterValue() as string) ?? ""}
                    onChange={(event) => table.getColumn("facturaFiltro")?.setFilterValue(event.target.value)}
                    className="pl-9 bg-white/50 dark:bg-slate-900/5"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="cuentas-por-cobrar-estado" className="sr-only">
                  Filtrar cuentas por cobrar por estado
                </Label>
                <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
                  <SelectTrigger
                    id="cuentas-por-cobrar-estado"
                    aria-label="Filtrar cuentas por cobrar por estado"
                    className="w-[140px] bg-white/50 dark:bg-slate-900/5"
                  >
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                    <SelectItem value="PARCIAL">Parciales</SelectItem>
                    <SelectItem value="PAGADA">Pagadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card className={surfaceCardClass}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/5">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="font-semibold text-foreground">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    <AnimatePresence>
                      {table.getRowModel().rows.map((row, index) => (
                        <React.Fragment key={row.id}>
                          <motion.tr 
                            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                            transition={{
                              delay: shouldReduceMotion ? 0 : Math.min(index, 5) * 0.02,
                              duration: shouldReduceMotion ? 0 : 0.18
                            }}
                            data-state={row.getIsSelected() && "selected"}
                            className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/5 border-b border-slate-200/60 dark:border-slate-800/60 last:border-0"
                          >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="py-3">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </motion.tr>
                        {row.getIsExpanded() && (
                          <motion.tr
                            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                            transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
                          >
                            <TableCell colSpan={columns.length} className="p-0 border-0 bg-muted/5">
                              <PagosExpandidos row={row} />
                            </TableCell>
                          </motion.tr>
                        )}
                      </React.Fragment>
                    ))}
                  </AnimatePresence>
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <FileText className="h-10 w-10 mb-3 opacity-50" />
                        <p className="text-sm">No se encontraron cuentas por cobrar</p>
                        <p className="text-xs mt-1">Prueba ajustando los filtros de búsqueda</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

        {/* Paginación */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-sm text-muted-foreground">
            Mostrando <span className="font-medium text-foreground">{cuentasFiltradas.length}</span> registros
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onPageChange?.((page ?? 1) - 1)} 
              disabled={!page || page <= 1}
              className="h-8"
            >
              Anterior
            </Button>
            <div className="text-sm text-muted-foreground px-2">
              Página {page ?? 1} de {totalPages ?? 1}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onPageChange?.((page ?? 1) + 1)} 
              disabled={!totalPages || (page ?? 1) >= totalPages}
              className="h-8"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
