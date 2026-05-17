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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  ArrowUpDown, 
  Pencil, 
  Trash2Icon, 
  Search, 
  Filter, 
  ArrowRightLeft, 
  Building2, 
  Store,
  Calendar,
  MoreHorizontal,
  FileText,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  AlertTriangle
} from "lucide-react"
import { Transferencia, EstadoTransferencia } from "@/app/models/model"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { LazyMotion, m as motion } from "framer-motion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TransferenciasTableProps {
  transferencias: Transferencia[]
  isLoading: boolean
  error: any
  onDelete: (id: string) => void
  onConfirmarRecepcion?: (transferencia: Transferencia) => void
}

export function TransferenciasTable({ transferencias, isLoading, error, onDelete, onConfirmarRecepcion }: TransferenciasTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  const columns: ColumnDef<Transferencia>[] = [
    {
      accessorKey: "transferenciaId",
      header: "ID",
      cell: ({ row }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="font-mono text-xs text-muted-foreground truncate max-w-[80px] cursor-help">
                {row.getValue("transferenciaId")}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>ID: {row.getValue("transferenciaId")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {    
      accessorKey: "productoNombre",
      header: ({ column }) => {
        return (
          <Button variant="ghost" className="-ml-4 h-8 text-xs uppercase" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Producto
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium truncate max-w-[180px]">{row.getValue("productoNombre")}</span>
        </div>
      ),
    },
    {
      accessorKey: "cantidad",
      header: ({ column }) => (
        <div className="text-center text-xs uppercase">Cant.</div>
      ),
      cell: ({ row }) => (
        <div className="text-center font-semibold bg-muted/40 rounded-md py-1 px-2 min-w-[3rem]">
          {row.getValue("cantidad")}
        </div>
      ),
    },
    {
      accessorKey: "estado",
      header: ({ column }) => {
        return (
          <Button variant="ghost" className="-ml-4 h-8 text-xs uppercase" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Estado
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const estado = row.getValue("estado") as EstadoTransferencia
        let variant: "default" | "secondary" | "destructive" | "outline" = "default"
        let icon = <Clock className="mr-1 h-3 w-3" />
        const label = estado

        switch (estado) {
          case 'PENDIENTE':
            variant = "secondary"
            icon = <Clock className="mr-1 h-3 w-3" />
            break
          case 'EN_TRANSITO':
            variant = "outline"
            icon = <Truck className="mr-1 h-3 w-3" />
            break
          case 'COMPLETADA':
            variant = "default"
            icon = <CheckCircle className="mr-1 h-3 w-3" />
            break
          case 'CANCELADA':
            variant = "destructive"
            icon = <XCircle className="mr-1 h-3 w-3" />
            break
          case 'PARCIAL':
            variant = "outline"
            icon = <AlertTriangle className="mr-1 h-3 w-3" />
            break
        }

        return (
          <Badge variant={variant} className="text-[10px] whitespace-nowrap px-2 py-0.5 h-6 flex items-center w-fit">
            {icon}
            {label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "tipoTransferencia",
      header: "Tipo de Movimiento",
      cell: ({ row }) => {
        const tipo = row.getValue("tipoTransferencia") as string
        let variant: "default" | "secondary" | "destructive" | "outline" = "default"
        let icon = <ArrowRightLeft className="mr-1 h-3 w-3" />
        let label = tipo

        if (tipo.includes("Almacén → Almacén")) {
          variant = "default"
          icon = <Building2 className="mr-1 h-3 w-3" />
          label = "Almacén ⇄ Almacén"
        } else if (tipo.includes("Almacén → Punto de Venta")) {
          variant = "secondary"
          icon = <Store className="mr-1 h-3 w-3" />
          label = "Almacén ➝ POS"
        } else if (tipo.includes("Punto de Venta → Almacén")) {
          variant = "outline"
          icon = <Building2 className="mr-1 h-3 w-3" />
          label = "POS ➝ Almacén"
        } else if (tipo.includes("Punto de Venta → Punto de Venta")) {
          variant = "destructive"
          icon = <ArrowRightLeft className="mr-1 h-3 w-3" />
          label = "POS ⇄ POS"
        }

        return (
          <Badge variant={variant} className="text-[10px] whitespace-nowrap px-2 py-0.5 h-6 flex items-center w-fit">
            {icon}
            {label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "origenNombre",
      header: "Origen",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <div className="h-1.5 w-1.5 rounded-full bg-red-400/70" />
          <span className="truncate max-w-[120px]">{row.getValue("origenNombre")}</span>
        </div>
      ),
    },
    {
      accessorKey: "destinoNombre",
      header: "Destino",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <span className="truncate max-w-[120px]">{row.getValue("destinoNombre")}</span>
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button variant="ghost" className="h-8 text-xs uppercase" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Fecha
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Calendar className="h-3 w-3" />
          {new Date(row.getValue("createdAt")).toLocaleDateString()}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const transferencia = row.original
        const puedeConfirmar = transferencia.estado === 'PENDIENTE' || transferencia.estado === 'EN_TRANSITO'

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              {puedeConfirmar && onConfirmarRecepcion && (
                <DropdownMenuItem 
                  onClick={() => onConfirmarRecepcion(transferencia)}
                  className="cursor-pointer text-green-600 focus:text-green-600"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar Recepción
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href={`/busy/transferencias/edit/${transferencia.transferenciaId}`} className="flex items-center cursor-pointer">
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href={`/busy/transferencias/${transferencia.transferenciaId}`} className="flex items-center cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver detalles
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(transferencia.transferenciaId)}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2Icon className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-[250px]" />
          <Skeleton className="h-10 w-[200px]" />
        </div>
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-destructive/5 text-destructive">
        <div className="bg-destructive/10 p-3 rounded-full mb-3">
          <ArrowRightLeft className="h-6 w-6" />
        </div>
        <h3 className="font-semibold mb-1">Error al cargar transferencias</h3>
        <p className="text-sm opacity-80">No se pudieron obtener los datos. Intente recargar la página.</p>
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
            placeholder="Buscar por producto..."
            value={(table.getColumn("productoNombre")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("productoNombre")?.setFilterValue(event.target.value)}
            className="pl-9 w-full sm:w-[300px]"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={(table.getColumn("tipoTransferencia")?.getFilterValue() as string) || "all"}
            onValueChange={(v) => table.getColumn("tipoTransferencia")?.setFilterValue(v === "" || v === "all" ? undefined : v)}
          >
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Tipo de transferencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="Almacén → Almacén">Almacén ⇄ Almacén</SelectItem>
              <SelectItem value="Almacén → Punto de Venta">Almacén ➝ POS</SelectItem>
              <SelectItem value="Punto de Venta → Almacén">POS ➝ Almacén</SelectItem>
              <SelectItem value="Punto de Venta → Punto de Venta">POS ⇄ POS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
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
                      <Search className="h-8 w-8 opacity-50" />
                    </div>
                    <p className="font-medium">No se encontraron transferencias</p>
                    <p className="text-sm opacity-70">Intenta ajustar los filtros de búsqueda</p>
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
