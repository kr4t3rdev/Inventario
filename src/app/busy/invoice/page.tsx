"use client"

import { useState } from "react"
import Link from "next/link"
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
import { useGetVentasQuery } from "@/features/ventas/api/ventasApi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowUpDown, Download, FileSpreadsheet, PlusCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Venta } from "@/app/models/model"
import { getAuthToken } from "@/lib/token"

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
  const { data: ventas, isLoading, error } = useGetVentasQuery()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  const columns: ColumnDef<Venta>[] = [
    {
      id: "factura",
      header: "Factura",
      cell: ({ row }) => {
        const factura = row.original.factura
        return (
          <div className="truncate max-w-[120px]">
            {factura?.numeroFactura || row.original.ventaId}
          </div>
        )
      },
      accessorFn: (row) => row.factura?.numeroFactura || row.ventaId,
    },
    {
      id: "cliente",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Cliente
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const cliente = row.original.cliente
        return <div className="text-center">{cliente?.nombre || "Sin cliente"}</div>
      },
      filterFn: (row, columnId, value) => {
        const searchValue = String(value).toLowerCase()
        const cliente = row.original.cliente
        const clienteMatch = cliente?.nombre?.toLowerCase().includes(searchValue) ?? false
        const venta = row.original
        const items = venta.items || []

        if (items.length > 0) {
          const productoMatch = items.some((item) =>
            item.producto?.nombre?.toLowerCase().includes(searchValue),
          )
          return clienteMatch || productoMatch
        }

        if (!venta.productoId) {
          return clienteMatch || "venta única".toLowerCase().includes(searchValue)
        }

        const productoMatch = venta.producto?.nombre?.toLowerCase().includes(searchValue) ?? false
        return clienteMatch || productoMatch
      },
    },
    {
      id: "producto",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Producto
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const venta = row.original
        const producto = venta.producto
        const items = venta.items || []

        if (items.length > 0) {
          const preview = items
            .slice(0, 2)
            .map((item) => `${item.producto?.nombre || 'Producto'} x${item.cantidad}`)
            .join(", ")
          const extra = items.length > 2 ? ` (+${items.length - 2} más)` : ""
          return <div className="text-center">{preview}{extra}</div>
        }

        if (!venta.productoId) {
          return (
            <div className="text-center">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Venta Única
              </span>
            </div>
          )
        }
        return <div className="text-center">{producto?.nombre || "-"}</div>
      },
      filterFn: (row, columnId, value) => {
        const venta = row.original
        const searchValue = String(value).toLowerCase()
        const items = venta.items || []

        if (items.length > 0) {
          return items.some((item) => item.producto?.nombre?.toLowerCase().includes(searchValue))
        }

        if (!venta.productoId) {
          return "venta única".toLowerCase().includes(searchValue)
        }
        if (!venta.producto?.nombre) return false
        return venta.producto.nombre.toLowerCase().includes(searchValue)
      },
    },
    {
      accessorKey: "cantidad",
      header: "Cantidad",
      cell: ({ row }) => {
        const venta = row.original
        const items = venta.items || []
        if (items.length > 0) {
          const totalCantidad = items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0)
          return <div className="text-center">{totalCantidad}</div>
        }
        if (!venta.productoId) return <div className="text-center">-</div>
        return <div className="text-center">{row.getValue("cantidad")}</div>
      },
    },
    {
      accessorKey: "puntoDeVenta.nombre",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Punto de Venta
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const puntoDeVenta = row.original.puntoDeVenta
        return <div className="text-center">{puntoDeVenta?.nombre || "Sin punto de venta"}</div>
      },
    },
    {
      accessorKey: "descuento",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Descuento
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-center">{row.original.descuento ?? "-"}</div>,
    },
    {
      accessorKey: "observaciones",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Observaciones
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-center">{row.original.observaciones || "-"}</div>,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Fecha
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-center">{formatDate(row.original.createdAt)}</div>,
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => <div className="font-medium">{formatCurrency(row.original.total || 0)}</div>,
    },
    {
      id: "acciones",
      header: "Descargas",
      cell: ({ row }) => {
        const venta = row.original
        const factura = venta.factura
        const invoiceNumber = factura?.numeroFactura || venta.ventaId
        return (
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadFile(`/api/facturas/${venta.ventaId}/pdf`, `factura-${invoiceNumber}.pdf`)}
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadFile(`/api/facturas/${venta.ventaId}/excel`, `factura-${invoiceNumber}.tsv`)}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: ventas || [],
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

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Facturas</h1>
            <Button asChild variant="outline">
              <Link href="/busy/sales/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nueva Factura
              </Link>
            </Button>
          </div>

          <div className="flex items-center py-4">
            <Input
              placeholder="Filtrar por cliente o producto..."
              value={(table.getColumn("cliente")?.getFilterValue() as string) ?? ""}
              onChange={(event) => table.getColumn("cliente")?.setFilterValue(event.target.value)}
              className="max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <div className="flex items-center py-4">
                <Skeleton className="h-10 w-64" />
              </div>
              <div className="rounded-md border">
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
            </div>
          ) : error ? (
            <div className="text-center py-4 text-destructive">Error al cargar las facturas</div>
          ) : (
            <div className="space-y-4">
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
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          No hay facturas registradas.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-end space-x-2">
                <div className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} factura(s)</div>
                <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
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
