"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
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
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useGetFacturasQuery } from "@/lib/redux/services/facturasApi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowUpDown, Download, FileSpreadsheet, PlusCircle, Filter, FileText, Sparkles, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Factura } from "@/app/models/model"
import { getAuthToken } from "@/lib/token"
import { EstadoFacturaBadge } from "@/features/facturas"
import { ActualizarEstadoFactura } from "@/features/facturas"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"

const formatDate = (value?: string) => {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

async function downloadFile(url: string, filename: string) {
  const token = getAuthToken()
  const res = await fetch(url, {
    headers: token ? { Authorization: token } : undefined,
  })
  if (!res.ok) {
    throw new Error("No se pudo descargar el archivo")
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
}

export default function FacturasPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [estadoFilter, setEstadoFilter] = useState<string>("ALL")
  const [search, setSearch] = useState("")
  const { data: response, isLoading, error } = useGetFacturasQuery({
    page,
    limit,
    estado: estadoFilter === "ALL" ? undefined : estadoFilter,
    search: search || undefined,
  })
  
  const facturas = response?.facturas || []
  const pagination = response?.pagination
  const totalsByStatus = response?.totalsByStatus || {}

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  const columns: ColumnDef<Factura>[] = [
    {
      id: "numeroFactura",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Número Factura
          <ArrowUpDown className="h-4 w-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => {
        const factura = row.original
        return (
          <div className="font-medium">
            {factura.numeroFactura}
            <div className="text-xs text-muted-foreground">
              {factura.serie?.prefijo ? `Serie ${factura.serie.prefijo}` : ''}
            </div>
          </div>
        )
      },
      accessorFn: (row) => row.numeroFactura,
    },
    {
      id: "cliente",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Cliente
          <ArrowUpDown className="h-4 w-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => {
        const cliente = row.original.cliente
        return (
          <div>
            <div className="font-medium">{cliente?.nombre || "Sin cliente"}</div>
            {cliente?.telefono && (
              <div className="text-xs text-muted-foreground">{cliente.telefono}</div>
            )}
          </div>
        )
      },
      accessorFn: (row) => row.cliente?.nombre || "",
    },
    {
      id: "fechaEmision",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Fecha Emisión
          <ArrowUpDown className="h-4 w-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => <div>{formatDate(row.original.fechaEmision)}</div>,
      accessorFn: (row) => row.fechaEmision,
    },
    {
      id: "fechaVencimiento",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Fecha Vencimiento
          <ArrowUpDown className="h-4 w-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => <div>{row.original.fechaVencimiento ? formatDate(row.original.fechaVencimiento) : "-"}</div>,
      accessorFn: (row) => row.fechaVencimiento,
    },
    {
      id: "total",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Total
          <ArrowUpDown className="h-4 w-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => (
        <motion.div 
          className="font-medium"
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {formatCurrency(row.original.total)}
        </motion.div>
      ),
      accessorFn: (row) => row.total,
    },
    {
      id: "estado",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Estado
          <ArrowUpDown className="h-4 w-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => {
        const factura = row.original
        return <ActualizarEstadoFactura factura={factura} />
      },
      accessorFn: (row) => row.estado,
    },
    {
      id: "venta",
      header: "Venta Relacionada",
      cell: ({ row }) => {
        const venta = row.original.venta
        if (!venta) return <div className="text-muted-foreground">Sin venta</div>
        
        return (
          <div className="text-sm">
            {venta.producto ? (
              <div>
                <div>{venta.producto.nombre}</div>
                <div className="text-xs text-muted-foreground">Cantidad: {venta.cantidad}</div>
              </div>
            ) : venta.oferta ? (
              <div>
                <div>Oferta {venta.oferta.numeroOferta}</div>
                <div className="text-xs text-muted-foreground">Total: {formatCurrency(venta.oferta.total)}</div>
              </div>
            ) : (
              <div>Venta única</div>
            )}
          </div>
        )
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      cell: ({ row }) => {
        const factura = row.original
        const ventaId = factura.ventaId
        const downloadId = ventaId || factura.idFactura
        
        return (
          <div className="flex items-center gap-2 justify-end">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadFile(`/api/facturas/${downloadId}/pdf`, `factura-${factura.numeroFactura}.pdf`)}
                className="transition-all duration-200"
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadFile(`/api/facturas/${downloadId}/excel`, `factura-${factura.numeroFactura}.xls`)}
                className="transition-all duration-200"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </motion.div>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: facturas,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    manualPagination: true,
    pageCount: pagination?.totalPages || 1,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          {/* Header */}
          <motion.div 
            className="flex justify-between items-center mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <motion.div 
                className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <FileText className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Gestión de Facturas
                </h1>
                <motion.div
                  className="absolute -right-4 -top-1"
                  animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  }}
                >
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                </motion.div>
              </div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button asChild variant="outline">
                <Link href="/busy/invoice">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Ver Ventas
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Resumen por estado */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {Object.entries(totalsByStatus).map(([estado, { count, total }], index) => (
              <motion.div 
                key={estado} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                whileHover={{ y: -4 }}
              >
                <Card className="border-dashed hover:border-primary/30 transition-all duration-200">
                  <div className="h-1 bg-linear-to-r from-primary to-purple-500" />
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Facturas {estado.toLowerCase()}</div>
                        <motion.div 
                          className="text-2xl font-bold"
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 * index }}
                        >
                          {count}
                        </motion.div>
                      </div>
                      <EstadoFacturaBadge estado={estado as Factura['estado']} />
                    </div>
                    <div className="mt-2 text-sm font-medium bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                      {formatCurrency(total)}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Filtros */}
          <motion.div 
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-40 transition-all duration-200 focus:scale-[1.01]">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  <SelectItem value="PAGADA">Pagada</SelectItem>
                  <SelectItem value="ANULADA">Anulada</SelectItem>
                  <SelectItem value="VENCIDA">Vencida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Buscar por número de factura, cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm transition-all duration-200 focus:scale-[1.01]"
            />
          </motion.div>

          {/* Tabla */}
          {isLoading ? (
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-center py-8">
                <motion.div
                  className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="rounded-md border border-dashed dark:border-gray-700">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((column, index) => (
                        <TableHead key={index}>
                          <Skeleton className="h-5 w-full" />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array(5)
                      .fill(0)
                      .map((_, index) => (
                        <TableRow key={index}>
                          {columns.map((_, colIndex) => (
                            <TableCell key={colIndex}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div 
              className="text-center py-8 text-destructive border border-dashed rounded-lg dark:border-gray-700"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-lg font-medium">Error al cargar las facturas</p>
              <p className="text-sm text-muted-foreground">Por favor, intente nuevamente</p>
            </motion.div>
          ) : (
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-md border border-dashed dark:border-gray-700">
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
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row, index) => (
                        <motion.tr
                          key={row.id}
                          data-state={row.getIsSelected() && "selected"}
                          className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="p-4 align-middle">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </motion.tr>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                          >
                            No hay facturas registradas.
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Paginación */}
              <motion.div 
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="text-sm text-muted-foreground">
                  Mostrando {facturas.length} de {pagination?.total || 0} facturas
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="transition-all duration-200"
                  >
                    Anterior
                  </Button>
                  <span className="text-sm">
                    Página {page} de {pagination?.totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(pagination?.totalPages || 1, p + 1))}
                    disabled={page >= (pagination?.totalPages || 1)}
                    className="transition-all duration-200"
                  >
                    Siguiente
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
