/**
 * API Route para exportación de datos de Inteligencia Cambiaria
 * @description Maneja la exportación de datos en múltiples formatos (CSV, Excel, JSON, Texto)
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Formatos de exportación soportados
 */
type ExportFormat = "csv" | "json" | "excel" | "text";

/**
 * Tipo de datos disponibles para exportación
 */
type ExportDataType = "kpis" | "scenarios" | "cost-impact" | "debt-exposure" | "payment-efficiency";

/**
 * Opciones de exportación
 */
interface ExportOptions {
  title: string;
  decimalSeparator: string;
  thousandSeparator: string;
  dateFormat: string;
  includeHeaders: boolean;
}

/**
 * Estructura para exportación organizada por secciones
 */
interface StructuredExportSection {
  title: string;
  data: Record<string, unknown> | Record<string, unknown>[];
}

interface StructuredExportData {
  sections: StructuredExportSection[];
}

/**
 * Solicitud de exportación
 */
interface ExportRequest {
  dataType: ExportDataType;
  format: ExportFormat;
  data: Record<string, unknown> | Record<string, unknown>[] | StructuredExportData;
  options: ExportOptions;
}

/**
 * Verifica si los datos son estructurados
 */
const is_structured_data = (data: any): data is StructuredExportData => {
  return data && typeof data === "object" && Array.isArray((data as any).sections);
};

/**
 * Convierte datos a formato CSV
 * @param data - Datos a convertir
 * @param options - Opciones de exportación
 * @returns Datos en formato CSV
 */
const convert_to_csv = (
  data: Record<string, unknown> | Record<string, unknown>[] | StructuredExportData,
  options: ExportOptions
): string => {
  const separator = options.decimalSeparator === "," ? ";" : ",";

  if (is_structured_data(data)) {
    return data.sections
      .map((section) => {
        const titleRow = `"${section.title.toUpperCase()}"`;
        const content = convert_to_csv(section.data, options);
        return `${titleRow}\n${content}`;
      })
      .join("\n\n");
  }

  const items = Array.isArray(data) ? data : [data];
  
  if (items.length === 0) {
    return "";
  }

  const headers = Object.keys(items[0]);

  const headerRow = headers.join(separator);
  const rows = items.map((item) =>
    headers
      .map((header) => {
        const value = item[header];
        if (value === null || value === undefined) {
          return "";
        }
        if (typeof value === "number") {
          return String(value).replace(".", options.thousandSeparator).replace(",", options.decimalSeparator);
        }
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      })
      .join(separator)
  );

  return [headerRow, ...rows].join("\n");
};

/**
 * Convierte datos a formato Excel (TSV)
 * @param data - Datos a convertir
 * @returns Datos en formato TSV
 */
const convert_to_excel = (data: Record<string, unknown> | Record<string, unknown>[] | StructuredExportData): string => {
  if (is_structured_data(data)) {
    return data.sections
      .map((section) => {
        const titleRow = section.title.toUpperCase();
        const content = convert_to_excel(section.data);
        return `${titleRow}\n${content}`;
      })
      .join("\n\n");
  }

  const items = Array.isArray(data) ? data : [data];
  
  if (items.length === 0) {
    return "";
  }

  const headers = Object.keys(items[0]);
  const separator = "\t";

  const headerRow = headers.join(separator);
  const rows = items.map((item) =>
    headers
      .map((header) => {
        const value = item[header];
        if (value === null || value === undefined) {
          return "";
        }
        if (typeof value === "object") {
          return JSON.stringify(value);
        }
        return String(value);
      })
      .join(separator)
  );

  return [headerRow, ...rows].join("\n");
};

/**
 * Convierte datos a formato JSON
 * @param data - Datos a convertir
 * @returns Datos en formato JSON
 */
const convert_to_json = (
  data: Record<string, unknown> | Record<string, unknown>[] | StructuredExportData
): string => {
  return JSON.stringify(data, null, 2);
};

/**
 * Convierte datos a formato texto plano legible
 * @param data - Datos a convertir
 * @param options - Opciones de exportación
 * @returns Datos en formato texto legible
 */
const convert_to_text = (
  data: Record<string, unknown> | Record<string, unknown>[] | StructuredExportData,
  options: ExportOptions
): string => {
  const lines: string[] = [];
  lines.push(options.title.toUpperCase());
  lines.push("=".repeat(options.title.length));
  
  const date = new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const formattedDate = options.dateFormat
    .replace("DD", day)
    .replace("MM", month)
    .replace("YYYY", String(year));

  lines.push(`Fecha de exportación: ${formattedDate}`);
  lines.push("");

  if (is_structured_data(data)) {
    data.sections.forEach((section) => {
      lines.push(`>>> ${section.title.toUpperCase()} <<<`);
      lines.push("-".repeat(section.title.length + 8));
      lines.push("");
      
      const items = Array.isArray(section.data) ? section.data : [section.data];
      items.forEach((item, index) => {
        if (items.length > 1) lines.push(`  [Item ${index + 1}]`);
        Object.entries(item).forEach(([key, value]) => {
          if (value === null || value === undefined) return;
          if (typeof value === "object") {
            lines.push(`  ${key}: ${JSON.stringify(value, null, 2).split('\n').join('\n    ')}`);
          } else {
            lines.push(`  ${key}: ${value}`);
          }
        });
        lines.push("");
      });
      lines.push("");
    });
  } else {
    const items = Array.isArray(data) ? data : [data];
    items.forEach((item, index) => {
      lines.push(`Registro ${index + 1}:`);
      Object.entries(item).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        if (typeof value === "object") {
          lines.push(`  ${key}: ${JSON.stringify(value)}`);
        } else {
          lines.push(`  ${key}: ${value}`);
        }
      });
      lines.push("");
    });
  }

  return lines.join("\n");
};

/**
 * Maneja la solicitud POST de exportación
 * @param request - Solicitud HTTP
 * @returns Response con el archivo exportado
 */
const handle_post = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body: ExportRequest = await request.json();
    const { dataType, format, data, options } = body;

    // Validación básica
    if (!dataType || !format || !data) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    let content: string;
    let contentType: string;
    let extension: string;

    switch (format) {
      case "csv":
        content = convert_to_csv(data, options);
        contentType = "text/csv;charset=utf-8;";
        extension = "csv";
        break;
      case "excel":
        content = convert_to_excel(data);
        contentType = "text/tab-separated-values;charset=utf-8;";
        extension = "tsv";
        break;
      case "json":
        content = convert_to_json(data);
        contentType = "application/json;charset=utf-8;";
        extension = "json";
        break;
      case "text":
        content = convert_to_text(data, options);
        contentType = "text/plain;charset=utf-8;";
        extension = "txt";
        break;
      default:
        return NextResponse.json(
          { error: "Formato de exportación no soportado" },
          { status: 400 }
        );
    }

    // Crear blob con el contenido
    const blob = new Blob([content], { type: contentType });

    // Generar nombre de archivo
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${dataType}-export-${timestamp}.${extension}`;

    // Retornar archivo como descarga
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error en exportación:", error);
    return NextResponse.json(
      { error: "Error al procesar la exportación" },
      { status: 500 }
    );
  }
};

/**
 * Maneja la solicitud GET (verificación de estado)
 * @returns Response con estado del endpoint
 */
const handle_get = (): NextResponse => {
  return NextResponse.json({
    status: "active",
    service: "Exchange Intelligence Export API",
    supportedFormats: ["csv", "excel", "json", "text"],
    supportedDataTypes: ["kpis", "scenarios", "cost-impact", "debt-exposure", "payment-efficiency"],
  });
};

export { handle_post as POST, handle_get as GET };
