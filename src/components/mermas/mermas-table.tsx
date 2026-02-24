"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowUpDown, Pencil, Trash2Icon, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useGetProductosQuery } from "@/lib/redux/services/productosApi"
import { Merma } from "../../app/models/model"

interface MermasTableProps {
  mermas: Merma[]
  isLoading: boolean
  error: any
  onDelete: (id: string) => void
}

export function MermasTable({ mermas, isLoading, error, onDelete }: MermasTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const {data: productos} = useGetProductosQuery()

  const columns: ColumnDef<Merma>[] = [
    {
      accessorKey: "mermaId",
      header: "ID",
      cell: ({ row }) => <div className="truncate max-w-[50px]">{row.getValue("mermaId")}</div>,
    },
    {
      id: "producto",
      accessorFn: (row) => row.producto?.nombre || "",
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Producto
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const producto = row.original.producto
        return <div className="text-center truncate max-w-[80px]">{producto?.nombre || "Sin producto"}</div>
      },
      filterFn: (row, columnId, value) => {
        const producto = row.original.producto
        if (!producto?.nombre) return false
        return producto.nombre.toLowerCase().includes(value.toLowerCase())
      },
    },
    {
      accessorKey: "cantidad",
      header: "Cantidad",
      cell: ({ row }) => <div className="text-center truncate max-w-[50px]">{row.getValue("cantidad")}</div>,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Fecha
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      }
    },
    {
      accessorKey: "motivo",
      header: "Motivo",
      cell: ({ row }) => <div>{row.getValue("motivo")}</div>,
    },
    {
      header: "Acciones",
      enableHiding: false,
      cell: ({ row }) => {
        const merma = row.original

        return (
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button className='h-8 w-8 p-0 cursor-pointer' variant='outline' asChild>
                <Link href={`/busy/mermas/edit/${merma.mermaId}`}>
                  <Pencil className='h-4 w-4'/>
                </Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button 
                onClick={()=>onDelete(merma.mermaId)} 
                variant='outline' 
                className='h-8 w-8 p-0 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors'
              >
                <Trash2Icon className='h-4 w-4'/>
              </Button>
            </motion.div>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: mermas,
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
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-center py-8">
          <motion.div
            className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
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
                    {columns.map((column, colIndex) => (
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
    )
  }

  if (error) {
    return (
      <motion.div 
        className="text-center py-8 text-destructive border border-dashed rounded-lg dark:border-gray-700"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-lg font-medium">Error al cargar los datos</p>
        <p className="text-sm text-muted-foreground">Por favor, intente nuevamente</p>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="flex items-center py-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Input
          placeholder="Filtrar por producto..."
          value={(table.getColumn("producto")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("producto")?.setFilterValue(event.target.value)}
          className="max-w-sm transition-all duration-200 focus:scale-[1.01]"
        />
      </motion.div>
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
                  transition={{ delay: index * 0.05 }}
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
                    No hay mermas registradas.
                  </motion.div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <motion.div 
        className="flex items-center justify-end space-x-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} merma(s)</div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => table.previousPage()} 
          disabled={!table.getCanPreviousPage()}
          className="transition-all duration-200"
        >
          Anterior
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => table.nextPage()} 
          disabled={!table.getCanNextPage()}
          className="transition-all duration-200"
        >
          Siguiente
        </Button>
      </motion.div>
    </motion.div>
  )
}
