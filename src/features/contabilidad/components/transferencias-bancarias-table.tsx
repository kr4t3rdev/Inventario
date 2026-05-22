"use client"

import { useState } from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowUpDown,
  Search,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { LazyMotion, m as motion } from "framer-motion"
import { cn, formatCurrency } from "@/lib/utils"

interface CuentaInfo {
  nombreBanco: string
  numeroCuenta: string
  moneda: string
}

interface TransferenciaBancariaRow {
  transferenciaId: string
  numeroComprobante: string
  cuentaOrigen: CuentaInfo
  cuentaDestino: CuentaInfo
  montoOrigen: number
  monedaOrigen: string
  montoDestino: number
  monedaDestino: string
  tasaCambio: number | null
  motivo: string
  descripcion?: string
  fechaTransferencia: string
  comprobanteGenerado: boolean
  createdAt: string
}

interface TransferenciasBancariasTableProps {
  transferencias: TransferenciaBancariaRow[]
  isLoading: boolean
}

export function TransferenciasBancariasTable({ transferencias, isLoading }: TransferenciasBancariasTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columns: ColumnDef<TransferenciaBancariaRow>[] = [
    {
      accessorKey: "numeroComprobante",
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-4 h-8 text-xs uppercase" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Comprobante
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-mono text-xs font-medium">{row.getValue("numeroComprobante")}</div>
      ),
    },
    {
      id: "origen",
      header: "Origen",
      accessorFn: (row) => `${row.cuentaOrigen.nombreBanco} ${row.cuentaOrigen.numeroCuenta}`,
      cell: ({ row }) => (
        <div className="flex flex-col text-sm">
          <span className="font-medium truncate max-w-[160px]">{row.original.cuentaOrigen.nombreBanco}</span>
          <span className="text-xs text-muted-foreground">{row.original.cuentaOrigen.numeroCuenta}</span>
        </div>
      ),
    },
    {
      id: "destino",
      header: "Destino",
      accessorFn: (row) => `${row.cuentaDestino.nombreBanco} ${row.cuentaDestino.numeroCuenta}`,
      cell: ({ row }) => (
        <div className="flex flex-col text-sm">
          <span className="font-medium truncate max-w-[160px]">{row.original.cuentaDestino.nombreBanco}</span>
          <span className="text-xs text-muted-foreground">{row.original.cuentaDestino.numeroCuenta}</span>
        </div>
      ),
    },
    {
      accessorKey: "montoOrigen",
      header: ({ column }) => (
        <Button variant="ghost" className="h-8 text-xs uppercase" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Monto
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-right font-semibold tabular-nums">
          {formatCurrency(row.getValue("montoOrigen"), row.original.monedaOrigen)}
        </div>
      ),
    },
    {
      accessorKey: "motivo",
      header: "Motivo",
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground truncate max-w-[140px]">{row.getValue("motivo")}</div>
      ),
    },
    {
      accessorKey: "comprobanteGenerado",
      header: "Estado",
      cell: ({ row }) => {
        const generado = row.getValue("comprobanteGenerado") as boolean
        return (
          <Badge variant={generado ? "default" : "secondary"} className="text-[10px] whitespace-nowrap">
            {generado ? (
              <><CheckCircle2 className="mr-1 h-3 w-3" /> Comprobante</>
            ) : (
              <><XCircle className="mr-1 h-3 w-3" /> Pendiente</>
            )}
          </Badge>
        )
      },
    },
    {
      accessorKey: "fechaTransferencia",
      header: ({ column }) => (
        <Button variant="ghost" className="h-8 text-xs uppercase" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Fecha
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Calendar className="h-3 w-3" />
          {new Date(row.getValue("fechaTransferencia")).toLocaleDateString()}
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: transferencias || [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-[250px]" />
        <div className="rounded-md border bg-card">
          <div className="p-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por comprobante..."
            value={(table.getColumn("numeroComprobante")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("numeroComprobante")?.setFilterValue(event.target.value)}
            className="pl-9 w-full sm:w-[300px]"
          />
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <div className="bg-muted p-4 rounded-full mb-3">
                      <ArrowRightLeft className="h-8 w-8 opacity-50" />
                    </div>
                    <p className="font-medium">No se encontraron transferencias</p>
                    <p className="text-sm opacity-70">Crea una nueva transferencia para comenzar</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Anterior
        </Button>
        <div className="text-sm text-muted-foreground">
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Siguiente
        </Button>
      </div>
    </motion.div>
  )
}
