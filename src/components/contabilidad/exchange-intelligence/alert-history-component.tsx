"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @description Componente para visualizar el historial de alertas del dashboard de inteligencia cambiaria
 * @component AlertHistoryComponent
 * @param {Object} props - Propiedades del componente
 * @param {string} [props.filtroTipo] - Filtrar por tipo de alerta
 * @param {string} [props.filtroSeveridad] - Filtrar por severidad
 */

interface AlertHistoryItem {
  id: string;
  tipoAlerta: string;
  severidad: string;
  titulo: string;
  mensaje: string;
  metric: string | null;
  umbral: string | null;
  entidadTipo: string | null;
  entidadId: string | null;
  moneda: string | null;
  estado: string;
  revisadaPor: string | null;
  fechaRevision: string | null;
  notasRevision: string | null;
  fechaAlerta: string;
}

interface AlertHistoryComponentProps {
  filtroTipo?: string;
  filtroSeveridad?: string;
}

export function AlertHistoryComponent({
  filtroTipo,
  filtroSeveridad,
}: AlertHistoryComponentProps) {
  const queryClient = useQueryClient();
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [filtros, setFiltros] = useState({
    tipoAlerta: filtroTipo || "",
    severidad: filtroSeveridad || "",
    estado: "",
  });
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Query para obtener alertas
  const { data, isLoading, error } = useQuery({
    queryKey: ["alertHistory", filtros, offset, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtros.tipoAlerta) params.append("tipoAlerta", filtros.tipoAlerta);
      if (filtros.severidad) params.append("severidad", filtros.severidad);
      if (filtros.estado) params.append("estado", filtros.estado);
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());

      const response = await fetch(
        `/api/contabilidad/exchange/alert-history?${params.toString()}`
      );
      if (!response.ok) throw new Error("Error al obtener alertas");
      return response.json();
    },
  });

  // Resetear paginación cuando cambian los filtros
  const handleFiltroChange = (nuevosFiltros: Partial<typeof filtros>) => {
    setFiltros((prev) => ({ ...prev, ...nuevosFiltros }));
    setOffset(0);
  };

  // Mutation para actualizar estado de alerta
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      estado,
      notasRevision,
    }: {
      id: string;
      estado: string;
      notasRevision?: string;
    }) => {
      const response = await fetch(
        `/api/contabilidad/exchange/alert-history/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado, notasRevision }),
        }
      );
      if (!response.ok) throw new Error("Error al actualizar alerta");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertHistory"] });
    },
  });

  // Obtener iconos de severidad
  const getSeveridadIcon = (severidad: string) => {
    switch (severidad) {
      case "critica":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "alta":
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case "media":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "baja":
        return <AlertTriangle className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  // Obtener colores de severidad
  const getSeveridadColor = (severidad: string) => {
    switch (severidad) {
      case "critica":
        return "bg-red-100 border-red-300 text-red-800";
      case "alta":
        return "bg-orange-100 border-orange-300 text-orange-800";
      case "media":
        return "bg-yellow-100 border-yellow-300 text-yellow-800";
      case "baja":
        return "bg-blue-100 border-blue-300 text-blue-800";
      default:
        return "bg-gray-100 border-gray-300 text-gray-800";
    }
  };

  // Obtener iconos de estado
  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case "resuelta":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "descartada":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case "revisada":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-orange-500" />;
    }
  };

  // Formatear tipo de alerta
  const formatTipoAlerta = (tipo: string) => {
    const tipos: Record<string, string> = {
      COST_IMPACT: "Impacto en Costos",
      DEBT_EXPOSURE: "Exposición de Deuda",
      PAYMENT_EFFICIENCY: "Eficiencia de Pagos",
      BREAK_EVEN: "Tasa de Equilibrio",
      MARGIN: "Margen de Ganancia",
      EXCHANGE_DIFFERENTIAL: "Diferencial Cambiario",
      DEBT_PRIORITY: "Prioridad de Deuda",
    };
    return tipos[tipo] || tipo;
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
        <p className="text-red-600">Error al cargar el historial de alertas</p>
      </div>
    );
  }

  const alertas: AlertHistoryItem[] = data?.data || [];
  const estadisticas = data?.estadisticas || [];

  return (
    <div className="space-y-4">
      {/* Header con filtros */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Historial de Alertas
        </h3>
        <button
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Filter className="h-4 w-4" />
          <span className="text-sm">Filtros</span>
          {mostrarFiltros ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Panel de filtros */}
      {mostrarFiltros && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Alerta
              </label>
              <select
                value={filtros.tipoAlerta}
                onChange={(e) =>
                  handleFiltroChange({ tipoAlerta: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                <option value="COST_IMPACT">Impacto en Costos</option>
                <option value="DEBT_EXPOSURE">Exposición de Deuda</option>
                <option value="PAYMENT_EFFICIENCY">Eficiencia de Pagos</option>
                <option value="BREAK_EVEN">Tasa de Equilibrio</option>
                <option value="MARGIN">Margen de Ganancia</option>
                <option value="EXCHANGE_DIFFERENTIAL">Diferencial Cambiario</option>
                <option value="DEBT_PRIORITY">Prioridad de Deuda</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severidad
              </label>
              <select
                value={filtros.severidad}
                onChange={(e) =>
                  handleFiltroChange({ severidad: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todas</option>
                <option value="critica">Crítica</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={filtros.estado}
                onChange={(e) =>
                  handleFiltroChange({ estado: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                <option value="activa">Activa</option>
                <option value="revisada">Revisada</option>
                <option value="descartada">Descartada</option>
                <option value="resuelta">Resuelta</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {estadisticas.map((stat: { severidad: string; _count: number }) => (
          <div
            key={stat.severidad}
            className={cn(
              "px-4 py-2 rounded-lg border text-center",
              getSeveridadColor(stat.severidad)
            )}
          >
            <span className="text-2xl font-bold">{stat._count}</span>
            <span className="block text-xs capitalize">{stat.severidad}</span>
          </div>
        ))}
      </div>

      {/* Lista de alertas */}
      <div className="space-y-3">
        {alertas.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No se encontraron alertas con los filtros aplicados</p>
          </div>
        ) : (
          alertas.map((alerta) => (
            <div
              key={alerta.id}
              className={cn(
                "border rounded-lg overflow-hidden transition-colors",
                getSeveridadColor(alerta.severidad)
              )}
            >
              {/* Header de la alerta */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:opacity-90"
                onClick={() =>
                  setExpandedAlert(
                    expandedAlert === alerta.id ? null : alerta.id
                  )
                }
              >
                <div className="flex items-center gap-3">
                  {getSeveridadIcon(alerta.severidad)}
                  <div>
                    <h4 className="font-medium">{alerta.titulo}</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{formatTipoAlerta(alerta.tipoAlerta)}</span>
                      {alerta.moneda && (
                        <>
                          <span>•</span>
                          <span>{alerta.moneda}</span>
                        </>
                      )}
                      {alerta.metric && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{alerta.metric}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getEstadoIcon(alerta.estado)}
                    <span className="text-sm capitalize">{alerta.estado}</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {new Intl.DateTimeFormat("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(alerta.fechaAlerta))}
                  </span>
                </div>
              </div>

              {/* Detalle expandido */}
              {expandedAlert === alerta.id && (
                <div className="p-4 bg-white border-t">
                  <p className="text-gray-700 mb-4">{alerta.mensaje}</p>

                  {alerta.umbral && (
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Umbral:</strong> {alerta.umbral}
                    </p>
                  )}

                  {alerta.entidadTipo && alerta.entidadId && (
                    <p className="text-sm text-gray-600 mb-4">
                      <strong>Entidad:</strong> {alerta.entidadTipo}(
                      {alerta.entidadId})
                    </p>
                  )}

                  {/* Acciones */}
                  {alerta.estado === "activa" && (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateMutation.mutate({
                            id: alerta.id,
                            estado: "revisada",
                          });
                        }}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Marcar como Revisada
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateMutation.mutate({
                            id: alerta.id,
                            estado: "resuelta",
                          });
                        }}
                        className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        Resolver
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateMutation.mutate({
                            id: alerta.id,
                            estado: "descartada",
                          });
                        }}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Paginación */}
      {data?.total > limit && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Mostrando {alertas.length} de {data.total} alertas
          </span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-3 py-1 text-sm bg-gray-100 rounded disabled:opacity-50 hover:bg-gray-200"
            >
              Anterior
            </button>
            <button
              disabled={offset + limit >= data.total}
              onClick={() => setOffset(offset + limit)}
              className="px-3 py-1 text-sm bg-gray-100 rounded disabled:opacity-50 hover:bg-gray-200"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
