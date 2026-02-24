/**
 * Componente de exportación de datos del Dashboard de Inteligencia Cambiaria
 * @description Permite exportar datos en múltiples formatos (CSV, Excel, JSON, Texto)
 */

"use client";

import React, { useState } from "react";
import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getAuthToken } from "@/lib/token";

/**
 * Tipo de datos disponibles para exportación
 */
export type ExportDataType =
  | "kpis"
  | "scenarios"
  | "cost-impact"
  | "debt-exposure"
  | "payment-efficiency";

/**
 * Formatos de exportación disponibles
 */
export type ExportFormat = "csv" | "json" | "excel" | "text";

/**
 * Opciones adicionales para la exportación
 */
export interface ExportOptions {
  title: string;
  decimalSeparator: string;
  thousandSeparator: string;
  dateFormat: string;
  includeHeaders: boolean;
}

/**
 * Props del componente ExportDropdown
 */
interface ExportDropdownProps {
  /** Tipo de datos a exportar */
  dataType: ExportDataType;
  /** Datos a exportar */
  data: Record<string, unknown> | Record<string, unknown>[] | { sections: any[] };
  /** Título del reporte */
  title?: string;
  /** Variante del botón */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** Tamaño del botón */
  size?: "default" | "sm" | "lg" | "icon";
  /** Texto personalizado del botón */
  buttonText?: string;
  /** Mostrar como botón simple en lugar de dropdown */
  simple?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

/**
 * Formato de exportación con metadatos
 */
interface ExportFormatOption {
  value: ExportFormat;
  label: string;
  icon: React.ReactNode;
  description: string;
}

/**
 * Opciones de formato disponibles
 */
const EXPORT_FORMATS: ExportFormatOption[] = [
  {
    value: "csv",
    label: "CSV",
    icon: <FileSpreadsheet className="mr-2 h-4 w-4" />,
    description: "Valores separados por comas (organizado por secciones)",
  },
  {
    value: "excel",
    label: "Excel (TSV)",
    icon: <FileSpreadsheet className="mr-2 h-4 w-4" />,
    description: "Valores separados por tabuladores (organizado por tablas)",
  },
  {
    value: "json",
    label: "JSON",
    icon: <FileJson className="mr-2 h-4 w-4" />,
    description: "Formato JavaScript Object Notation estructurado",
  },
  {
    value: "text",
    label: "Texto Plano",
    icon: <FileText className="mr-2 h-4 w-4" />,
    description: "Reporte de texto legible dividido por secciones",
  },
];

/**
 * Componente Dropdown para exportar datos
 * @description Proporciona opciones de exportación en múltiples formatos
 */
export function ExportDropdown({
  dataType,
  data,
  title = "Reporte de Inteligencia Cambiaria",
  variant = "outline",
  size = "default",
  buttonText = "Exportar",
  simple = false,
  className,
}: ExportDropdownProps): React.ReactElement {
  const [isExporting, setIsExporting] = useState(false);
  

  /**
   * Maneja la exportación de datos
   * @param format - Formato de exportación seleccionado
   */
  const handle_export = async (format: ExportFormat): Promise<void> => {
    // Validación de datos mejorada para soportar secciones
    const hasData = data && (
      (Array.isArray(data) && data.length > 0) || 
      (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0)
    );

    if (!hasData) {
      toast.error("No hay datos para exportar");
      return;
    }

    setIsExporting(true);

    try {
      const token = getAuthToken();
      const response = await fetch("/api/contabilidad/exchange/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": token }),
        },
        body: JSON.stringify({
          dataType,
          format,
          data,
          options: {
            title,
            decimalSeparator: ",",
            thousandSeparator: ".",
            dateFormat: "DD/MM/YYYY",
            includeHeaders: true,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al exportar datos");
      }

      const blob = await response.blob();

      // Generar nombre de archivo
      const timestamp = new Date().toISOString().slice(0, 10);
      const extension = format === "excel" ? "tsv" : format;
      const filename = `${title.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.${extension}`;

      // Descargar archivo
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Archivo ${filename} descargado correctamente`);
    } catch (error) {
      console.error("Error en exportación:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo completar la exportación");
    } finally {
      setIsExporting(false);
    }
  };

  // Modo simple: muestra solo el botón principal
  if (simple) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => handle_export("csv")}
        disabled={isExporting || !data}
        className={className}
      >
        {isExporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {buttonText}
      </Button>
    );
  }

  // Modo dropdown: muestra opciones de formato
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isExporting || !data}
          className={className}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {buttonText}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
          Seleccionar formato
        </div>
        <DropdownMenuSeparator />
        {EXPORT_FORMATS.map((format) => (
          <DropdownMenuItem
            key={format.value}
            onClick={() => handle_export(format.value)}
            disabled={isExporting}
            className="flex flex-col items-start py-2"
          >
            <div className="flex items-center">
              {format.icon}
              <span className="font-medium">{format.label}</span>
            </div>
            <span className="ml-6 text-xs text-muted-foreground">
              {format.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportDropdown;
