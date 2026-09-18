'use client'

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Plus, ChevronDown, AlertTriangle, Clock, FileText, Settings, Trash2, Pencil } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUp } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { differenceInDays } from "date-fns"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LazyMotion, m as motion, AnimatePresence } from "framer-motion"
import { getAuthToken } from '@/lib/token'

interface Contrato {
  contratoId: string
  numeroContrato: string
  tipo: string
  estado: string
  fechaInicio: string
  fechaFin: string | null
  monto: string | null
  moneda: string
  diasAvisoVencimiento: number
  cliente?: {
    nombre: string
    empresa: string
  } | null
  vendor?: {
    nombre: string
  } | null
  createdAt: string
  updatedAt: string
}

interface ConfiguracionSistema {
  configId: string
  diasAvisoVencimientoContrato: number
}

interface ContratosContentProps {
  initialData?: Contrato[]
  initialMeta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  configuracion?: ConfiguracionSistema | null
}

/**
 * @description Componente de contenido para la lista de contratos
 * @param {ContratosContentProps} props - Props del componente
 * @returns {JSX.Element} Componente de lista de contratos
 */
export function ContratosContent({ initialData = [], initialMeta, configuracion }: ContratosContentProps) {
  const [contratos, setContratos] = useState<Contrato[]>(initialData)
  const [isLoading, setIsLoading] = useState(!initialData.length)
  const [contratoToDelete, setContratoToDelete] = useState<string | null>(null)
  const [configState, setConfigState] = useState<ConfiguracionSistema | null>(configuracion ?? null)

  // Pagination State
  const [pagination, setPagination] = useState({
    pageIndex: initialMeta ? initialMeta.page - 1 : 0,
    pageSize: initialMeta ? initialMeta.limit : 10,
  })
  const [pageCount, setPageCount] = useState(initialMeta?.totalPages ?? 0)

  // Filter State
  const [filters, setFilters] = useState({
    estado: 'ALL',
    tipo: 'ALL',
    fechaInicio: '',
    fechaFin: '',
  })

  // Selection State
  const [rowSelection, setRowSelection] = useState({})

  // Refetch function for refreshing data
  const fetchContratos = useCallback(async (page: number, pageSize: number) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(filters.estado !== 'ALL' && { estado: filters.estado }),
        ...(filters.tipo !== 'ALL' && { tipo: filters.tipo }),
        ...(filters.fechaInicio && { fechaInicio: filters.fechaInicio }),
        ...(filters.fechaFin && { fechaFin: filters.fechaFin }),
      })

      const response = await fetch(`/api/contratos?${params}`, {
        headers: {
          Authorization: getAuthToken(),
        },
      })
      const result = await response.json()

      if (result.data) {
        setContratos(result.data)
        setPageCount(result.meta.totalPages)
      }
    } catch (error) {
      console.error('Error fetching contratos:', error)
      toast.error('Error al cargar contratos')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  const fetchConfiguracion = useCallback(async () => {
    try {
      const response = await fetch('/api/configuracion/sistema/contratos', {
        headers: {
          Authorization: getAuthToken(),
        },
      })
      if (response.ok) {
        const data = await response.json()
        setConfigState(data)
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error)
    }
  }, [])

  useEffect(() => {
    if (!initialData.length) {
      fetchContratos(pagination.pageIndex + 1, pagination.pageSize)
    }
    fetchConfiguracion()
  }, [])

  useEffect(() => {
    if (initialData.length) {
      fetchContratos(pagination.pageIndex + 1, pagination.pageSize)
    }
  }, [pagination.pageIndex, pagination.pageSize, filters])

  const handleDelete = async () => {
    if (!contratoToDelete) return
    try {
      const response = await fetch(`/api/contratos/${contratoToDelete}`, {
        method: 'DELETE',
        headers: {
          Authorization: getAuthToken(),
        },
      })
      if (response.ok) {
        toast.success('El contrato ha sido eliminado exitosamente.')
        fetchContratos(pagination.pageIndex + 1, pagination.pageSize)
      }
    } catch (error) {
      console.error('Error al eliminar contrato:', error)
      toast.error('Error al eliminar contrato')
    } finally {
      setContratoToDelete(null)
    }
  }

  const handleBulkDelete = async () => {
    const selectedIds = Object.keys(rowSelection)
    if (selectedIds.length === 0) return

    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} contratos?`)) return

    const idsToDelete = selectedIds.map(index => contratos[parseInt(index)]?.contratoId).filter(Boolean)

    try {
      const response = await fetch('/api/contratos/bulk/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthToken(),
        },
        body: JSON.stringify({ ids: idsToDelete }),
      })

      if (response.ok) {
        toast.success('Contratos eliminados exitosamente')
        setRowSelection({})
        fetchContratos(pagination.pageIndex + 1, pagination.pageSize)
      }
    } catch (error) {
      console.error('Error bulk delete:', error)
      toast.error('Error al eliminar contratos')
    }
  }

  const handleBulkStatus = async (newStatus: string) => {
    const idsToUpdate = Object.keys(rowSelection).map(index => contratos[parseInt(index)]?.contratoId).filter(Boolean)

    try {
      const response = await fetch('/api/contratos/bulk/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthToken(),
        },
        body: JSON.stringify({ ids: idsToUpdate, estado: newStatus }),
      })

      if (response.ok) {
        toast.success(`Estado actualizado a ${newStatus}`)
        setRowSelection({})
        fetchContratos(pagination.pageIndex + 1, pagination.pageSize)
      }
    } catch (error) {
      console.error('Error bulk update:', error)
      toast.error('Error al actualizar estado')
    }
  }

  const getEstadoBadge = (estado: string) => {
    const variantMap: Record<string, string> = {
      BORRADOR: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      PENDIENTE_APROBACION: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      APROBADO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      RECHAZADO: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      ACTIVO: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      FINALIZADO: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      ANULADO: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    }
    return (
      <motion.span
        className={`px-2 py-1 rounded-full text-xs font-medium ${variantMap[estado] || 'bg-gray-100'}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
      >
        {estado.replace(/_/g, ' ')}
      </motion.span>
    )
  }

  const getTipoBadge = (tipo: string) => {
    const variantMap: Record<string, string> = {
      VENTA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      SERVICIO: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      PROVEEDOR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    }
    return (
      <motion.span
        className={`px-2 py-1 rounded-full text-xs font-medium ${variantMap[tipo] || 'secondary'}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
      >
        {tipo}
      </motion.span>
    )
  }

  const getDiasRestantes = (fechaFin: string | null) => {
    if (!fechaFin) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const fin = new Date(fechaFin)
    return differenceInDays(fin, today)
  }

  const getVencimientoBadge = (contrato: Contrato) => {
    const diasRestantes = getDiasRestantes(contrato.fechaFin)
    const diasAviso = configState?.diasAvisoVencimientoContrato || contrato.diasAvisoVencimiento || 30

    if (!contrato.fechaFin || diasRestantes === null) {
      return <span className="text-muted-foreground text-xs">Sin fecha</span>
    }

    if (diasRestantes < 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Vencido {Math.abs(diasRestantes)} días
        </Badge>
      )
    }

    if (diasRestantes === 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <Clock className="h-3 w-3" />
          Vence hoy
        </Badge>
      )
    }

    if (diasRestantes <= diasAviso) {
      return (
        <Badge className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-600">
          <AlertTriangle className="h-3 w-3" />
          {diasRestantes} días
        </Badge>
      )
    }

    return (
      <span className="text-green-600 text-xs font-medium flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {diasRestantes} días
      </span>
    )
  }

  const columns: ColumnDef<Contrato>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'numeroContrato',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Número
          <ArrowUp className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-mono font-medium">{row.getValue('numeroContrato')}</div>
      ),
    },
    {
      accessorKey: 'tipo',
      header: 'Tipo',
      cell: ({ row }) => getTipoBadge(row.getValue('tipo')),
    },
    {
      accessorKey: 'cliente',
      header: 'Cliente',
      cell: ({ row }) => {
        const cliente = row.original.cliente
        return cliente ? (
          <div>
            <div className="font-medium">{cliente.nombre}</div>
          </div>
        ) : row.original.vendor ? (
          <div className="font-medium">{row.original.vendor.nombre}</div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      },
    },
    {
      accessorKey: 'monto',
      header: 'Monto',
      cell: ({ row }) => {
        const monto = row.original.monto
        const moneda = row.original.moneda
        return monto ? (
          <motion.div
            className="font-medium"
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {Number(monto).toLocaleString()} {moneda}
          </motion.div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      },
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => getEstadoBadge(row.getValue('estado')),
    },
    {
      accessorKey: 'fechaInicio',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Inicio
          <ArrowUp className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('fechaInicio'))
        return <div className="text-sm">{date.toLocaleDateString()}</div>
      },
    },
    {
      accessorKey: 'fechaFin',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Fin
          <ArrowUp className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const fechaFin = row.getValue('fechaFin') as string | null
        if (!fechaFin) return <span className="text-muted-foreground text-sm">-</span>
        const date = new Date(fechaFin)
        return <div className="text-sm">{date.toLocaleDateString()}</div>
      },
    },
    {
      id: 'diasRestantes',
      header: 'Días Restantes',
      cell: ({ row }) => getVencimientoBadge(row.original),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const contrato = row.original
        return (
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Link href={`/busy/contratos/${contrato.contratoId}`}>
                  <FileText className="h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Link href={`/busy/contratos/update/${contrato.contratoId}`}>
                  <Pencil className="h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive"
                onClick={() => setContratoToDelete(contrato.contratoId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            {/* Header */}
            <motion.div
              className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6"
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
                  <FileText className="h-5 w-5 text-white" />
                </motion.div>
                <div className="relative">
                  <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                    Contratos
                  </h1>

                </div>
              </motion.div>

              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href="/busy/configuracion/contratos">
                    <Settings className="mr-2 h-4 w-4" />
                    Tipos de contrato
                  </Link>
                </Button>
                <AnimatePresence>
                  {Object.keys(rowSelection).length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline">
                            Acciones ({Object.keys(rowSelection).length}) <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Cambiar Estado</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleBulkStatus('BORRADOR')}>
                            Borrador
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBulkStatus('ACTIVO')}>
                            Activo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBulkStatus('FINALIZADO')}>
                            Finalizado
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handleBulkDelete} className="text-destructive">
                            Eliminar Seleccionados
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button asChild className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90">
                    <Link href="/busy/contratos/new">
                      <Plus className="mr-2 h-4 w-4" /> Nuevo Contrato
                    </Link>
                  </Button>
                </motion.div>
              </div>
            </motion.div>

            {/* Filters */}
            <motion.div
              className="bg-card border border-dashed rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-4 dark:border-gray-700"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div>
                <span className="text-sm font-medium mb-1 block">Estado</span>
                <Select
                  value={filters.estado}
                  onValueChange={(val) => setFilters(prev => ({ ...prev, estado: val }))}
                >
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="BORRADOR">Borrador</SelectItem>
                    <SelectItem value="PENDIENTE_APROBACION">Pendiente Aprob.</SelectItem>
                    <SelectItem value="ACTIVO">Activo</SelectItem>
                    <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                    <SelectItem value="ANULADO">Anulado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <span className="text-sm font-medium mb-1 block">Tipo</span>
                <Select
                  value={filters.tipo}
                  onValueChange={(val) => setFilters(prev => ({ ...prev, tipo: val }))}
                >
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="VENTA">Venta</SelectItem>
                    <SelectItem value="SERVICIO">Servicio</SelectItem>
                    <SelectItem value="PROVEEDOR">Proveedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <span className="text-sm font-medium mb-1 block">Desde</span>
                <Input
                  type="date"
                  value={filters.fechaInicio}
                  onChange={(e) => setFilters(prev => ({ ...prev, fechaInicio: e.target.value }))}
                  className="transition-all duration-200 focus:scale-[1.01]"
                />
              </div>

              <div>
                <span className="text-sm font-medium mb-1 block">Hasta</span>
                <Input
                  type="date"
                  value={filters.fechaFin}
                  onChange={(e) => setFilters(prev => ({ ...prev, fechaFin: e.target.value }))}
                  className="transition-all duration-200 focus:scale-[1.01]"
                />
              </div>
            </motion.div>

            {isLoading && contratos.length === 0 ? (
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <div className="h-64 bg-muted animate-pulse rounded border border-dashed dark:border-gray-700" />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <DataTable
                  columns={columns}
                  data={contratos}
                  searchColumn="numeroContrato"
                  searchPlaceholder="Buscar contratos..."
                  pagination={pagination}
                  onPaginationChange={setPagination}
                  pageCount={pageCount}
                  rowSelection={rowSelection}
                  onRowSelectionChange={setRowSelection}
                />
              </motion.div>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Delete Dialog */}
      <AnimatePresence>
        {contratoToDelete && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-background rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-dashed dark:border-gray-700"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                >
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </motion.div>
                ¿Está seguro de eliminar este contrato?
              </h2>
              <p className="text-muted-foreground mb-4">
                Esta acción no se puede deshacer. El contrato será eliminado permanentemente del sistema.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setContratoToDelete(null)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Eliminar Contrato
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
