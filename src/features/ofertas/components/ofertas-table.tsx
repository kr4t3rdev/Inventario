"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LazyMotion, m as motion, AnimatePresence } from "framer-motion"
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
import { ArrowUpDown, Eye, Printer, Trash2, Receipt } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { Oferta } from "@/app/models/model"
import { Badge } from "@/components/ui/badge"
import { deleteOfertaAction } from "@/features/ofertas/actions"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface OfertasTableProps {
  ofertas: Oferta[]
  isLoading: boolean
  error: any
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
}

const tableRowVariant = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
}

function LoadingSpinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <motion.div
      className={`border-2 border-primary border-t-transparent rounded-full ${className || ''}`}
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
  )
}

function PulseSkeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={`bg-muted rounded ${className}`}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

export function OfertasTable({ ofertas, isLoading, error }: OfertasTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [ofertaToDelete, setOfertaToDelete] = useState<Oferta | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!ofertaToDelete) return

    setIsDeleting(true)
    try {
      const result = await deleteOfertaAction(ofertaToDelete.id)
      if (result.success) {
        toast.success("Oferta eliminada exitosamente")
        setOfertaToDelete(null)
        router.refresh()
      } else {
        toast.error(result.error.message || "Error al eliminar la oferta")
      }
    } catch (error: any) {
      console.error("Error eliminando oferta:", error)
      toast.error(error.message || "Error al eliminar la oferta")
    } finally {
      setIsDeleting(false)
    }
  }

  const columns: ColumnDef<Oferta>[] = [
    {
      accessorKey: "numeroOferta",
      header: "Número",
      cell: ({ row }) => <div className="font-medium">{row.getValue("numeroOferta")}</div>,
    },
    {
      accessorKey: "cliente.nombre",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Cliente
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const cliente = row.original.cliente
        return <div>{cliente?.nombre || 'Desconocido'}</div>
      },
    },
    {
      accessorKey: "fechaEmision",
      header: "Fecha Emisión",
      cell: ({ row }) => <div>{new Date(row.getValue("fechaEmision")).toLocaleDateString()}</div>,
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => {
        const estado = row.getValue("estado") as string
        let variant: "default" | "secondary" | "destructive" | "outline" = "default"

        switch(estado) {
          case 'PENDIENTE': variant = 'secondary'; break;
          case 'ACEPTADA': variant = 'default'; break;
          case 'RECHAZADA': variant = 'destructive'; break;
          case 'FACTURADA': variant = 'outline'; break;
        }

        return <Badge variant={variant}>{estado}</Badge>
      },
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => <div className="font-medium">{formatCurrency(row.getValue("total"))}</div>,
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const oferta = row.original
        const canDelete = oferta.estado !== 'FACTURADA'

        return (
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/busy/ofertas/${oferta.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  Ver
                </Link>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    const token = ""
                    const response = await fetch(`/api/ofertas/${oferta.id}/pdf`, {
                      headers: {
                        Authorization: `Bearer ${token}`
                      }
                    })

                    if (!response.ok) {
                      throw new Error("Error al descargar PDF")
                    }

                    const blob = await response.blob()
                    const url = window.URL.createObjectURL(blob)
                    window.open(url, '_blank')

                    setTimeout(() => window.URL.revokeObjectURL(url), 100)
                  } catch (error) {
                    console.error("Error printing offer:", error)
                    alert("Error al imprimir la oferta")
                  }
                }}
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </motion.div>

            {canDelete && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOfertaToDelete(oferta)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              </motion.div>
            )}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: ofertas,
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
        <div className="flex items-center py-4">
          <PulseSkeleton className="h-10 w-75" />
        </div>
        <div className="rounded-md border">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <PulseSkeleton className="h-12 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div
        className="text-center py-4 text-destructive"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        Error al cargar las ofertas
      </motion.div>
    )
  }

  return (
    <>
      <motion.div
        className="space-y-4"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <motion.div
          className="flex items-center justify-between"
          variants={fadeInUp}
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Receipt className="h-5 w-5 text-white" />
            </motion.div>
            <div className="relative">
              <h2 className="text-lg font-semibold">Lista de Ofertas</h2>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="flex items-center py-4"
          variants={fadeInUp}
        >
          <Input
            placeholder="Filtrar por número..."
            value={(table.getColumn("numeroOferta")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("numeroOferta")?.setFilterValue(event.target.value)}
            className="max-w-sm transition-all duration-200 focus:scale-[1.01]"
          />
        </motion.div>

        <motion.div
          className="rounded-md border overflow-hidden"
          variants={fadeInUp}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="wait">
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row, index) => (
                    <motion.tr
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      variants={tableRowVariant}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={{ delay: index * 0.03, duration: 0.3 }}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                      whileHover={{
                        scale: 1.005,
                        backgroundColor: 'rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <Receipt className="h-8 w-8 text-muted-foreground/50" />
                        <span className="text-muted-foreground">No hay ofertas registradas.</span>
                      </motion.div>
                    </TableCell>
                  </TableRow>
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </motion.div>

        <motion.div
          className="flex items-center justify-end space-x-2"
          variants={fadeInUp}
        >
          <div className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} oferta(s)</div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              Anterior
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Siguiente
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>

      <AlertDialog open={!!ofertaToDelete} onOpenChange={() => setOfertaToDelete(null)}>
        <AlertDialogContent>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center"
                  initial={{ rotate: -10 }}
                  animate={{ rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                </motion.div>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente la oferta <strong>{ofertaToDelete?.numeroOferta}</strong>.
                <br />
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-500 hover:bg-red-700"
                >
                  {isDeleting ? (
                    <>
                      <span className="mr-2">
                        <LoadingSpinner size={16} />
                      </span>
                      Eliminando...
                    </>
                  ) : (
                    "Eliminar"
                  )}
                </AlertDialogAction>
              </motion.div>
            </AlertDialogFooter>
          </motion.div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
