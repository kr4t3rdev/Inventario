'use client'

/**
 * @description Componente de contenido para Gastos de Explotación (Client Component).
 * Maneja toda la interactividad: estados, efectos, tablas, diálogos de confirmación.
 * Los datos iniciales se reciben como props desde el Server Component (page.tsx).
 * 
 * @param {GastosDEContentProps} props - Props del componente
 * @returns {JSX.Element} Interfaz de gestión de Gastos DE
 */
import dynamic from "next/dynamic"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { deleteGastosDEAction, deleteGastosDEBulkAction, aprobarGastoDEAction, rechazarGastoDEAction } from "@/features/gastosDE/actions"
import type { Vendor } from "@/app/models/model"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUp, ArrowUpDown, Pencil, Plus, Trash2, Receipt, AlertCircle, Download } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { MotionConfig, m as motion } from "framer-motion"
import Link from "next/link"

const DataTable = dynamic(() => import('@/components/data-table').then(mod => ({ default: mod.DataTable })))

interface GastoDE {
  gastosDEId: string
  tipo: string | null
  conceptoId: string | null
  elementoId: string | null
  proveedor: string | null
  proveedorId?: string | null
  estado?: string | null
  monto: number
  descripcion: string | null
  periodo: string
  numeroFactura: string | null
  createdAt: string
  concepto?: { nombre: string } | null
  elemento?: { nombre: string } | null
}

interface GastosDEContentProps {
  initialGastosDE: GastoDE[]
  initialVendors: Vendor[]
}

export function GastosDEContent({ initialGastosDE, initialVendors }: GastosDEContentProps) {
  const [gastosDE, setGastosDE] = useState<GastoDE[]>(initialGastosDE)
  const [, startTransition] = useTransition()

  const [gastosDEToDelete, setGastosDEToDelete] = useState<string | null>(null)
  const [gastosDEToBulkDelete, setGastosDEToBulkDelete] = useState<string[] | null>(null)
  const [filterProveedor, setFilterProveedor] = useState<string>('')

  // Simular vendors desde props (en lugar del hook useVendors)
  const vendors = initialVendors

  const filteredGastosDE = gastosDE?.filter((gasto: GastoDE) => {
    if (filterProveedor && gasto.proveedor !== filterProveedor) return false
    return true
  }) || []

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  const selectedIds = Object.keys(rowSelection)
  const selectedGastos = selectedIds.map((idx) => filteredGastosDE[parseInt(idx)]).filter(Boolean)

  const handleDelete = async () => {
    if (!gastosDEToDelete) return
    startTransition(async () => {
      const r = await deleteGastosDEAction(gastosDEToDelete)
      if (r.success) {
        toast.success("El gasto ha sido eliminado exitosamente.")
        const ref = await import('@/features/gastosDE/actions').then(m => m.getGastosDEAction({}))
        if (ref.success) setGastosDE((ref.data ?? []) as unknown as GastoDE[])
      } else {
        toast.error(r.error?.message || "Error al eliminar el gasto.")
      }
      setGastosDEToDelete(null)
    })
  }

  const handleBulkDelete = async () => {
    if (!gastosDEToBulkDelete || gastosDEToBulkDelete.length === 0) return
    startTransition(async () => {
      const r = await deleteGastosDEBulkAction(gastosDEToBulkDelete)
      if (r.success) {
        toast.success(r.data?.eliminados ? `${r.data.eliminados} gastos eliminados` : 'No se eliminaron gastos')
      } else {
        toast.error(r.error?.message || "Error al eliminar los gastos.")
      }
      const ref = await import('@/features/gastosDE/actions').then(m => m.getGastosDEAction({}))
      if (ref.success) setGastosDE((ref.data ?? []) as unknown as GastoDE[])
      setGastosDEToBulkDelete(null)
      setRowSelection({})
    })
  }

  const handleAprobar = (id: string) => {
    startTransition(async () => {
      const r = await aprobarGastoDEAction({ id })
      if (r.success) {
        toast.success("Gasto aprobado.")
        const ref = await import('@/features/gastosDE/actions').then(m => m.getGastosDEAction({}))
        if (ref.success) setGastosDE((ref.data ?? []) as unknown as GastoDE[])
      } else {
        toast.error(r.error?.message || "Error al aprobar el gasto.")
      }
    })
  }

  const handleRechazar = (id: string) => {
    startTransition(async () => {
      const r = await rechazarGastoDEAction({ id })
      if (r.success) {
        toast.success("Gasto rechazado.")
        const ref = await import('@/features/gastosDE/actions').then(m => m.getGastosDEAction({}))
        if (ref.success) setGastosDE((ref.data ?? []) as unknown as GastoDE[])
      } else {
        toast.error(r.error?.message || "Error al rechazar el gasto.")
      }
    })
  }

  const handleExportCSV = () => {
    const dataToExport = filteredGastosDE.length === 0 ? [] : filteredGastosDE
    if (dataToExport.length === 0) {
      toast.error("No hay datos para exportar.")
      return
    }
    const headers = ["Concepto de Gasto", "Elemento de Gasto", "Proveedor", "Descripción", "Nº Factura", "Monto", "Período", "Estado Pago", "Fecha Creación"]
    const rows = dataToExport.map((g: GastoDE) => [
      g.concepto?.nombre || g.tipo || "Sin concepto",
      g.elemento?.nombre || "—",
      g.proveedor || "",
      g.descripcion || "",
      g.numeroFactura || "Sin factura",
      g.monto?.toFixed(2) || "0.00",
      g.periodo || "",
      "pendiente",
      new Date(g.createdAt).toLocaleDateString(),
    ])
    const csvContent = [headers.join(","), ...rows.map((r: string[]) => r.map((c) => `"${c}"`).join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gastos_explotacion_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Archivo CSV exportado exitosamente.")
  }

  const columns: ColumnDef<unknown>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Seleccionar todos"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'conceptoNombre',
      accessorFn: (row: any) => row.concepto?.nombre || row.tipo || "Sin concepto",
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Concepto de Gasto
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const gasto = row.original as GastoDE
        const conceptoNombre = gasto.concepto?.nombre || gasto.tipo || "Sin concepto"
        return <div className="max-w-45 truncate">{conceptoNombre}</div>
      },
    },
    {
      id: 'elementoNombre',
      accessorFn: (row: any) => row.elemento?.nombre || "—",
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Elemento de Gasto
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const gasto = row.original as GastoDE
        const elementoNombre = gasto.elemento?.nombre || "—"
        return <div className="max-w-45 truncate text-muted-foreground">{elementoNombre}</div>
      },
    },
    {
      accessorKey: 'proveedor',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Proveedor
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Descripción
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
    },
    {
      accessorKey: 'numeroFactura',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Nº Factura
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const factura = (row.original as GastoDE).numeroFactura
        return <div className="max-w-37.5 truncate">{factura || "Sin factura"}</div>
      },
    },
    {
      id: 'estadoAprobacion',
      accessorFn: (row: any) => row.estado || 'APROBADO',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Estado
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const estado = (row.original as GastoDE).estado || 'APROBADO'
        if (estado === 'PENDIENTE') return <Badge variant="outline" className="border-amber-500 text-amber-600">Pendiente</Badge>
        if (estado === 'RECHAZADO') return <Badge variant="outline" className="border-red-500 text-red-600">Rechazado</Badge>
        return <Badge variant="outline" className="border-green-600 text-green-700">Aprobado</Badge>
      },
    },
    {
      accessorKey: 'monto',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Monto
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const monto = (row.original as GastoDE).monto
        return (
          <motion.div
            key={monto}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="font-medium"
          >
            ${monto?.toFixed(2) || '0.00'}
          </motion.div>
        )
      }
    },
    {
      accessorKey: 'periodo',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Período
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Fecha de creacion
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt'))
        return <div className="max-w-37.5 truncate text-center">{date.toLocaleDateString()}</div>
      },
    },
    {
      header: 'Acciones',
      id: 'actions',
      cell: ({ row }) => {
        const gastoDE = row.original as GastoDE
        const esPendiente = (gastoDE.estado || 'APROBADO') === 'PENDIENTE'
        return (
          <div className="flex items-center gap-2">
            {esPendiente && (
              <>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    onClick={() => handleAprobar(gastoDE.gastosDEId)}
                    variant='outline'
                    className='h-8 px-2 cursor-pointer text-green-700 border-green-600 hover:bg-green-50'
                    aria-label="Aprobar gasto"
                    title="Aprobar gasto"
                  >
                    Aprobar
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    onClick={() => handleRechazar(gastoDE.gastosDEId)}
                    variant='outline'
                    className='h-8 px-2 cursor-pointer text-red-700 border-red-600 hover:bg-red-50'
                    aria-label="Rechazar gasto"
                    title="Rechazar gasto"
                  >
                    Rechazar
                  </Button>
                </motion.div>
              </>
            )}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Link href={`/busy/gastosDE/update/${gastoDE.gastosDEId}`}>
                <Button variant='outline' className='h-8 w-8 p-0 cursor-pointer' aria-label="Editar gasto" title="Editar gasto">
                  <Pencil className='h-4 w-4' />
                </Button>
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                onClick={() => setGastosDEToDelete(gastoDE.gastosDEId)}
                variant='outline'
                className='h-8 w-8 p-0 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors'
                aria-label="Eliminar gasto"
                title="Eliminar gasto"
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </motion.div>
          </div>
        )
      }
    }
  ]

  return (
    <MotionConfig reducedMotion="user">
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
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
                className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Receipt className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                  Gasto de Explotación
                </h1>
              </div>
            </motion.div>
            <div className="flex flex-wrap items-center gap-2">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Button asChild className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90">
                  <Link href="/busy/gastosDE/new">
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Gasto
                  </Link>
                </Button>
              </motion.div>
              {selectedIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="destructive"
                    onClick={() => setGastosDEToBulkDelete(selectedIds.map((idx) => filteredGastosDE[parseInt(idx)]?.gastosDEId).filter(Boolean))}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar ({selectedIds.length})
                  </Button>
                </motion.div>
              )}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Button variant="outline" onClick={handleExportCSV}>
                  <Download className="mr-2 h-4 w-4" /> Exportar CSV
                </Button>
              </motion.div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex gap-4 mb-4">
              <select
                value={filterProveedor}
                onChange={(e) => setFilterProveedor(e.target.value)}
                aria-label="Filtrar por proveedor"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="">Todos los proveedores</option>
                {Array.from(new Set(gastosDE?.map((g: GastoDE) => g.proveedor))).map((proveedor) => (
                  proveedor && (
                    <option key={proveedor} value={proveedor}>
                      {proveedor}
                    </option>
                  )
                ))}
              </select>
            </div>
            <DataTable
              columns={columns}
              data={filteredGastosDE}
              searchColumn="conceptoNombre"
              searchPlaceholder="Buscar por concepto de gasto..."
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
            />
          </motion.div>
        </div>
      </SidebarInset>

      {/* Diálogo de confirmación para eliminar individual */}
      <AlertDialog open={!!gastosDEToDelete} onOpenChange={(open) => !open && setGastosDEToDelete(null)}>
        <AlertDialogContent className="border-dashed">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
              >
                <AlertCircle className="h-5 w-5 text-destructive" />
              </motion.div>
              ¿Está seguro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el gasto de explotación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación para eliminación masiva */}
      <AlertDialog open={!!gastosDEToBulkDelete} onOpenChange={(open) => !open && setGastosDEToBulkDelete(null)}>
        <AlertDialogContent className="border-dashed">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
              >
                <AlertCircle className="h-5 w-5 text-destructive" />
              </motion.div>
              ¿Eliminar {gastosDEToBulkDelete?.length || 0} gastos?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán {gastosDEToBulkDelete?.length || 0} gastos de explotación permanentemente. Los gastos con reconciliaciones no podrán ser eliminados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
    </MotionConfig>
  )
}