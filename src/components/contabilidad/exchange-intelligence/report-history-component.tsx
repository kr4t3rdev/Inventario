"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  FileText,
  Download,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @description Componente para visualizar el historial de reportes del dashboard de inteligencia cambiaria
 * @component ReportHistoryComponent
 * @param {Object} props - Propiedades del componente
 * @param {boolean} [props.mostrarComparacion=false] - Habilitar comparación entre reportes
 */

interface ReportHistoryItem {
  id: string;
  tipoReporte: string;
  formato: string;
  nombre: string;
  descripcion: string | null;
  parametros: string | null;
  resumenEjecutivo: string | null;
  numeroAlertas: number;
  metricasClave: string | null;
  rutaArchivo: string | null;
  tamanhoArchivo: number | null;
  generadoPor: string;
  fechaGeneracion: string;
  reporteBaseId: string | null;
  comparacion: string | null;
}

interface ReportHistoryComponentProps {
  mostrarComparacion?: boolean;
}

export function ReportHistoryComponent({
  mostrarComparacion = false,
}: ReportHistoryComponentProps) {
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [filtros, setFiltros] = useState({
    tipoReporte: "",
    formato: "",
  });
  const [busqueda, setBusqueda] = useState("");
  const [reporteSeleccionado, setReporteSeleccionado] = useState<string | null>(null);

  // Query para obtener reportes
  const { data, isLoading, error } = useQuery({
    queryKey: ["reportHistory", filtros],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtros.tipoReporte) params.append("tipoReporte", filtros.tipoReporte);
      if (filtros.formato) params.append("formato", filtros.formato);

      const response = await fetch(
        `/api/contabilidad/exchange/report-history?${params.toString()}`
      );
      if (!response.ok) throw new Error("Error al obtener reportes");
      return response.json();
    },
  });

  // Query para comparar reportes
  const { data: comparacionData } = useQuery({
    queryKey: ["reportComparison", reporteSeleccionado],
    queryFn: async () => {
      if (!reporteSeleccionado) return null;
      const response = await fetch(
        `/api/contabilidad/exchange/report-history/${reporteSeleccionado}`
      );
      if (!response.ok) throw new Error("Error al comparar reportes");
      return response.json();
    },
    enabled: !!reporteSeleccionado,
  });

  // Formatear tipo de reporte
  const formatTipoReporte = (tipo: string) => {
    const tipos: Record<string, string> = {
      COMPLETO: "Reporte Completo",
      COST_IMPACT: "Impacto en Costos",
      DEBT_EXPOSURE: "Exposición de Deuda",
      PAYMENT_EFFICIENCY: "Eficiencia de Pagos",
      KPI: "KPIs",
      CUSTOM: "Personalizado",
    };
    return tipos[tipo] || tipo;
  };

  // Obtener icono de formato
  const getFormatoIcon = (formato: string) => {
    switch (formato) {
      case "PDF":
        return "📄";
      case "CSV":
        return "📊";
      case "EXCEL":
        return "📈";
      default:
        return "📋";
    }
  };

  // Obtener color de tendencia
  const getTendenciaIcon = (diferencia: number) => {
    if (diferencia > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (diferencia < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  // Filtrar reportes por búsqueda
  const reportesFiltrados = (data?.data || []).filter((reporte: ReportHistoryItem) =>
    reporte.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    reporte.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  );

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
        <p className="text-red-600">Error al cargar el historial de reportes</p>
      </div>
    );
  }

  const reportes: ReportHistoryItem[] = data?.data || [];
  const estadisticas = data?.estadisticas || [];

  return (
    <div className="space-y-4">
      {/* Header con búsqueda y filtros */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Historial de Reportes
        </h3>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar reportes..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filtros.tipoReporte}
            onChange={(e) =>
              setFiltros({ ...filtros, tipoReporte: e.target.value })
            }
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos los tipos</option>
            <option value="COMPLETO">Completo</option>
            <option value="COST_IMPACT">Impacto en Costos</option>
            <option value="DEBT_EXPOSURE">Exposición de Deuda</option>
            <option value="PAYMENT_EFFICIENCY">Eficiencia de Pagos</option>
            <option value="KPI">KPIs</option>
            <option value="CUSTOM">Personalizado</option>
          </select>
          <select
            value={filtros.formato}
            onChange={(e) =>
              setFiltros({ ...filtros, formato: e.target.value })
            }
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos los formatos</option>
            <option value="PDF">PDF</option>
            <option value="CSV">CSV</option>
            <option value="EXCEL">Excel</option>
          </select>
        </div>
      </div>

      {/* Panel de comparación */}
      {mostrarComparacion && reportes.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-3">
            Comparación de Reportes
          </h4>
          <p className="text-sm text-blue-700 mb-4">
            Selecciona un reporte para ver su comparación con el reporte anterior:
          </p>
          <select
            value={reporteSeleccionado || ""}
            onChange={(e) => setReporteSeleccionado(e.target.value)}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Seleccionar reporte para comparar...</option>
            {reportes.map((reporte) => (
              <option key={reporte.id} value={reporte.id}>
                {reporte.nombre} ({format(new Date(reporte.fechaGeneracion), "dd/MM/yyyy HH:mm")})
              </option>
            ))}
          </select>

          {comparacionData?.comparacion && (
            <div className="mt-4 p-4 bg-white rounded-lg">
              <h5 className="font-medium mb-2">Resultados de Comparación</h5>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-bold">
                      {comparacionData.comparacion.diferenciaAlertas}
                    </span>
                    {getTendenciaIcon(
                      comparacionData.comparacion.diferenciaAlertas
                    )}
                  </div>
                  <span className="text-sm text-gray-600">
                    Diferencia en Alertas
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-2xl font-bold capitalize">
                    {comparacionData.comparacion.tendenciaAlertas}
                  </span>
                  <span className="block text-sm text-gray-600">
                    Tendencia
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-2xl font-bold">
                    {comparacionData.comparacion.diferenciaDias}
                  </span>
                  <span className="block text-sm text-gray-600">
                    Días entre reportes
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {estadisticas.map((stat: { formato: string; _count: number }) => (
          <div
            key={stat.formato}
            className="px-4 py-2 bg-gray-100 rounded-lg border text-center"
          >
            <span className="text-2xl font-bold">
              {getFormatoIcon(stat.formato)} {stat._count}
            </span>
            <span className="block text-xs">{stat.formato}</span>
          </div>
        ))}
      </div>

      {/* Lista de reportes */}
      <div className="space-y-3">
        {reportesFiltrados.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No se encontraron reportes con los filtros aplicados</p>
          </div>
        ) : (
          reportesFiltrados.map((reporte: ReportHistoryItem) => (
            <div
              key={reporte.id}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Header del reporte */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() =>
                  setExpandedReport(
                    expandedReport === reporte.id ? null : reporte.id
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {getFormatoIcon(reporte.formato)}
                  </span>
                  <div>
                    <h4 className="font-medium">{reporte.nombre}</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{formatTipoReporte(reporte.tipoReporte)}</span>
                      <span>•</span>
                      <span>{reporte.formato}</span>
                      {reporte.numeroAlertas > 0 && (
                        <>
                          <span>•</span>
                          <span
                            className={cn(
                              "font-medium",
                              reporte.numeroAlertas > 5
                                ? "text-red-600"
                                : "text-gray-600"
                            )}
                          >
                            {reporte.numeroAlertas} alertas
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {format(new Date(reporte.fechaGeneracion), "dd/MM/yyyy HH:mm")}
                  </span>
                  {expandedReport === reporte.id ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Detalle expandido */}
              {expandedReport === reporte.id && (
                <div className="p-4 bg-gray-50 border-t">
                  {reporte.descripcion && (
                    <p className="text-gray-700 mb-4">{reporte.descripcion}</p>
                  )}

                  {reporte.resumenEjecutivo && (
                    <div className="mb-4">
                      <h5 className="font-medium text-gray-900 mb-2">
                        Resumen Ejecutivo
                      </h5>
                      <p className="text-gray-700 text-sm">
                        {reporte.resumenEjecutivo}
                      </p>
                    </div>
                  )}

                  {reporte.metricasClave && (
                    <div className="mb-4">
                      <h5 className="font-medium text-gray-900 mb-2">
                        Métricas Clave
                      </h5>
                      <div className="bg-white p-3 rounded border text-sm font-mono">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(
                            JSON.parse(reporte.metricasClave),
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <span>
                      Generado por: <strong>{reporte.generadoPor}</strong>
                    </span>
                    {reporte.tamanhoArchivo && (
                      <span>
                        Tamaño: {(reporte.tamanhoArchivo / 1024).toFixed(2)} KB
                      </span>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2">
                    {reporte.rutaArchivo && (
                      <a
                        href={reporte.rutaArchivo}
                        download
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        <Download className="h-4 w-4" />
                        Descargar
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReporteSeleccionado(reporte.id);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Comparar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Implementar eliminación
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Paginación */}
      {data?.pagination && data.pagination.total > data.pagination.limit && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Mostrando {reportesFiltrados.length} de {data.pagination.total} reportes
          </span>
          <div className="flex gap-2">
            <button
              disabled={data.pagination.offset === 0}
              className="px-3 py-1 text-sm bg-gray-100 rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              disabled={!data.pagination.hasMore}
              className="px-3 py-1 text-sm bg-gray-100 rounded disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
