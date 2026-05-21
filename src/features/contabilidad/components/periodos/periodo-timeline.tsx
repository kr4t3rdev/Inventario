'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import type { EventoAuditoria } from "@/lib/services/periodo-contable-types";

/**
 * @description Mapa de iconos para cada tipo de evento de auditoría.
 */
const EVENT_ICONS: Record<string, React.ReactNode> = {
  APERTURA: <Unlock className="h-4 w-4 text-green-500" />,
  CIERRE: <Lock className="h-4 w-4 text-amber-500" />,
  REAPERTURA: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  APROBACION: <CheckCircle className="h-4 w-4 text-blue-500" />,
  BLOQUEO: <XCircle className="h-4 w-4 text-red-500" />,
  ERROR: <AlertTriangle className="h-4 w-4 text-destructive" />,
  INTENTO_BYPASS: <XCircle className="h-4 w-4 text-red-600" />,
};

const EVENT_LABELS: Record<string, string> = {
  APERTURA: "Apertura",
  CIERRE: "Cierre",
  REAPERTURA: "Reapertura",
  APROBACION: "Aprobación",
  BLOQUEO: "Bloqueo",
  ERROR: "Error",
  INTENTO_BYPASS: "Intento de Bypass",
};

const EVENT_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APERTURA: "default",
  CIERRE: "secondary",
  REAPERTURA: "outline",
  APROBACION: "default",
  BLOQUEO: "destructive",
  ERROR: "destructive",
  INTENTO_BYPASS: "destructive",
};

/**
 * @description Timeline de eventos de auditoría para un período contable.
 *
 * @param {Object} props - Props del componente.
 * @param {Array} props.eventos - Lista de eventos de auditoría del período.
 * @param {boolean} [props.isLoading] - Estado de carga.
 */
export function PeriodoTimeline({
  eventos = [],
  isLoading = false,
}: {
  eventos: any[];
  isLoading?: boolean;
}) {
  const [expandido, setExpandido] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Timeline de Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (eventos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Timeline de Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <Calendar className="mx-auto h-8 w-8 mb-2" />
            <p className="text-sm">No hay eventos registrados</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const eventosMostrados = expandido ? eventos : eventos.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Timeline de Auditoría</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {eventosMostrados.map((evento, idx) => (
            <div key={evento.auditoriaId ?? idx} className="flex gap-3 pb-3 border-l-2 border-muted pl-4 relative">
              <div className="absolute -left-[9px] bg-background">
                {EVENT_ICONS[evento.evento] ?? <Calendar className="h-4 w-4" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={EVENT_VARIANTS[evento.evento] ?? "outline"} className="text-xs">
                    {EVENT_LABELS[evento.evento] ?? evento.evento}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(evento.timestamp ?? evento.timestamp), "dd/MM/yyyy HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">{evento.actor ?? "Sistema"}</span>
                  {evento.motivo ? ` — ${evento.motivo}` : ""}
                </p>
                {evento.entidadAfectada && (
                  <p className="text-xs text-muted-foreground">
                    Entidad: {evento.entidadAfectada}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {eventos.length > 5 && (
          <button
            onClick={() => setExpandido(!expandido)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-2"
          >
            {expandido ? (
              <>
                <ChevronRight className="h-4 w-4" />
                Mostrar menos
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Ver {eventos.length - 5} eventos más
              </>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
