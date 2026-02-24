/**
 * Componente de exportación de datos
 * @description Panel de control para exportar datos del Dashboard de Inteligencia Cambiaria en múltiples formatos
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import type { ReactElement } from "react";
import { Download, FileJson, FileSpreadsheet, FileText, FileType, Loader2, AlertCircle } from "lucide-react";
import { format as format_date } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Tipo de datos disponibles para exportación
 */
type ExportDataType = "kpis" | "scenarios" | "cost-impact" | "debt-exposure" | "payment-efficiency";

/**
 * Formatos de exportación disponibles
 */
type ExportFormat = "csv" | "excel" | "json" | "text";

/**
 * Opciones de exportación configurables
 */
interface ExportOptions {
  includeHeaders: boolean;
  decimalSeparator: string;
  thousandSeparator: string;
  dateFormat: string;
  title: string;
}

/**
 * Datos de ejemplo para previsualización
 */
const sampleData: Record<ExportDataType, Record<string, unknown>[]> = {
  kpis: [
    { currency: "USD", total_exposure: 1500000, avg_exchange_rate: 4250.50, risk_score: 72.5 },
    { currency: "EUR", total_exposure: 850000, avg_exchange_rate: 4620.75, risk_score: 65.2 },
  ],
  scenarios: [
    { name: "Escenario Base", depreciation_rate: 3.5, inflation_rate: 4.2, total_impact: 125000 },
    { name: "Escenario Pesimista", depreciation_rate: 8.0, inflation_rate: 6.5, total_impact: 380000 },
  ],
  "cost-impact": [
    { date: "2024-01-15", total_cost_increase: 45000, currency: "USD" },
    { date: "2024-01-16", total_cost_increase: 52000, currency: "USD" },
  ],
  "debt-exposure": [
    { date: "2024-01-15", short_term_debt: 850000, long_term_debt: 2100000, currency: "USD" },
  ],
  "payment-efficiency": [
    { date: "2024-01-15", on_time_payments: 45, early_payment_discounts: 12, late_payment_penalties: 3 },
  ],
};

/**
 * Etiquetas descriptivas para tipos de datos
 */
const dataTypeLabels: Record<ExportDataType, string> = {
  kpis: "KPIs y Métricas",
  scenarios: "Escenarios Simulados",
  "cost-impact": "Impacto de Costos",
  "debt-exposure": "Exposición de Deuda",
  "payment-efficiency": "Eficiencia de Pagos",
};

/**
 * Formatea un valor según las opciones de exportación
 */
const format_value = (value: unknown, exportOptions: ExportOptions): string => {
  if (value === null || value === undefined) return "";
  
  if (typeof value === "number") {
    const parts = value.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, exportOptions.thousandSeparator);
    return parts.join(exportOptions.decimalSeparator);
  }
  
  if (value instanceof Date) {
    try {
      return format_date(value, exportOptions.dateFormat);
    } catch {
      return value.toLocaleDateString();
    }
  }

  if (typeof value === "string" && !isNaN(Date.parse(value)) && value.includes("-")) {
    try {
      return format_date(new Date(value), exportOptions.dateFormat);
    } catch {
      return value;
    }
  }
  
  if (typeof value === "object") return JSON.stringify(value);
  
  return String(value);
};

/**
 * Genera contenido CSV
 */
const generate_csv = (
  data: Record<string, unknown>[],
  separator: string,
  exportOptions: ExportOptions
): string => {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const headerRow = exportOptions.includeHeaders ? headers.join(separator) : "";
  const rows = data.map(item =>
    headers.map(header => {
      const value = item[header];
      const formatted = format_value(value, exportOptions);
      // Escape separator if present in string
      if (typeof value === "string" && formatted.includes(separator)) {
        return `"${formatted}"`;
      }
      return formatted;
    }).join(separator)
  );
  return exportOptions.includeHeaders ? [headerRow, ...rows].join("\n") : rows.join("\n");
};

/**
 * Genera contenido Excel (TSV)
 */
const generate_excel = (data: Record<string, unknown>[], exportOptions: ExportOptions): string => {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const separator = "\t";
  const headerRow = exportOptions.includeHeaders ? headers.join(separator) : "";
  const rows = data.map(item =>
    headers.map(header => format_value(item[header], exportOptions)).join(separator)
  );
  return exportOptions.includeHeaders ? [headerRow, ...rows].join("\n") : rows.join("\n");
};

/**
 * Genera contenido JSON
 */
const generate_json = (data: Record<string, unknown>[]): string => {
  return JSON.stringify(data, null, 2);
};

/**
 * Genera contenido de texto legible
 */
const generate_text = (
  data: Record<string, unknown>[],
  exportOptions: ExportOptions
): string => {
  const lines: string[] = [];
  lines.push(exportOptions.title);
  lines.push("=".repeat(exportOptions.title.length));
  lines.push(`Fecha de exportación: ${format_date(new Date(), exportOptions.dateFormat)}`);
  lines.push("");

  data.forEach((item, index) => {
    lines.push(`Registro ${index + 1}:`);
    Object.entries(item).forEach(([key, value]) => {
      lines.push(`  ${key}: ${format_value(value, exportOptions)}`);
    });
    lines.push("");
  });

  return lines.join("\n");
};

/**
 * Componente principal de exportación
 * @description Proporciona interfaz para seleccionar datos, formato y opciones de exportación
 */
export function Export_section(): ReactElement {
  const [dataType, setDataType] = useState<ExportDataType>("kpis");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [options, setOptions] = useState<ExportOptions>({
    includeHeaders: true,
    decimalSeparator: ",",
    thousandSeparator: ".",
    dateFormat: "dd/MM/yyyy",
    title: "Reporte de Inteligencia Cambiaria",
  });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * Maneja el cambio de opción de exportación
   */
  const handle_option_change = useCallback(<K extends keyof ExportOptions>(key: K, value: ExportOptions[K]): void => {
    setOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  /**
   * Genera el contenido del archivo según el formato seleccionado
   */
  const generate_content = useCallback((
    dataTypeSelected: ExportDataType,
    formatSelected: ExportFormat,
    exportOptions: ExportOptions
  ): { content: string; filename: string; mimeType: string } => {
    const data = sampleData[dataTypeSelected];
    const timestamp = format_date(new Date(), "yyyy-MM-dd");
    let content = "";
    let mimeType = "";
    let filename = "";

    const separator = exportOptions.decimalSeparator === "," ? ";" : ",";

    switch (formatSelected) {
      case "csv":
        content = generate_csv(data, separator, exportOptions);
        mimeType = "text/csv;charset=utf-8;";
        filename = `${dataTypeSelected}-export-${timestamp}.csv`;
        break;
      case "excel":
        content = generate_excel(data, exportOptions);
        mimeType = "text/tab-separated-values;charset=utf-8;";
        filename = `${dataTypeSelected}-export-${timestamp}.tsv`;
        break;
      case "json":
        content = generate_json(data);
        mimeType = "application/json;charset=utf-8;";
        filename = `${dataTypeSelected}-export-${timestamp}.json`;
        break;
      case "text":
        content = generate_text(data, exportOptions);
        mimeType = "text/plain;charset=utf-8;";
        filename = `${dataTypeSelected}-export-${timestamp}.txt`;
        break;
    }

    return { content, filename, mimeType };
  }, []);

  /**
   * Memoize the export content for preview to avoid redundant calls
   */
  const export_preview = useMemo(() => 
    generate_content(dataType, format, options),
  [dataType, format, options, generate_content]);

  /**
   * Ejecuta la exportación de datos
   */
  const handle_export = useCallback(async (): Promise<void> => {
    setIsExporting(true);
    setError(null);
    setSuccess(null);

    try {
      const { content, filename, mimeType } = generate_content(dataType, format, options);

      if (!content) {
        throw new Error("No se generó contenido para la exportación");
      }

      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess(`Archivo "${filename}" descargado exitosamente`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido durante la exportación");
    } finally {
      setIsExporting(false);
    }
  }, [dataType, format, options, generate_content]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Exportar Datos
        </CardTitle>
        <CardDescription>
          Exporta los datos del Dashboard de Inteligencia Cambiaria en múltiples formatos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tipo de datos */}
        <div className="space-y-2">
          <Label htmlFor="data-type">Tipo de Datos</Label>
          <Select value={dataType} onValueChange={(value) => setDataType(value as ExportDataType)}>
            <SelectTrigger id="data-type">
              <SelectValue placeholder="Seleccionar tipo de datos" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(dataTypeLabels) as ExportDataType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {dataTypeLabels[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Formato de exportación */}
        <div className="space-y-2">
          <Label>Formato de Exportación</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { value: "csv", label: "CSV", icon: FileType },
              { value: "excel", label: "Excel", icon: FileSpreadsheet },
              { value: "json", label: "JSON", icon: FileJson },
              { value: "text", label: "Texto", icon: FileText },
            ] as const).map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={format === value ? "default" : "outline"}
                className={cn(
                  "justify-start gap-2",
                  format === value && "ring-2 ring-primary"
                )}
                onClick={() => setFormat(value)}
                disabled={isExporting}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Opciones adicionales */}
        <div className="space-y-4 border rounded-lg p-4">
          <h4 className="font-medium">Opciones de Exportación</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título del Reporte</Label>
              <Input
                id="title"
                value={options.title}
                onChange={(e) => handle_option_change("title", e.target.value)}
                placeholder="Título del reporte"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="decimal">Separador Decimal</Label>
              <Select
                value={options.decimalSeparator}
                onValueChange={(value) => handle_option_change("decimalSeparator", value)}
              >
                <SelectTrigger id="decimal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Comma (,)</SelectItem>
                  <SelectItem value=".">Punto (.)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="thousand">Separador Miles</Label>
              <Select
                value={options.thousandSeparator}
                onValueChange={(value) => handle_option_change("thousandSeparator", value)}
              >
                <SelectTrigger id="thousand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=".">Punto (.)</SelectItem>
                  <SelectItem value=",">Comma (,)</SelectItem>
                  <SelectItem value=" ">Espacio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-format">Formato de Fecha</Label>
              <Select
                value={options.dateFormat}
                onValueChange={(value) => handle_option_change("dateFormat", value)}
              >
                <SelectTrigger id="date-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dd/MM/yyyy">DD/MM/AAAA</SelectItem>
                  <SelectItem value="MM/dd/yyyy">MM/DD/AAAA</SelectItem>
                  <SelectItem value="yyyy-MM-dd">AAAA-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="include-headers"
              checked={options.includeHeaders}
              onCheckedChange={(checked) => handle_option_change("includeHeaders", checked)}
            />
            <Label htmlFor="include-headers">Incluir encabezados</Label>
          </div>
        </div>

        {/* Mensajes de estado */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg">
            <Download className="h-4 w-4" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Botón de exportación */}
        <Button
          onClick={handle_export}
          disabled={isExporting}
          className="w-full"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Exportar Datos
            </>
          )}
        </Button>

        {/* Previsualización */}
        <div className="space-y-2">
          <Label>Previsualización</Label>
          <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
            {export_preview.content.slice(0, 500)}
            {export_preview.content.length > 500 && "..."}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

export default Export_section;
