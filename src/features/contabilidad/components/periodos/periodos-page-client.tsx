/**
 * @description Componente cliente principal para gestión de períodos contables.
 * Gestiona la lista, filtros, acciones y diálogos de períodos.
 *
 * @param {Object} props - Props del componente.
 * @param {Array} props.initialPeriodos - Lista inicial de períodos del server.
 * @param {Object} props.initialPagination - Información de paginación.
 */
'use client';

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Calendar, Lock, CheckCircle, ShieldCheck, ShieldAlert, AlertCircle, Info } from "lucide-react";
import { format } from "date-fns";
import { PeriodoTimeline } from "./periodo-timeline";
import { AbrirPeriodoDialog } from "./abrir-periodo-dialog";
import { CerrarPeriodoDialog } from "./cerrar-periodo-dialog";
import { ReabrirPeriodoDialog } from "./reabrir-periodo-dialog";
import type { TipoPeriodo, EstadoPeriodo } from "@/lib/services/periodo-contable-types";

const ESTADO_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive" | null> = {
  ABIERTO: "default",
  EN_CIERRE: "destructive",
  CERRADO: "secondary",
  APROBADO: "default",
  REABIERTO: "outline",
  BORRADOR: "secondary",
};

const ESTADO_LABELS: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_CIERRE: "En Cierre",
  CERRADO: "Cerrado",
  APROBADO: "Aprobado",
  REABIERTO: "Reabierto",
  BORRADOR: "Borrador",
};

const TIPO_LABELS: Record<string, string> = {
  DIARIO: "Diario",
  MENSUAL: "Mensual",
  ANUAL: "Anual",
};

export function PeriodosPageClient({
  initialPeriodos = [],
  initialPagination = null,
}: {
  initialPeriodos: any[];
  initialPagination: any;
}) {
  // Data state
  const [periodos, setPeriodos] = useState(initialPeriodos);
  const [pagination] = useState(initialPagination);
  const [isLoading, setIsLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<Record<string, any[]>>({});

  // Filters
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  // Dialogs
  const [showAbrirDialog, setShowAbrirDialog] = useState(false);
  const [showCerrarDialog, setShowCerrarDialog] = useState(false);
  const [showReabrirDialog, setShowReabrirDialog] = useState(false);
  const [showAprobarDialog, setShowAprobarDialog] = useState(false);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<any>(null);

  // Timeline
  const [timelinePeriodoId, setTimelinePeriodoId] = useState<string | null>(null);

  // Refresh handler
  const refreshPeriodos = useCallback(async () => {
    setIsLoading(true);
    try {
      const { listarPeriodosAction } = await import('@/features/contabilidad/actions-periodos');
      const filtro: Record<string, any> = { limit: 100 };
      if (filtroTipo !== "todos") filtro.tipo = filtroTipo;
      if (filtroEstado !== "todos") filtro.estado = filtroEstado;

      const result = await listarPeriodosAction(filtro);
      if (result.success && result.data) {
        setPeriodos(result.data.periodos ?? []);
      }
    } catch (err) {
      console.error('Error refreshing periodos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filtroTipo, filtroEstado]);

  // Load timeline for a periodo
  const loadTimeline = useCallback(async (periodoId: string) => {
    try {
      const { obtenerTimelineAction } = await import('@/features/contabilidad/actions-periodos');
      const result = await obtenerTimelineAction(periodoId);
      if (result.success && result.data) {
        setTimelineData((prev) => ({ ...prev, [periodoId]: result.data?.timeline ?? [] }));
      }
    } catch (err) {
      console.error('Error loading timeline:', err);
    }
  }, []);

  // Load timeline when selecting a periodo for detail
  useEffect(() => {
    if (timelinePeriodoId && !timelineData[timelinePeriodoId]) {
      loadTimeline(timelinePeriodoId);
    }
  }, [timelinePeriodoId, loadTimeline, timelineData]);

  // Filter logic
  const periodosFiltrados = periodos.filter((p) => {
    if (filtroTipo !== "todos" && p.tipo !== filtroTipo) return false;
    if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
    return true;
  });

  // Action handlers
  const handleCerrar = (periodo: any) => {
    setPeriodoSeleccionado(periodo);
    setShowCerrarDialog(true);
  };

  const handleReabrir = (periodo: any) => {
    setPeriodoSeleccionado(periodo);
    setShowReabrirDialog(true);
  };

  const handleAprobar = async (periodo: any) => {
    try {
      const { aprobarPeriodoAction } = await import('@/features/contabilidad/actions-periodos');
      const result = await aprobarPeriodoAction({ periodoId: periodo.periodoId });
      if (!result.success) {
        alert(result.error?.message ?? 'Error al aprobar');
        return;
      }
      refreshPeriodos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleTimelineClick = (periodoId: string) => {
    setTimelinePeriodoId(timelinePeriodoId === periodoId ? null : periodoId);
  };

  // Helper: qué acciones están disponibles según estado
  const getAcciones = (periodo: any) => {
    const acciones: { label: string; action: () => void; variant?: "default" | "outline" | "destructive" }[] = [];

    switch (periodo.estado) {
      case 'ABIERTO':
      case 'REABIERTO':
        acciones.push({ label: "Cerrar", action: () => handleCerrar(periodo), variant: "outline" });
        break;
      case 'CERRADO':
        acciones.push({ label: "Aprobar", action: () => handleAprobar(periodo) });
        acciones.push({ label: "Reabrir", action: () => handleReabrir(periodo), variant: "outline" });
        break;
      case 'APROBADO':
        acciones.push({ label: "Reabrir", action: () => handleReabrir(periodo), variant: "outline" });
        break;
    }

    return acciones;
  };

  const periodoTimeline = timelinePeriodoId ? (timelineData[timelinePeriodoId] ?? []) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Períodos Contables</h2>
          <p className="text-muted-foreground">
            Gestión de períodos diarios, mensuales y anuales con control de cierres y auditoría.
          </p>
        </div>
        <Button onClick={() => setShowAbrirDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Período
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="DIARIO">Diario</SelectItem>
                  <SelectItem value="MENSUAL">Mensual</SelectItem>
                  <SelectItem value="ANUAL">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Estado</label>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ABIERTO">Abierto</SelectItem>
                  <SelectItem value="CERRADO">Cerrado</SelectItem>
                  <SelectItem value="APROBADO">Aprobado</SelectItem>
                  <SelectItem value="REABIERTO">Reabierto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Períodos</CardTitle>
          <CardDescription>
            {periodosFiltrados.length} período{periodosFiltrados.length !== 1 ? "s" : ""} encontrado{periodosFiltrados.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : periodosFiltrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="mx-auto h-12 w-12 mb-4" />
              <p>No hay períodos{periodosFiltrados.length !== 1 ? "" : ""} registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Integridad</TableHead>
                  <TableHead>Última Acción</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodosFiltrados.map((periodo) => (
                  <>
                    <TableRow key={periodo.periodoId}>
                      <TableCell>
                        <Badge variant="outline">
                          {TIPO_LABELS[periodo.tipo] ?? periodo.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(periodo.fechaInicio), "dd/MM/yyyy")}
                          <span className="text-muted-foreground"> — </span>
                          {format(new Date(periodo.fechaFin), "dd/MM/yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={ESTADO_COLORS[periodo.estado] ?? "secondary"}>
                            {ESTADO_LABELS[periodo.estado] ?? periodo.estado}
                          </Badge>
                          {periodo.blockers?.length > 0 && (
                            <span title={periodo.blockers.join("; ")}>
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {periodo.tieneHash ? (
                          <span title="Hash de integridad presente" className="text-green-600 flex items-center gap-1">
                            <ShieldCheck className="h-4 w-4" />
                            <span className="text-xs">Verificado</span>
                          </span>
                        ) : (
                          <span title="Sin hash de integridad" className="text-muted-foreground flex items-center gap-1">
                            <ShieldAlert className="h-4 w-4" />
                            <span className="text-xs">Pendiente</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {periodo.ultimaAuditoria ? (
                            <span className="flex items-center gap-1">
                              <Info className="h-3 w-3" />
                              {periodo.ultimaAuditoria.evento}
                            </span>
                          ) : (
                            "-"
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          {getAcciones(periodo).map((accion, idx) => (
                            <Button
                              key={idx}
                              variant={accion.variant ?? "default"}
                              size="sm"
                              onClick={accion.action}
                            >
                              {accion.label}
                            </Button>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTimelineClick(periodo.periodoId)}
                          >
                            {timelinePeriodoId === periodo.periodoId ? "Ocultar" : "Timeline"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {timelinePeriodoId === periodo.periodoId && (
                      <TableRow key={`${periodo.periodoId}-timeline`}>
                        <TableCell colSpan={7} className="p-0">
                          <div className="px-4 pb-4">
                            <PeriodoTimeline
                              eventos={periodoTimeline}
                              isLoading={!timelineData[periodo.periodoId]}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AbrirPeriodoDialog
        open={showAbrirDialog}
        onOpenChange={setShowAbrirDialog}
        onSuccess={refreshPeriodos}
      />

      <CerrarPeriodoDialog
        open={showCerrarDialog}
        onOpenChange={setShowCerrarDialog}
        onSuccess={() => {
          refreshPeriodos();
          setShowCerrarDialog(false);
        }}
        periodo={periodoSeleccionado}
      />

      <ReabrirPeriodoDialog
        open={showReabrirDialog}
        onOpenChange={setShowReabrirDialog}
        onSuccess={() => {
          refreshPeriodos();
          setShowReabrirDialog(false);
        }}
        periodo={periodoSeleccionado}
      />

      {/* Approve confirmation dialog */}
      <Dialog open={showAprobarDialog} onOpenChange={setShowAprobarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprobar Período Contable</DialogTitle>
            <DialogDescription>
              Esta acción marca el período como aprobado y es irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAprobarDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => periodoSeleccionado && handleAprobar(periodoSeleccionado)}>
              Aprobar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}