/**
 * Servicio de exportación de datos para el Dashboard de Inteligencia Cambiaria
 * @description Funcionalidades para exportar datos en múltiples formatos (CSV, Excel, JSON, texto)
 */

import {
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
  type ExportColumn,
  type KpiData,
  type ScenarioSimulation,
  type CostImpactData,
  type DebtExposureData,
  type PaymentEfficiencyData,
} from "./export-types";

/**
 * Genera un nombre de archivo con timestamp
 * @param baseName - Nombre base del archivo
 * @param extension - Extensión del archivo
 * @returns Nombre de archivo con timestamp
 */
function generate_filename(baseName: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${baseName}-${timestamp}.${extension}`;
}

/**
 * Formatea un valor según el tipo especificado
 * @param value - Valor a formatear
 * @param type - Tipo de dato
 * @param options - Opciones de formato
 * @returns Valor formateado como string
 */
function format_value(
  value: unknown,
  type: ExportColumn["type"],
  options?: Partial<ExportOptions>
): string {
  const decimalSeparator = options?.decimalSeparator || ",";
  const thousandSeparator = options?.thousandSeparator || ".";
  const dateFormat = options?.dateFormat || "es-DO";

  switch (type) {
    case "number":
    case "currency": {
      if (typeof value !== "number" || isNaN(value)) {
        return "";
      }

      // Configuración básica para el formateador
      const formatter = new Intl.NumberFormat("es-DO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      let formatted = formatter.format(value);

      // Aplicar separadores personalizados si son diferentes a los de es-DO
      // es-DO usa coma para decimales y punto para miles por defecto
      if (decimalSeparator !== "," || thousandSeparator !== ".") {
        formatted = formatted
          .replace(/\./g, "TEMP_DOT")
          .replace(/,/g, decimalSeparator)
          .replace(/TEMP_DOT/g, thousandSeparator);
      }

      return type === "currency" ? `$${formatted}` : formatted;
    }
    case "date": {
      if (!value) return "";
      const date = new Date(value as string);
      return date.toLocaleDateString(dateFormat);
    }
    case "boolean": {
      return value ? "Sí" : "No";
    }
    case "json": {
      return JSON.stringify(value, null, 2);
    }
    default:
      return String(value ?? "");
  }
}

/**
 * Convierte un objeto a formato CSV
 * @param data - Datos a convertir
 * @param columns - Configuración de columnas
 * @param options - Opciones de exportación
 * @returns Datos en formato CSV
 */
function to_csv(
  data: any[],
  columns: ExportColumn[],
  options?: Partial<ExportOptions>
): string {
  const includeHeaders = options?.includeHeaders ?? true;
  const lines: string[] = [];

  if (includeHeaders) {
    const headers = columns.map((col) => `"${col.header}"`).join(",");
    lines.push(headers);
  }

  for (const row of data) {
    const values = columns.map((col) => {
      const value = (row as any)[col.key];
      const formatted = format_value(value, col.type, options);
      return `"${formatted.replace(/"/g, '""')}"`;
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

/**
 * Convierte un objeto a formato JSON
 * @param data - Datos a convertir
 * @returns Datos en formato JSON
 */
function to_json(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Convierte un objeto a formato de texto legible
 * @param data - Datos a convertir
 * @param columns - Configuración de columnas
 * @param title - Título del reporte
 * @returns Datos en formato de texto
 */
function to_text(
  data: any[],
  columns: ExportColumn[],
  options?: Partial<ExportOptions>
): string {
  const lines: string[] = [];
  const title = options?.title;

  if (title) {
    lines.push("=".repeat(60));
    lines.push(title.toUpperCase());
    lines.push("=".repeat(60));
    lines.push("");
  }

  if (data.length > 0) {
    const maxWidths = columns.map((col) => {
      const headerWidth = col.header.length;
      const dataWidths = data.map((row) => {
        const val = (row as any)[col.key];
        return format_value(val, col.type, options).length;
      });
      const maxDataWidth = Math.max(...dataWidths);
      return Math.min(Math.max(headerWidth, maxDataWidth), 40);
    });

    const separator = maxWidths.map((w) => "-".repeat(w + 2)).join("+");

    const headerRow = columns
      .map((col, i) => col.header.padEnd(maxWidths[i] + 2))
      .join("|");
    lines.push(separator);
    lines.push(headerRow);
    lines.push(separator);

    for (const row of data) {
      const values = columns
        .map((col, i) => {
          const val = (row as any)[col.key];
          const formatted = format_value(val, col.type, options);
          return formatted.padEnd(maxWidths[i] + 2);
        })
        .join("|");
      lines.push(values);
    }
    lines.push(separator);
  }

  lines.push("");
  lines.push(`Generado: ${new Date().toLocaleString("es-DO")}`);

  return lines.join("\n");
}

/**
 * Convierte datos a formato Excel simplificado (TSV)
 * @param data - Datos a convertir
 * @param columns - Configuración de columnas
 * @param options - Opciones de exportación
 * @returns Datos en formato TSV (compatible con Excel)
 */
function to_excel(
  data: any[],
  columns: ExportColumn[],
  options?: Partial<ExportOptions>
): string {
  const lines: string[] = [];

  const headers = columns.map((col) => col.header).join("\t");
  lines.push(headers);

  for (const row of data) {
    const values = columns.map((col) => {
      const value = (row as any)[col.key];
      return format_value(value, col.type, options);
    });
    lines.push(values.join("\t"));
  }

  return lines.join("\n");
}

/**
 * Servicio de exportación
 */
export const export_service = {
  /**
   * Exporta datos de KPIs
   * @param data - Datos de KPIs
   * @param format - Formato de exportación
   * @param options - Opciones de exportación
   * @returns Resultado de exportación
   */
  export_kpis(
    data: KpiData,
    format: ExportFormat,
    options?: Partial<ExportOptions>
  ): ExportResult {
    const columns: ExportColumn[] = [
      { key: "currency", header: "Moneda", type: "string" },
      { key: "totalExposure", header: "Exposición Total", type: "currency" },
      { key: "avgExchangeRate", header: "Tipo de Cambio Promedio", type: "currency" },
      { key: "totalDebtUsd", header: "Deuda Total (USD)", type: "currency" },
      { key: "riskScore", header: "Score de Riesgo", type: "number" },
      { key: "hedgingCoverage", header: "Cobertura de Hedging", type: "number" },
      { key: "date", header: "Fecha", type: "date" },
    ];

    const tableData = [data];

    const content =
      format === "json"
        ? to_json(data)
        : format === "excel"
          ? to_excel(tableData, columns, options)
          : format === "text"
            ? to_text(tableData, columns, { ...options, title: options?.title || "Reporte de KPIs" })
            : to_csv(tableData, columns, options);

    return {
      content,
      filename: generate_filename("kpi-report", format === "excel" ? "tsv" : format),
      mimeType: format === "json" ? "application/json" : format === "excel" ? "text/tab-separated-values" : "text/csv",
      format,
      size: new Blob([content]).size,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Exporta datos de escenarios simulados
   * @param scenarios - Lista de escenarios
   * @param format - Formato de exportación
   * @param options - Opciones de exportación
   * @returns Resultado de exportación
   */
  export_scenarios(
    scenarios: ScenarioSimulation[],
    format: ExportFormat,
    options?: Partial<ExportOptions>
  ): ExportResult {
    const columns: ExportColumn[] = [
      { key: "name", header: "Nombre del Escenario", type: "string" },
      { key: "depreciationRate", header: "Tasa de Depreciación (%)", type: "number" },
      { key: "inflationRate", header: "Tasa de Inflación (%)", type: "number" },
      { key: "totalImpact", header: "Impacto Total", type: "currency" },
      { key: "adjustedDebt", header: "Deuda Ajustada", type: "currency" },
      { key: "currency", header: "Moneda", type: "string" },
    ];

    const content =
      format === "json"
        ? to_json(scenarios)
        : format === "excel"
          ? to_excel(scenarios, columns, options)
          : format === "text"
            ? to_text(scenarios, columns, { ...options, title: options?.title || "Simulación de Escenarios" })
            : to_csv(scenarios, columns, options);

    return {
      content,
      filename: generate_filename("scenario-simulation", format === "excel" ? "tsv" : format),
      mimeType: format === "json" ? "application/json" : format === "excel" ? "text/tab-separated-values" : "text/csv",
      format,
      size: new Blob([content]).size,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Exporta datos de impacto de costos
   * @param data - Datos de impacto de costos
   * @param format - Formato de exportación
   * @param options - Opciones de exportación
   * @returns Resultado de exportación
   */
  export_cost_impact(
    data: CostImpactData,
    format: ExportFormat,
    options?: Partial<ExportOptions>
  ): ExportResult {
    const columns: ExportColumn[] = [
      { key: "date", header: "Fecha", type: "date" },
      { key: "totalCostIncrease", header: "Incremento Total de Costos", type: "currency" },
      { key: "currency", header: "Moneda", type: "string" },
    ];

    const tableData = [data];

    const content =
      format === "json"
        ? to_json(data)
        : format === "excel"
          ? to_excel(tableData, columns, options)
          : format === "text"
            ? to_text(tableData, columns, { ...options, title: options?.title || "Reporte de Impacto de Costos" })
            : to_csv(tableData, columns, options);

    return {
      content,
      filename: generate_filename("cost-impact-report", format === "excel" ? "tsv" : format),
      mimeType: format === "json" ? "application/json" : format === "excel" ? "text/tab-separated-values" : "text/csv",
      format,
      size: new Blob([content]).size,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Exporta datos de exposición de deuda
   * @param data - Datos de exposición de deuda
   * @param format - Formato de exportación
   * @param options - Opciones de exportación
   * @returns Resultado de exportación
   */
  export_debt_exposure(
    data: DebtExposureData,
    format: ExportFormat,
    options?: Partial<ExportOptions>
  ): ExportResult {
    const columns: ExportColumn[] = [
      { key: "date", header: "Fecha", type: "date" },
      { key: "shortTermDebt", header: "Deuda Corto Plazo", type: "currency" },
      { key: "longTermDebt", header: "Deuda Largo Plazo", type: "currency" },
      { key: "currency", header: "Moneda", type: "string" },
    ];

    const tableData = [data];

    const content =
      format === "json"
        ? to_json(data)
        : format === "excel"
          ? to_excel(tableData, columns, options)
          : format === "text"
            ? to_text(tableData, columns, { ...options, title: options?.title || "Reporte de Exposición de Deuda" })
            : to_csv(tableData, columns, options);

    return {
      content,
      filename: generate_filename("debt-exposure-report", format === "excel" ? "tsv" : format),
      mimeType: format === "json" ? "application/json" : format === "excel" ? "text/tab-separated-values" : "text/csv",
      format,
      size: new Blob([content]).size,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Exporta datos de eficiencia de pagos
   * @param data - Datos de eficiencia de pagos
   * @param format - Formato de exportación
   * @param options - Opciones de exportación
   * @returns Resultado de exportación
   */
  export_payment_efficiency(
    data: PaymentEfficiencyData,
    format: ExportFormat,
    options?: Partial<ExportOptions>
  ): ExportResult {
    const columns: ExportColumn[] = [
      { key: "date", header: "Fecha", type: "date" },
      { key: "onTimePayments", header: "Puntuales", type: "number" },
      { key: "earlyPaymentDiscounts", header: "Descuentos por Pago Anticipado", type: "currency" },
      { key: "latePaymentPenalties", header: "Penalidades por Pago Tardío", type: "currency" },
      { key: "currency", header: "Moneda", type: "string" },
    ];

    const tableData = [data];

    const content =
      format === "json"
        ? to_json(data)
        : format === "excel"
          ? to_excel(tableData, columns, options)
          : format === "text"
            ? to_text(tableData, columns, { ...options, title: options?.title || "Reporte de Eficiencia de Pagos" })
            : to_csv(tableData, columns, options);

    return {
      content,
      filename: generate_filename("payment-efficiency-report", format === "excel" ? "tsv" : format),
      mimeType: format === "json" ? "application/json" : format === "excel" ? "text/tab-separated-values" : "text/csv",
      format,
      size: new Blob([content]).size,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Exporta datos personalizados
   * @param data - Datos a exportar
   * @param columns - Configuración de columnas
   * @param format - Formato de exportación
   * @param options - Opciones de exportación
   * @returns Resultado de exportación
   */
  export_custom(
    data: Record<string, unknown>[],
    columns: ExportColumn[],
    format: ExportFormat,
    options?: Partial<ExportOptions>
  ): ExportResult {
    const content =
      format === "json"
        ? to_json(data)
        : format === "excel"
          ? to_excel(data, columns, options)
          : format === "text"
            ? to_text(data, columns, options)
            : to_csv(data, columns, options);

    return {
      content,
      filename: generate_filename("custom-export", format === "excel" ? "tsv" : format),
      mimeType: format === "json" ? "application/json" : format === "excel" ? "text/tab-separated-values" : "text/csv",
      format,
      size: new Blob([content]).size,
      timestamp: new Date().toISOString(),
    };
  },
};
