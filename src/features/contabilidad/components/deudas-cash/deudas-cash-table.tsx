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
import { ArrowUpDown, ChevronDown, ChevronRight, Search, AlertCircle, CheckCircle2, Clock, Ban, CreditCard } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import React from "react"
import type { DeudaCash } from "@/app/models/model"
import { calcularSaldoPendienteDeuda, normalizarEstadoDeudaCash } from "@/lib/utils/deuda-cash"

interface DeudasCashTableProps {
  deudas: DeudaCash[]
  isLoading: boolean
  error: any
  onPagar?: (deuda: DeudaCash) => void
}

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
)

/**
 * @description Formatea montos monetarios para la tabla.
 * @param {number} amount - Valor numérico a formatear.
 * @returns {string} Monto con formato local.
 */
function formatTableCurrency(amount: number): string {
  return `$${amount.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * @description Subcomponente para mostrar los pagos agrupados de una deuda.
 * @param {{ row: Row<DeudaCash> }} props - Fila expandida.
 * @returns {JSX.Element} Tabla de pagos agrupados por transferencia.
 */
function PagosExpandidos({ row }: { row: Row<DeudaCash> }) {
  const deuda = row.original;
  const reconciliaciones = (deuda as any).reconciliaciones ?? [];
  const shouldReduceMotion = useReducedMotion()

  const pagosAgrupados = React.useMemo(() => {
    const recs: any[] = [...(reconciliaciones as any[])]
    if (recs.length === 0) return [];

    const grupos: Record<string, { id: string, monto: number, fecha: Date, tipo: string, cuenta: string, cantidad: number }> = {};

    recs.forEach((rec: any) => {
      const idTransferencia = rec.idTransferencia?.trim();
      const reconciliacionId = rec.reconciliacionId;
      const key = idTransferencia || reconciliacionId;
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
          No hay pagos registrados para esta deuda.
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
            {pagosAgrupados.map((pago, idx) => (
              <TableRow key={idx} className="hover:bg-muted/30">
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

/**
 * @description Badge de estado para deudas cash.
 * @param {{ estado: string }} props
 * @returns {JSX.Element} Badge coloreado según estado.
 */
function EstadoBadge({ estado }: { estado: string }) {
  const configs = {
    ACTIVO: {
      variant: "default" as const,
      icon: Clock,
      label: "Activa",
      className: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    },
    PAGADO: {
      variant: "default" as const,
      icon: CheckCircle2,
      label: "Pagada",
      className: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    },
    VENCIDO: {
      variant: "destructive" as const,
      icon: AlertCircle,
      label: "Vencida",
      className: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    },
    CANCELADO: {
      variant: "secondary" as const,
      icon: Ban,
      label: "Cancelada",
      className: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
    },
  }

  const config = configs[estado as keyof typeof configs] || configs.ACTIVO
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

/**
 * @description Tabla de deudas en efectivo con filtros y paginación.
 * @param {DeudasCashTableProps} props - Props del componente.
 * @returns {JSX.Element} Tabla de deudas cash.
 */
export function DeudasCashTable({ deudas, isLoading, error, onPagar }: DeudasCashTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [expanded, setExpanded] = useState({})
  const [estadoFiltro, setEstadoFiltro] = useState<string>("TODOS")
  const shouldReduceMotion = useReducedMotion()

  const columns: ColumnDef<DeudaCash>[] = [
    {
      id: "expander",
      header: () => null,
      cell: ({ row }) => {
        const tienePagos = ((row.original as any).reconciliaciones?.length ?? 0) > 0
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
      id: "busqueda",
      accessorFn: (row) => {
        const proveedor = row.proveedor?.nombre || ""
        const id = String(row.idNumerico)
        return `${id} ${proveedor}`.trim()
      },
      header: () => null,
      cell: () => null,
      enableHiding: true,
    },
    {
      accessorKey: "idNumerico",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          # <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("idNumerico")}</span>,
    },
    {
      id: "proveedor",
      accessorFn: (row) => row.proveedor?.nombre || "—",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Proveedor <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
    },
    {
      accessorKey: "montoCapital",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Capital <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {formatTableCurrency(Number(row.getValue("montoCapital")))}
        </span>
      ),
    },
    {
      id: "saldoPendiente",
      header: "Saldo Pendiente",
      cell: ({ row }) => {
        const cpp = row.original.cuentaPorPagar
        const saldo = cpp
          ? calcularSaldoPendienteDeuda(Number(cpp.montoDeuda), Number(cpp.montoPagado))
          : Number(row.original.montoCapital)
        return (
          <span className={cn("font-medium", saldo > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
            {formatTableCurrency(saldo)}
          </span>
        )
      },
    },
    {
      accessorKey: "moneda",
      header: "Moneda",
      cell: ({ getValue }) => <Badge variant="outline">{getValue() as string}</Badge>,
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row, getValue }) => {
        const cpp = row.original.cuentaPorPagar
        const estado = cpp
          ? normalizarEstadoDeudaCash(row.original.estado, {
              montoDeuda: Number(cpp.montoDeuda),
              montoPagado: Number(cpp.montoPagado),
              estado: cpp.estado,
            })
          : (getValue() as string)
        return <EstadoBadge estado={estado} />
      },
    },
    {
      accessorKey: "fechaOtorgamiento",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Fecha <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString("es-ES"),
    },
    {
      accessorKey: "fechaVencimiento",
      header: "Vencimiento",
      cell: ({ getValue }) => {
        const val = getValue() as string | null
        return val ? new Date(val).toLocaleDateString("es-ES") : "—"
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      cell: ({ row }) => {
        const deuda = row.original
        const cpp = deuda.cuentaPorPagar
        const estado = cpp
          ? normalizarEstadoDeudaCash(deuda.estado, {
              montoDeuda: Number(cpp.montoDeuda),
              montoPagado: Number(cpp.montoPagado),
              estado: cpp.estado,
            })
          : deuda.estado
        const activa = estado === "ACTIVO" || estado === "VENCIDO"
        return (
          <Button
            variant="outline"
            size="sm"
            disabled={!activa}
            onClick={() => onPagar?.(deuda)}
          >
            Registrar Pago
          </Button>
        )
      },
    },
  ]

  const deudasFiltradas = useMemo(() => {
    if (estadoFiltro === "TODOS") return deudas
    return deudas.filter((d) => {
      const cpp = d.cuentaPorPagar
      const estado = cpp
        ? normalizarEstadoDeudaCash(d.estado, {
            montoDeuda: Number(cpp.montoDeuda),
            montoPagado: Number(cpp.montoPagado),
            estado: cpp.estado,
          })
        : d.estado
      return estado === estadoFiltro
    })
  }, [deudas, estadoFiltro])

  const table = useReactTable({
    data: deudasFiltradas,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    state: {
      sorting,
      columnFilters,
      columnVisibility: { busqueda: false, ...columnVisibility },
      expanded,
    },
  })

  if (error) {
    return (
      <Card className={surfaceCardClass}>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>Error al cargar las deudas.</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={surfaceCardClass}>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por # o proveedor..."
              value={(table.getColumn("busqueda")?.getFilterValue() as string) ?? ""}
              onChange={(e) => table.getColumn("busqueda")?.setFilterValue(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Estado:</Label>
            <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="ACTIVO">Activa</SelectItem>
                <SelectItem value="PAGADO">Pagada</SelectItem>
                <SelectItem value="VENCIDO">Vencida</SelectItem>
                <SelectItem value="CANCELADO">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <React.Fragment key={row.id}>
                          <motion.tr
                            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
                            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                            transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
                            className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
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
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                          No hay deudas registradas.
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {table.getFilteredRowModel().rows.length} deuda(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
