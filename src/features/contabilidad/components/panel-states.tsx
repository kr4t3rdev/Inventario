'use client';

import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PanelSkeletonProps {
  /** Filas de contenido a simular bajo el encabezado. */
  rows: number;
  /** Título opcional para dar contexto durante la carga. */
  title?: string;
}

/**
 * @description Estado de carga compartido para las tarjetas del dashboard de contabilidad.
 * Mantiene la silueta de la tarjeta final para evitar saltos de layout.
 * @param {PanelSkeletonProps} props - Filas a simular y título opcional.
 * @returns {JSX.Element} Tarjeta en estado de carga accesible.
 */
export function PanelSkeleton({ rows, title }: PanelSkeletonProps): React.JSX.Element {
  return (
    <Card
      aria-busy="true"
      aria-label="Cargando"
      className="border-slate-200 dark:border-slate-800"
    >
      <CardHeader className="pb-3">
        {title ? (
          <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-300">
            {title}
          </CardTitle>
        ) : (
          <Skeleton className="h-5 w-40" />
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            style={{ width: `${100 - i * 25}%` }}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface PanelErrorProps {
  /** Mensaje legible del fallo para el usuario. */
  message: string;
  /** Callback de reintento; si se omite, el estado es informativo sin acción. */
  onRetry?: () => void;
}

/**
 * @description Estado de error compartido para las tarjetas del dashboard de contabilidad.
 * Expone role="alert" para que los lectores de pantalla anuncien el fallo, y un botón
 * de reintento cuando la operación es recuperable.
 * @param {PanelErrorProps} props - Mensaje y callback de reintento opcional.
 * @returns {JSX.Element} Tarjeta con mensaje de error y acción de reintento.
 */
export function PanelError({ message, onRetry }: PanelErrorProps): React.JSX.Element {
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="py-6">
        <div
          role="alert"
          className="flex flex-col items-center gap-3 text-center"
        >
          <div className="rounded-full bg-rose-50 p-2 dark:bg-rose-950/30">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Intentar nuevamente
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { formatHoraCorta } from '@/features/contabilidad/lib/timestamps';

interface LastUpdatedLabelProps {
  /** Momento de la última carga exitosa. */
  date: Date;
}

/**
 * @description Indicador de frescura con hora absoluta de última actualización.
 * @param {LastUpdatedLabelProps} props - Fecha de la última carga exitosa.
 * @returns {JSX.Element} Leyenda discreta con la hora de actualización.
 */
export function LastUpdatedLabel({ date }: LastUpdatedLabelProps): React.JSX.Element {
  return (
    <p className="text-xs text-slate-400 dark:text-slate-500">
      Actualizado a las {formatHoraCorta(date)}
    </p>
  );
}

interface StaleBannerProps {
  /** Reintenta la actualización fallida. */
  onRetry: () => void;
}

/**
 * @description Aviso ámbar cuando un refetch falla pero se conservan datos anteriores.
 * @param {StaleBannerProps} props - Callback de reintento.
 * @returns {JSX.Element} Banner inline accesible con acción de reintento.
 */
export function StaleBanner({ onRetry }: StaleBannerProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
    >
      <span>No se pudo actualizar. Mostrando los datos anteriores.</span>
      <Button variant="outline" size="sm" onClick={onRetry} className="h-7 px-2 text-xs">
        Intentar nuevamente
      </Button>
    </div>
  );
}
