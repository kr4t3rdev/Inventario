"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { 
  Edit, 
  Trash2, 
  Plus, 
  Eye, 
  EyeOff, 
  CreditCard, 
  Building2, 
  MoreHorizontal, 
  Search, 
  FilterX,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { TipoPagoWithDetails } from "../../app/models/model"

interface TiposPagoTableProps {
  tiposPago: TipoPagoWithDetails[]
  onEdit: (tipoPago: TipoPagoWithDetails) => void
  onDelete: (tipoPagoId: string) => Promise<void>
  onToggleActive: (tipoPagoId: string, isActive: boolean) => Promise<void>
  onCreate: () => void
  isLoading?: boolean
  showInactive?: boolean
  onToggleShowInactive: (show: boolean) => void
}

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-950/50',
);

export function TiposPagoTable({
  tiposPago,
  onEdit,
  onDelete,
  onToggleActive,
  onCreate,
  isLoading = false,
  showInactive = false,
  onToggleShowInactive
}: TiposPagoTableProps) {
  const shouldReduceMotion = useReducedMotion()
  const [searchTerm, setSearchTerm] = useState("")
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; tipoPago?: TipoPagoWithDetails; loading?: boolean }>({
    open: false,
    loading: false
  })
  const [toggleDialog, setToggleDialog] = useState<{ open: boolean; tipoPago?: TipoPagoWithDetails; newState?: boolean; loading?: boolean }>({
    open: false,
    loading: false
  })

  const handleDelete = async () => {
    if (!deleteDialog.tipoPago || deleteDialog.loading) return

    setDeleteDialog(prev => ({ ...prev, loading: true }))
    
    try {
      await onDelete(deleteDialog.tipoPago.tipoId)
      setDeleteDialog({ open: false, tipoPago: undefined, loading: false })
    } catch (error) {
      console.error("Error al eliminar tipo de pago:", error)
      toast.error("Error al eliminar el tipo de pago")
      setDeleteDialog(prev => ({ ...prev, loading: false }))
    }
  }

  const handleToggleActive = async () => {
    if (!toggleDialog.tipoPago || toggleDialog.newState === undefined || toggleDialog.loading) return

    setToggleDialog(prev => ({ ...prev, loading: true }))

    try {
      await onToggleActive(toggleDialog.tipoPago.tipoId, toggleDialog.newState)
      setToggleDialog({ open: false, tipoPago: undefined, newState: undefined, loading: false })
    } catch (error) {
      console.error("Error al cambiar estado del tipo de pago:", error)
      toast.error("Error al cambiar el estado del tipo de pago")
      setToggleDialog(prev => ({ ...prev, loading: false }))
    }
  }

  const canDelete = (tipoPago: TipoPagoWithDetails | null | undefined) => {
    if (!tipoPago || !tipoPago._count) return true
    return (tipoPago._count.reconciliacionesVenta +
      tipoPago._count.reconciliacionesServicio +
      tipoPago._count.reconciliacionesGasto) === 0
  }

  const canDeactivate = (tipoPago: TipoPagoWithDetails | null | undefined) => {
    if (!tipoPago) return false
    if (!tipoPago.isActive) return true // Ya está inactivo
    if (!tipoPago._count) return true
    return (tipoPago._count.reconciliacionesVenta +
      tipoPago._count.reconciliacionesServicio +
      tipoPago._count.reconciliacionesGasto) === 0
  }

  const getTotalReconciliaciones = (tipoPago: TipoPagoWithDetails | null | undefined) => {
    if (!tipoPago || !tipoPago._count) return 0
    return tipoPago._count.reconciliacionesVenta +
      tipoPago._count.reconciliacionesServicio +
      tipoPago._count.reconciliacionesGasto
  }

  const filteredTiposPago = (showInactive ? tiposPago : tiposPago.filter(tipo => tipo.isActive))
    .filter(tipo => 
      tipo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tipo.descripcion && tipo.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
    )

  return (
    <>
      <Card className={surfaceCardClass}>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CreditCard className="h-5 w-5 text-blue-500" />
                Listado de Tipos de Pago
              </CardTitle>
              <CardDescription>
                Gestiona y configura los métodos de pago del sistema.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
                <Input
                  placeholder="Buscar tipo de pago..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 sm:w-[250px] bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleShowInactive(!showInactive)}
                className="border-slate-200 bg-white/50 hover:bg-white hover:text-blue-600 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:bg-slate-950 dark:hover:text-blue-400 transition-all"
              >
                {showInactive ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Ocultar Inactivos
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Mostrar Inactivos
                  </>
                )}
              </Button>
              <Button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-blue-500/40">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Nombre</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Descripción</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Configuración</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Cuenta Asociada</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Uso</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Estado</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-200">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {filteredTiposPago.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                          {searchTerm ? (
                            <>
                              <FilterX className="h-8 w-8 mb-2 opacity-50" />
                              <p>No se encontraron resultados para "{searchTerm}"</p>
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-8 w-8 mb-2 opacity-50" />
                              <p>{showInactive ? "No hay tipos de pago registrados" : "No hay tipos de pago activos"}</p>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTiposPago.map((tipoPago, index) => (
                      <motion.tr
                        key={tipoPago.tipoId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ 
                          duration: shouldReduceMotion ? 0 : 0.5,
                          delay: shouldReduceMotion ? 0 : index * 0.05 
                        }}
                        className="group border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                      >
                        <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                          {tipoPago.nombre}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate text-slate-500 dark:text-slate-400 text-sm">
                            {tipoPago.descripcion || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tipoPago.requiereCuenta ? "default" : "secondary"} className={cn(
                            "font-normal",
                            tipoPago.requiereCuenta 
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50" 
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          )}>
                            {tipoPago.requiereCuenta ? "Requiere Cuenta" : "Sin Cuenta"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tipoPago.cuentaDefectoInfo ? (
                            <div className="flex items-center gap-2 text-sm">
                              <div className="rounded bg-slate-100 p-1 dark:bg-slate-800">
                                <Building2 className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                              </div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {tipoPago.cuentaDefectoInfo.nombreBanco}
                              </span>
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                {tipoPago.cuentaDefectoInfo.moneda}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 text-sm italic">No asignada</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {getTotalReconciliaciones(tipoPago)}
                            </Badge>
                            <span className="text-xs text-slate-400">ops</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tipoPago.isActive ? "default" : "destructive"} className={cn(
                            "font-normal",
                            tipoPago.isActive 
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200" 
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200"
                          )}>
                            {tipoPago.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800">
                                <span className="sr-only">Abrir menú</span>
                                <MoreHorizontal className="h-4 w-4 text-slate-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[160px]">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => onEdit(tipoPago)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setToggleDialog({ open: true, tipoPago, newState: !tipoPago.isActive })}
                                disabled={!tipoPago.isActive && !canDeactivate(tipoPago)}
                              >
                                {tipoPago.isActive ? (
                                  <>
                                    <EyeOff className="mr-2 h-4 w-4" />
                                    Desactivar
                                  </>
                                ) : (
                                  <>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Activar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setDeleteDialog({ open: true, tipoPago })}
                                disabled={!canDelete(tipoPago)}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de confirmación para eliminar */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialog({ open: false, tipoPago: undefined, loading: false })
          }
        }}
      >
        <AlertDialogContent className="border-slate-200/60 bg-white/95 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/95">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              ¿Eliminar tipo de pago?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>
                Esta acción no se puede deshacer. Se eliminará permanentemente el tipo de pago
                <span className="font-semibold text-slate-900 dark:text-slate-100"> "{deleteDialog.tipoPago?.nombre}"</span>.
              </p>
              {!canDelete(deleteDialog.tipoPago) && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                  <span className="font-medium">Acción bloqueada:</span> No se puede eliminar este tipo de pago porque tiene reconciliaciones asociadas.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setDeleteDialog({ open: false, tipoPago: undefined, loading: false })}
              disabled={deleteDialog.loading}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!canDelete(deleteDialog.tipoPago) || deleteDialog.loading}
              className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20"
            >
              {deleteDialog.loading ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación para cambiar estado */}
      <AlertDialog 
        open={toggleDialog.open} 
        onOpenChange={(open) => {
          if (!open) {
            setToggleDialog({ open: false, tipoPago: undefined, newState: undefined, loading: false })
          }
        }}
      >
        <AlertDialogContent className="border-slate-200/60 bg-white/95 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/95">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleDialog.newState ? "¿Activar tipo de pago?" : "¿Desactivar tipo de pago?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              {toggleDialog.newState ? (
                <p>
                  Se activará el tipo de pago <span className="font-semibold text-slate-900 dark:text-slate-100">"{toggleDialog.tipoPago?.nombre}"</span> y estará disponible
                  para nuevas reconciliaciones.
                </p>
              ) : (
                <>
                  <p>
                    Se desactivará el tipo de pago <span className="font-semibold text-slate-900 dark:text-slate-100">"{toggleDialog.tipoPago?.nombre}"</span> y no estará disponible
                    para nuevas reconciliaciones.
                  </p>
                  {!canDeactivate(toggleDialog.tipoPago) && (
                    <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
                      <span className="font-medium">Advertencia:</span> Este tipo de pago tiene reconciliaciones históricas, pero puede ser desactivado para prevenir nuevos usos.
                    </div>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setToggleDialog({ open: false, tipoPago: undefined, newState: undefined, loading: false })}
              disabled={toggleDialog.loading}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleActive}
              disabled={(!toggleDialog.newState && !canDeactivate(toggleDialog.tipoPago)) || toggleDialog.loading}
              className={cn(
                "shadow-md",
                toggleDialog.newState 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20" 
                  : "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20"
              )}
            >
              {toggleDialog.loading 
                ? (toggleDialog.newState ? "Activando..." : "Desactivando...") 
                : (toggleDialog.newState ? "Activar" : "Desactivar")
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}