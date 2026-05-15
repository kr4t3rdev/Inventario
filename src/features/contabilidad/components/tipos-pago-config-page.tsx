"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Settings, Info, CreditCard, ShieldCheck, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { motion, useReducedMotion } from "framer-motion"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"
import { AnimatedNumber } from "@/components/ui/animated-number"

// Lazy Loading with improved Skeletons
const TipoPagoForm = dynamic(() => import("./tipo-pago-form").then(mod => ({ default: mod.TipoPagoForm })), {
  loading: () => (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="h-4 w-1/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-10 w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-900" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-1/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-24 w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-900" />
      </div>
    </div>
  )
})

const TiposPagoTable = dynamic(() => import("./tipos-pago-table").then(mod => ({ default: mod.TiposPagoTable })), {
  loading: () => (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-8 w-1/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>
    </div>
  )
})

import {
  getTiposPagoAction,
  createTipoPagoAction,
  updateTipoPagoAction,
  deleteTipoPagoAction
} from '@/features/contabilidad/actions-tipos-pago'
import { CreateTipoPagoRequest, UpdateTipoPagoRequest, TipoPagoWithDetails } from "@/app/models/model"

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

export function TiposPagoConfigPage() {
  const shouldReduceMotion = useReducedMotion()
  const [showInactive, setShowInactive] = useState(false)
  const [dialogState, setDialogState] = useState<{
    open: boolean
    mode: "create" | "edit"
    tipoPago?: TipoPagoWithDetails
  }>({
    open: false,
    mode: "create"
  })

  // Queries y mutations
  const [tiposPagoData, setTiposPagoData] = useState<{ data: TipoPagoWithDetails[] }>({ data: [] });
  const [loadingTiposPago, setLoadingTiposPago] = useState(true);
  const [errorTiposPago, setErrorTiposPago] = useState<any>(null);
  const [creatingTipoPago, setCreatingTipoPago] = useState(false);
  const [updatingTipoPago, setUpdatingTipoPago] = useState(false);
  const [deletingTipoPago, setDeletingTipoPago] = useState(false);

  const fetchTiposPago = useCallback(async () => {
    setLoadingTiposPago(true);
    setErrorTiposPago(null);
    try {
      const r = await getTiposPagoAction({ includeInactive: true });
      if (r.success) setTiposPagoData({ data: r.data?.data ?? [] });
      else setErrorTiposPago(r.error);
    } catch (e) {
      setErrorTiposPago(e);
    } finally {
      setLoadingTiposPago(false);
    }
  }, []);

  useEffect(() => {
    fetchTiposPago();
  }, [fetchTiposPago]);

  const tiposPago = tiposPagoData.data

  const handleCreate = () => {
    setDialogState({
      open: true,
      mode: "create"
    })
  }

  const handleEdit = (tipoPago: TipoPagoWithDetails) => {
    setDialogState({
      open: true,
      mode: "edit",
      tipoPago
    })
  }

  const handleSubmit = async (data: CreateTipoPagoRequest | UpdateTipoPagoRequest) => {
    try {
      if (dialogState.mode === "create") {
        setCreatingTipoPago(true);
        const r = await createTipoPagoAction(data as any);
        if (!r.success) throw new Error(r.error?.message || 'Error al crear');
        toast.success("Tipo de pago creado exitosamente")
      } else if (dialogState.tipoPago) {
        setUpdatingTipoPago(true);
        const r = await updateTipoPagoAction({
          id: dialogState.tipoPago.tipoId,
          ...data as any
        });
        if (!r.success) throw new Error(r.error?.message || 'Error al actualizar');
        toast.success("Tipo de pago actualizado exitosamente")
      }
      // Cerrar el diálogo y limpiar el estado
      setDialogState({ 
        open: false, 
        mode: "create",
        tipoPago: undefined 
      })
      fetchTiposPago()
    } catch (error: any) {
      // El error se maneja en el componente TipoPagoForm
      throw error
    } finally {
      setCreatingTipoPago(false);
      setUpdatingTipoPago(false);
    }
  }

  const handleDelete = async (tipoPagoId: string) => {
    try {
      setDeletingTipoPago(true);
      const r = await deleteTipoPagoAction(tipoPagoId);
      if (!r.success) throw new Error(r.error?.message || 'Error al eliminar');
      toast.success("Tipo de pago eliminado correctamente")
      fetchTiposPago()
    } catch (error) {
      console.error("Error deleting payment type:", error)
      toast.error("No se pudo eliminar el tipo de pago")
    } finally {
      setDeletingTipoPago(false);
    }
  }

  const handleToggleActive = async (tipoPagoId: string, isActive: boolean) => {
    try {
      setUpdatingTipoPago(true);
      const r = await updateTipoPagoAction({ id: tipoPagoId, isActive });
      if (!r.success) throw new Error(r.error?.message || 'Error al cambiar estado');
      toast.success(isActive ? "Tipo de pago activado" : "Tipo de pago desactivado")
      fetchTiposPago()
    } catch (error) {
      console.error("Error toggling payment type status:", error)
      toast.error("Error al cambiar el estado")
    } finally {
      setUpdatingTipoPago(false);
    }
  }

  const handleCloseDialog = () => {
    setDialogState({ 
      open: false, 
      mode: "create",
      tipoPago: undefined 
    })
  }

  const fadeInUp = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.5,
        ease: 'easeOut' as const
      }
    }
  }

  const stagger = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.1
      }
    }
  }

  if (loadingTiposPago) {
    return (
      <div className="flex min-h-100 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando tipos de pago...</p>
      </div>
    )
  }

  if (errorTiposPago) {
    return (
      <Alert variant="destructive" className="animate-in fade-in zoom-in duration-300">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No se pudieron cargar los tipos de pago. Por favor, verifica tu conexión e intenta nuevamente.
        </AlertDescription>
      </Alert>
    )
  }

  const activeTiposPago = tiposPago?.filter((tipo: TipoPagoWithDetails) => tipo.isActive) || []
  const inactiveTiposPago = tiposPago?.filter((tipo: TipoPagoWithDetails) => !tipo.isActive) || []

  return (
    <motion.div 
      className="space-y-6"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Header Info Cards */}
      <motion.div variants={fadeInUp}>
        <Card className={surfaceCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Info className="h-5 w-5 text-blue-500" />
              Resumen General
            </CardTitle>
            <CardDescription>
              Estado actual de los métodos de pago configurados en el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Tipos</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      <AnimatedNumber value={tiposPago?.length || 0} isInteger />
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Activos</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      <AnimatedNumber value={activeTiposPago.length} isInteger />
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/20">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-200 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Inactivos</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      <AnimatedNumber value={inactiveTiposPago.length} isInteger />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Rules Alert */}
      <motion.div variants={fadeInUp}>
        <Alert className="border-blue-200 bg-blue-50/50 text-blue-800 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-300 backdrop-blur-sm">
          <Info className="h-4 w-4" />
          <AlertTitle>Reglas de Negocio</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm opacity-90">
              <li>Los tipos de pago que requieren cuenta bancaria deben tener una cuenta por defecto configurada.</li>
              <li>No se pueden eliminar ni desactivar tipos de pago que tengan reconciliaciones asociadas.</li>
              <li>Los tipos de pago inactivos no aparecen en las opciones de reconciliación.</li>
            </ul>
          </AlertDescription>
        </Alert>
      </motion.div>

      {/* Main Table */}
      <motion.div variants={fadeInUp}>
        <TiposPagoTable
          tiposPago={tiposPago || []}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onCreate={handleCreate}
          showInactive={showInactive}
          onToggleShowInactive={setShowInactive}
        />
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={dialogState.open} 
        onOpenChange={(open) => {
          if (!open) handleCloseDialog()
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-slate-200/60 bg-white/95 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/95">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {dialogState.mode === "create" ? "Crear Nuevo Tipo de Pago" : "Editar Tipo de Pago"}
            </DialogTitle>
          </DialogHeader>
          <TipoPagoForm
            tipoPago={dialogState.tipoPago}
            onSubmit={handleSubmit}
            onCancel={handleCloseDialog}
            isLoading={creatingTipoPago || updatingTipoPago}
            mode={dialogState.mode}
          />
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}