'use client'

import { useEffect, useState, useTransition } from "react"
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
import { getFacturasAction } from "@/features/facturas"
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

interface FacturasContentProps {
  initialData?: {
    data: Factura[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
    totalsByStatus: Record<string, number>
  }
}

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

/**
 * @description Componente de contenido para lista de facturas
 * @param {FacturasContentProps} props - Props del componente
 * @returns {JSX.Element} Componente de facturas
 */
export function FacturasContent({ initialData }: FacturasContentProps) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [estadoFilter, setEstadoFilter] = useState<string>("ALL")
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()
  const [response, setResponse] = useState<any>(initialData || null)
  const [isLoading, setIsLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) {
      setResponse(initialData)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    getFacturasAction({ page, limit, estado: estadoFilter === "ALL" ? undefined : estadoFilter, search: search || undefined })
      .then(r => { if (r.success) setResponse(r.data); setIsLoading(false) })
  }, [page, limit, estadoFilter, search, initialData])

  const facturas = response?.data || []
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
          Fecha
          <ArrowUpDown className="h-4 w-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => <div className="whitespace-nowrap">{formatDate(row.original.fechaEmision)}</div>,
      accessorFn: (row) => row.fechaEmision || "",
    },
    {
      id: "total",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Total
          <ArrowUpDown className="h-4 w-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => {
        const total = Number(row.original.total) || 0
  // @ts-expect-error
        return <div className="font-medium">{formatCurrency(total, row.original.moneda || "CUP")}</div>
      },
  // @ts-expect-error
      accessorFn: (row) => Number(row.original.total) || 0,
    },
    {
      id: "estado",
      header: "Estado",
      cell: ({ row }) => <EstadoFacturaBadge estado={row.original.estado} />,
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const factura = row.original
        return (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
  // @ts-expect-error
  // @ts-expect-error
  // @ts-expect-error
  // @ts-expect-error
              <Link href={`/busy/invoice?facturaId=${factura.facturaId}`}>
                <FileText className="h-4 w-4" />
              </Link>
            </Button>
  // @ts-expect-error
  // @ts-expect-error
  // @ts-expect-error
  // @ts-expect-error
            {factura.pdfUrl && (
  // @ts-expect-error
              <Button variant="ghost" size="icon" onClick={() => downloadFile(factura.pdfUrl!, `${factura.numeroFactura}.pdf`)}>
                <Download className="h-4 w-4" />
              </Button>
            )}
  // @ts-expect-error
  // @ts-expect-error
  // @ts-expect-error
  // @ts-expect-error
            <ActualizarEstadoFactura factura={factura} onUpdate={() => {
              getFacturasAction({ page, limit }).then(r => { if (r.success) setResponse(r.data) })
            }} />
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
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  })

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4 space-y-4">
          {/* Header */}
          <motion.div
            className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div className="flex items-center gap-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <motion.div className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center" whileHover={{ scale: 1.05 }}>
                <FileSpreadsheet className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">Facturas</h1>
                <motion.div animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ rotate: { duration: 20, repeat: Infinity }, scale: { duration: 2, repeat: Infinity } }}>
                  <Sparkles className="h-4 w-4 text-yellow-500 inline ml-1" />
                </motion.div>
              </div>
            </motion.div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/busy/invoice">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nueva Factura
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(totalsByStatus).map(([estado, total]) => (
              <Card key={estado} className="p-4">
                <CardContent className="p-0">
                  <div className="text-sm text-muted-foreground">{estado.replace(/_/g, " ")}</div>
  // @ts-expect-error
  // @ts-expect-error
  // @ts-expect-error
  // @ts-expect-error
                  <div className="text-2xl font-bold">{total}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={estadoFilter} onValueChange={(v) => { setEstadoFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="PAGADA">Pagada</SelectItem>
                <SelectItem value="VENCIDA">Vencida</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="border rounded-lg">
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
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No hay resultados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pagination && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Página {pagination.page} de {pagination.totalPages} ({pagination.total} total)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}