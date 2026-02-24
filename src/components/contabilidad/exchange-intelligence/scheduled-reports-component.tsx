"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  Play,
  Trash2,
  Edit,
  Mail,
  Plus,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @description Componente para configurar y gestionar reportes programados del dashboard de inteligencia cambiaria
 * @component ScheduledReportsComponent
 */

interface ScheduledReport {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipoReporte: string;
  formato: string;
  parametros: string | null;
  frecuencia: string;
  diaSemana: number | null;
  diaMes: number | null;
  hora: string;
  zonaHoraria: string;
  activo: boolean;
  enviarEmail: boolean;
  destinatarios: string | null;
  asuntoEmail: string | null;
  cuerpoEmail: string | null;
  ultimaEjecucion: string | null;
  proximaEjecucion: string | null;
  totalEjecuciones: number;
  ultimaEjecucionExitosa: boolean;
  fechaCreacion: string;
}

interface ScheduledReportsComponentProps {
  className?: string;
}

export function ScheduledReportsComponent({ className }: ScheduledReportsComponentProps) {
  const queryClient = useQueryClient();
  const [mostrarModal, setMostrarModal] = useState(false);
  const [reporteEditando, setReporteEditando] = useState<ScheduledReport | null>(null);
  const [filtros, setFiltros] = useState({ activo: "", frecuencia: "" });

  // Query para obtener reportes programados
  const { data, isLoading, error } = useQuery({
    queryKey: ["scheduledReports", filtros],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtros.activo) params.append("activo", filtros.activo);
      if (filtros.frecuencia) params.append("frecuencia", filtros.frecuencia);

      const response = await fetch(
        `/api/contabilidad/exchange/scheduled-reports?${params.toString()}`
      );
      if (!response.ok) throw new Error("Error al obtener reportes programados");
      return response.json();
    },
  });

  // Mutation para crear/actualizar reporte
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ScheduledReport>) => {
      const url = reporteEditando
        ? `/api/contabilidad/exchange/scheduled-reports/${reporteEditando.id}`
        : "/api/contabilidad/exchange/scheduled-reports";
      const method = reporteEditando ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Error al guardar reporte");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduledReports"] });
      setMostrarModal(false);
      setReporteEditando(null);
    },
  });

  // Mutation para ejecutar reporte
  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/contabilidad/exchange/scheduled-reports/${id}/execute`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error("Error al ejecutar reporte");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduledReports"] });
    },
  });

  // Mutation para eliminar reporte
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/contabilidad/exchange/scheduled-reports/${id}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Error al eliminar reporte");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduledReports"] });
    },
  });

  // Formatear tipo de reporte
  const formatTipoReporte = (tipo: string) => {
    const tipos: Record<string, string> = {
      COMPLETO: "Reporte Completo",
      COST_IMPACT: "Impacto en Costos",
      DEBT_EXPOSURE: "Exposición de Deuda",
      PAYMENT_EFFICIENCY: "Eficiencia de Pagos",
      KPI: "KPIs",
    };
    return tipos[tipo] || tipo;
  };

  // Formatear frecuencia
  const formatFrecuencia = (frecuencia: string, diaSemana?: number | null, diaMes?: number | null) => {
    switch (frecuencia) {
      case "diaria":
        return "Diario";
      case "semanal":
        const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const diaIndex = typeof diaSemana === "number" ? diaSemana : 1;
        return `Semanal (${dias[diaIndex]})`;
      case "quincenal":
        return "Quincenal (día 15)";
      case "mensual":
        return `Mensual (día ${diaMes || 1})`;
      default:
        return frecuencia;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error al cargar reportes programados</p>
      </div>
    );
  }

  const reportes: ScheduledReport[] = data?.data || [];
  const estadisticas = data?.estadisticas || [];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Reportes Programados
        </h3>
        <button
          onClick={() => {
            setReporteEditando(null);
            setMostrarModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo Reporte
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <select
          value={filtros.activo}
          onChange={(e) => setFiltros({ ...filtros, activo: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <select
          value={filtros.frecuencia}
          onChange={(e) => setFiltros({ ...filtros, frecuencia: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todas las frecuencias</option>
          <option value="diaria">Diaria</option>
          <option value="semanal">Semanal</option>
          <option value="quincenal">Quincenal</option>
          <option value="mensual">Mensual</option>
        </select>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {estadisticas.map((stat: { frecuencia: string; activo: boolean; _count: number }) => (
          <div
            key={`${stat.frecuencia}-${stat.activo}`}
            className={cn(
              "px-4 py-2 rounded-lg border text-center",
              stat.activo ? "bg-green-100 border-green-300" : "bg-gray-100 border-gray-300"
            )}
          >
            <span className="text-2xl font-bold">{stat._count}</span>
            <span className="block text-xs capitalize">
              {stat.frecuencia} ({stat.activo ? "activo" : "inactivo"})
            </span>
          </div>
        ))}
      </div>

      {/* Lista de reportes */}
      <div className="space-y-3">
        {reportes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay reportes programados configurados</p>
            <button
              onClick={() => setMostrarModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              Crear el primer reporte programado
            </button>
          </div>
        ) : (
          reportes.map((reporte) => (
            <div
              key={reporte.id}
              className={cn(
                "border rounded-lg overflow-hidden",
                reporte.activo ? "bg-white" : "bg-gray-50 opacity-75"
              )}
            >
              {/* Header del reporte */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {reporte.activo ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <h4 className="font-medium">{reporte.nombre}</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{formatTipoReporte(reporte.tipoReporte)}</span>
                      <span>•</span>
                      <span>{reporte.formato}</span>
                      <span>•</span>
                      <span>{formatFrecuencia(reporte.frecuencia, reporte.diaSemana, reporte.diaMes)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{reporte.hora}</span>
                  </div>
                  <button
                    onClick={() => executeMutation.mutate(reporte.id)}
                    disabled={executeMutation.isPending}
                    className="p-2 text-green-600 hover:bg-green-100 rounded"
                    title="Ejecutar ahora"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setReporteEditando(reporte);
                      setMostrarModal(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("¿Está seguro de eliminar este reporte programado?")) {
                        deleteMutation.mutate(reporte.id);
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-100 rounded"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Detalles adicionales */}
              <div className="px-4 pb-4 text-sm text-gray-600">
                {reporte.descripcion && <p className="mb-2">{reporte.descripcion}</p>}
                <div className="flex items-center gap-4">
                  {reporte.proximaEjecucion && (
                    <span>
                      Próxima:{" "}
                      {new Intl.DateTimeFormat("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(reporte.proximaEjecucion))}
                    </span>
                  )}
                  {reporte.enviarEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" /> Email
                    </span>
                  )}
                  <span>Total ejecuciones: {reporte.totalEjecuciones}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de creación/edición */}
      {mostrarModal && (
        <ScheduledReportModal
          reporte={reporteEditando}
          onClose={() => {
            setMostrarModal(false);
            setReporteEditando(null);
          }}
          onSave={(data) => saveMutation.mutate(data)}
          isLoading={saveMutation.isPending}
        />
      )}
    </div>
  );
}

/**
 * @description Modal para crear o editar un reporte programado
 */
function ScheduledReportModal({
  reporte,
  onClose,
  onSave,
  isLoading,
}: {
  reporte: ScheduledReport | null;
  onClose: () => void;
  onSave: (data: Partial<ScheduledReport>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    nombre: reporte?.nombre || "",
    descripcion: reporte?.descripcion || "",
    tipoReporte: reporte?.tipoReporte || "COMPLETO",
    formato: reporte?.formato || "PDF",
    frecuencia: reporte?.frecuencia || "semanal",
    diaSemana: reporte?.diaSemana ?? 1,
    diaMes: reporte?.diaMes ?? 1,
    hora: reporte?.hora || "08:00",
    enviarEmail: reporte?.enviarEmail || false,
    destinatarios: (() => {
      if (!reporte?.destinatarios) return [] as string[];
      try {
        const parsed = JSON.parse(reporte.destinatarios);
        return Array.isArray(parsed) ? (parsed as string[]) : [];
      } catch {
        return reporte.destinatarios.split(",").map((s) => s.trim()).filter(Boolean);
      }
    })(),
    asuntoEmail: reporte?.asuntoEmail || "",
    cuerpoEmail: reporte?.cuerpoEmail || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      destinatarios: JSON.stringify(formData.destinatarios),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          {reporte ? "Editar Reporte Programado" : "Nuevo Reporte Programado"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Reporte *
              </label>
              <select
                value={formData.tipoReporte}
                onChange={(e) => setFormData({ ...formData, tipoReporte: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="COMPLETO">Reporte Completo</option>
                <option value="COST_IMPACT">Impacto en Costos</option>
                <option value="DEBT_EXPOSURE">Exposición de Deuda</option>
                <option value="PAYMENT_EFFICIENCY">Eficiencia de Pagos</option>
                <option value="KPI">KPIs</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Formato *
              </label>
              <select
                value={formData.formato}
                onChange={(e) => setFormData({ ...formData, formato: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="PDF">PDF</option>
                <option value="CSV">CSV</option>
                <option value="EXCEL">Excel</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frecuencia *
              </label>
              <select
                value={formData.frecuencia}
                onChange={(e) => setFormData({ ...formData, frecuencia: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="diaria">Diaria</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>

            {formData.frecuencia === "semanal" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Día *
                </label>
                <select
                  value={formData.diaSemana}
                  onChange={(e) => setFormData({ ...formData, diaSemana: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>Domingo</option>
                  <option value={1}>Lunes</option>
                  <option value={2}>Martes</option>
                  <option value={3}>Miércoles</option>
                  <option value={4}>Jueves</option>
                  <option value={5}>Viernes</option>
                  <option value={6}>Sábado</option>
                </select>
              </div>
            )}

            {(formData.frecuencia === "mensual" || formData.frecuencia === "quincenal") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Día del mes *
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.diaMes}
                  onChange={(e) => setFormData({ ...formData, diaMes: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora *
              </label>
              <input
                type="time"
                value={formData.hora}
                onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enviarEmail"
              checked={formData.enviarEmail}
              onChange={(e) => setFormData({ ...formData, enviarEmail: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="enviarEmail" className="text-sm text-gray-700">
              Enviar por email
            </label>
          </div>

          {formData.enviarEmail && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destinatarios (emails separados por coma)
                </label>
                <input
                  type="text"
                  value={formData.destinatarios.join(", ")}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destinatarios: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="email1@ejemplo.com, email2@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asunto del email
                </label>
                <input
                  type="text"
                  value={formData.asuntoEmail}
                  onChange={(e) => setFormData({ ...formData, asuntoEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Guardando..." : reporte ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
