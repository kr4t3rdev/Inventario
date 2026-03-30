"use client"

import React, { useState } from "react"
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
import { Eye, PlayCircle, Undo2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Anticipo } from "@/app/models/model"
import { anticiposColumns } from "./anticipos-columns"
import { AnticiposFilters, type AnticipoFilters } from "./anticipos-filters"
import { cn } from "@/lib/utils"

interface AnticiposTableProps {
  anticipos: Anticipo[]
  isLoading: boolean
  error?: any
  onVerDetalle?: (anticipo: Anticipo) => void
  onEjecutar?: (anticipo: Anticipo) => void
  onRevertir?: (anticipo: Anticipo) => void
}

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
)

/**
 * @description Tabla de anticipos con filtros, paginación y acciones
 * @param {AnticiposTableProps} props - Props del componente
 * @returns {JSX.Element} Tabla de anticipos
 */
export function AnticiposTable({
  anticipos,
  isLoading,
  error,
  onVerDetalle,
  onEjecutar,
  onRevertir,
}: AnticiposTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [filters, setFilters] = useState<AnticipoFilters>({})

  const columns: ColumnDef<Anticipo>[] = [
    ...anticiposColumns,
    {
      id: "actions",
      cell: ({ row }) => {
        const anticipo = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onVerDetalle?.(anticipo)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Detalle
              </DropdownMenuItem>
              {anticipo.estado === "RESERVADO" && anticipo.saldoDisponible && Number(anticipo.saldoDisponible) > 0 && (
                <DropdownMenuItem onClick={() => onEjecutar?.(anticipo)}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Ejecutar
                </DropdownMenuItem>
              )}
              {anticipo.estado === "EJECUTADO" && (
                <DropdownMenuItem onClick={() => onRevertir?.(anticipo)}>
                  <Undo2 className="mr-2 h-4 w-4" />
                  Revertir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: anticipos,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  const handleFilterChange = (newFilters: AnticipoFilters) => {
    setFilters(newFilters)
    // Aplicar filtros de tipo y estado
    const newColumnFilters: ColumnFiltersState = []
    
    if (newFilters.tipo) {
      newColumnFilters.push({ id: "tipo", value: newFilters.tipo })
    }
    if (newFilters.estado) {
      newColumnFilters.push({ id: "estado", value: newFilters.estado })
    }
    if (newFilters.moneda) {
      newColumnFilters.push({ id: "moneda", value: newFilters.moneda })
    }
    
    setColumnFilters(newColumnFilters)
  }

  if (error) {
    return (
      <Card className={surfaceCardClass}>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            Error al cargar los anticipos: {error.message || "Error desconocido"}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <AnticiposFilters onFilterChange={handleFilterChange} initialFilters={filters} />
      
      <Card className={surfaceCardClass}>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {columns.map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
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
                      No se encontraron anticipos
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Paginación */}
      <div className="flex items-center justify-end space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Siguiente
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </span>
      </div>
    </div>
  )
}
