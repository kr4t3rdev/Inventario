"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * @description Estado de error unificado para los sub-reportes de inventario y
 * contabilidad. Muestra un mensaje descriptivo y permite reintentar la carga.
 * @param {Object} props - Props del estado de error.
 * @param {string} [props.title="No se pudieron cargar los datos"] - Título del error.
 * @param {string} [props.description] - Detalle adicional (razón, acción sugerida).
 * @param {() => void} [props.onRetry] - Handler para reintentar la carga.
 * @returns {JSX.Element} Tarjeta de error con retry.
 */
export function ReportErrorState({
  title = "No se pudieron cargar los datos",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Card
      role="alert"
      className="border-destructive/30 bg-destructive/5 backdrop-blur-xl"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-destructive/10 p-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-destructive text-base font-semibold">
              {title}
            </CardTitle>
            {description ? (
              <CardDescription className="text-destructive/90">
                {description}
              </CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {onRetry ? (
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reintentar
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}
