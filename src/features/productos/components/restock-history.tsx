"use client"

import { useState } from "react"
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
  useReactTable,
} from "@tanstack/react-table"
import {
  Calendar,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  Building2,
  User,
  History
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/utils"

// Interface matching the API response
interface RestockHistoryItem {
  id: string
  fecha: string
  cantidad: number
  precioCostoAnterior: number
  precioCostoNuevo: number
  precioVentaAnterior: number
  precioVentaNuevo: number
  totalCompra: number
  descripcion: string | null
  tipoOperacion: 'restock_same_prices' | 'restock_new_instance' | 'restock_price_change'
  productInstance?: {
    id: string
    nombre: string
    precioCosto: number
    precioVenta: number
  }
  vendor: {
    nombre: string
    contacto: string | null
  }
}

interface RestockHistoryResponse {
  history: RestockHistoryItem[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  summary: {
    totalRestocks: number
    totalQuantityAdded: number
    totalCostSpent: number
    averageCostPerRestock: number
    priceChanges: number
  }
}

interface RestockHistoryProps {
  data: RestockHistoryResponse | undefined
  isLoading: boolean
  error: unknown
}

// Loading spinner component
function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <motion.div
      className="border-2 border-primary border-t-transparent rounded-full"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  )
}

// Pulse skeleton
function PulseSkeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={`bg-muted rounded ${className}`}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  )
}

// Summary card component with animation
function SummaryCard({ 
  title, 
  value, 
  className, 
  delay = 0 
}: { 
  title: string; 
  value: string | number; 
  className: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className={className}>
        <CardContent className="p-4">
          <motion.div 
            className="text-sm font-medium opacity-90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2 }}
          >
            {title}
          </motion.div>
          <motion.div 
            className="text-2xl font-bold"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.3, duration: 0.3 }}
          >
            {value}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function RestockHistory({ data, isLoading, error }: RestockHistoryProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "fecha", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getOperationBadge = (tipoOperacion: RestockHistoryItem['tipoOperacion']) => {
    switch (tipoOperacion) {
      case 'restock_same_prices':
        return <Badge variant="secondary" className="text-xs">Sin cambio de precios</Badge>
      case 'restock_price_change':
        return <Badge variant="outline" className="text-xs">Cambio de precios</Badge>
      default:
        return <Badge variant="secondary" className="text-xs">Restock</Badge>
    }
  }

  const getPriceChangeIndicator = (anterior: number, nuevo: number) => {
    if (anterior === nuevo) {
      return <Minus className="h-3 w-3 text-muted-foreground" />
    } else if (nuevo > anterior) {
      return <TrendingUp className="h-3 w-3 text-green-600" />
    } else {
      return <TrendingDown className="h-3 w-3 text-red-600" />
    }
  }

  const columns: ColumnDef<RestockHistoryItem>[] = [
    {
      accessorKey: "fecha",
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <Calendar className="mr-2 h-4 w-4" />
            Fecha
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="text-sm">
          {formatDate(row.getValue("fecha"))}
        </div>
      ),
    },
    {
      accessorKey: "cantidad",
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <Package className="mr-2 h-4 w-4" />
            Cantidad
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="text-center font-medium text-green-600">
          +{row.getValue("cantidad")}
        </div>
      ),
    },
    {
      id: "precioCosto",
      header: "Precio Costo",
      cell: ({ row }) => {
        const anterior = row.original.precioCostoAnterior
        const nuevo = row.original.precioCostoNuevo
        const indicator = getPriceChangeIndicator(anterior, nuevo)

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {formatCurrency(anterior)} → {formatCurrency(nuevo)}
              {indicator}
            </div>
            {anterior !== nuevo && (
              <div className="text-xs">
                <Badge variant={nuevo > anterior ? "destructive" : "default"} className="text-xs">
                  {nuevo > anterior ? '+' : ''}{formatCurrency(nuevo - anterior)}
                </Badge>
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: "precioVenta",
      header: "Precio Venta",
      cell: ({ row }) => {
        const anterior = row.original.precioVentaAnterior
        const nuevo = row.original.precioVentaNuevo
        const indicator = getPriceChangeIndicator(anterior, nuevo)

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {formatCurrency(anterior)} → {formatCurrency(nuevo)}
              {indicator}
            </div>
            {anterior !== nuevo && (
              <div className="text-xs">
                <Badge variant={nuevo > anterior ? "default" : "destructive"} className="text-xs">
                  {nuevo > anterior ? '+' : ''}{formatCurrency(nuevo - anterior)}
                </Badge>
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "totalCompra",
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Total Compra
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="text-right font-medium text-red-600">
          {formatCurrency(row.getValue("totalCompra"))}
        </div>
      ),
    },
    {
      id: "vendor",
      header: "Proveedor",
      cell: ({ row }) => {
        const vendor = row.original.vendor
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              {vendor.nombre}
            </div>
            {vendor.contacto && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {vendor.contacto}
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: "tipoOperacion",
      header: "Tipo",
      cell: ({ row }) => getOperationBadge(row.original.tipoOperacion),
    },
    {
      accessorKey: "descripcion",
      header: "Descripción",
      cell: ({ row }) => {
        const descripcion = row.getValue("descripcion") as string | null
        return (
          <div className="max-w-[200px] truncate text-sm text-muted-foreground">
            {descripcion || "Sin descripción"}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: data?.history || [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  if (isLoading) {
    return (
      <motion.div 
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Summary skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, index) => (
            <Card key={index} className="bg-muted/50">
              <CardContent className="p-4">
                <PulseSkeleton className="h-4 w-20 mb-2" />
                <PulseSkeleton className="h-6 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Loading state */}
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <LoadingSpinner size={40} />
          <p className="text-muted-foreground">Cargando historial de restock...</p>
        </div>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div 
        className="text-center py-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-destructive text-lg font-medium mb-2">Error al cargar el historial</div>
        <p className="text-muted-foreground">Hubo un problema al obtener los datos. Intente nuevamente.</p>
      </motion.div>
    )
  }

  if (!data || data.history.length === 0) {
    return (
      <motion.div 
        className="text-center py-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <History className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
        </motion.div>
        <h3 className="text-lg font-medium text-muted-foreground mb-2">No hay historial de restock</h3>
        <p className="text-sm text-muted-foreground">Este producto aún no tiene registros de restock.</p>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Restocks"
          value={data.summary.totalRestocks}
          className="bg-linear-to-br from-blue-50 to-blue-100 border-blue-200"
          delay={0}
        />
        <SummaryCard
          title="Cantidad Agregada"
          value={`+${data.summary.totalQuantityAdded}`}
          className="bg-linear-to-br from-green-50 to-green-100 border-green-200"
          delay={0.1}
        />
        <SummaryCard
          title="Costo Total"
          value={formatCurrency(data.summary.totalCostSpent)}
          className="bg-linear-to-br from-red-50 to-red-100 border-red-200"
          delay={0.2}
        />
        <SummaryCard
          title="Cambios de Precio"
          value={data.summary.priceChanges}
          className="bg-linear-to-br from-orange-50 to-orange-100 border-orange-200"
          delay={0.3}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <Separator />
      </motion.div>

      {/* Filters */}
      <motion.div 
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Input
          placeholder="Filtrar por proveedor..."
          value={(table.getColumn("vendor")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("vendor")?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
        <Input
          placeholder="Filtrar por descripción..."
          value={(table.getColumn("descripcion")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("descripcion")?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
      </motion.div>

      {/* Table */}
      <motion.div 
        className="rounded-md border overflow-x-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <Table className="min-w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap px-4 py-3">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <AnimatePresence>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.03, duration: 0.3 }}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </motion.tr>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No se encontraron registros de restock.
                  </TableCell>
                </TableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </motion.div>

      {/* Pagination */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <div className="text-sm text-muted-foreground">
          Mostrando {table.getRowModel().rows.length} de {data.summary.totalRestocks} registros
        </div>
        <div className="flex items-center space-x-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Siguiente
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}
