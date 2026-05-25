/**
 * @description Banner de advertencia que se muestra cuando un período contable está cerrado.
 * Se usa en formularios para informar que no se pueden realizar operaciones en esa fecha.
 *
 * @example
 * ```tsx
 * {isLocked && <PeriodLockBanner message={message!} periodo={periodo!} />}
 * ```
 *
 * @example Con skeleton mientras se verifica:
 * ```tsx
 * {checking && <PeriodLockBanner.Skeleton />}
 * {isLocked && <PeriodLockBanner message={message!} periodo={periodo!} />}
 * ```
 */
import { AlertTriangle, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export interface PeriodLockBannerProps {
  /** Mensaje descriptivo del bloqueo */
  message: string;
  /** Datos del período bloqueante */
  periodo: { nombre: string; estado: string };
  /** Variante visual */
  variant?: 'warning' | 'error';
}

/**
 * @description Muestra un banner con alerta de período bloqueado.
 *
 * @param {PeriodLockBannerProps} props - Props del banner.
 * @param {string} props.message - Mensaje descriptivo del bloqueo (ej: "El período Marzo 2026 está Cerrado").
 * @param {{ nombre: string; estado: string }} props.periodo - Datos del período.
 * @param {'warning' | 'error'} [props.variant='error'] - Variante visual.
 * @returns {JSX.Element} Banner de advertencia.
 */
export function PeriodLockBanner({ message, periodo, variant = 'error' }: PeriodLockBannerProps) {
  const isWarning = variant === 'warning';
  const bgColor = isWarning
    ? 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
    : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
  const textColor = isWarning
    ? 'text-amber-800 dark:text-amber-200'
    : 'text-red-800 dark:text-red-200';
  const iconColor = isWarning
    ? 'text-amber-500'
    : 'text-red-500';

  return (
    <div className={`flex items-start gap-3 px-4 py-3 border rounded-lg ${bgColor} ${textColor}`} role="alert">
      {isWarning
        ? <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconColor}`} aria-hidden="true" />
        : <Lock className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconColor}`} aria-hidden="true" />
      }
      <div className="text-sm">
        <p className="font-medium">Período bloqueado</p>
        <p className="mt-1">{message}</p>
      </div>
    </div>
  );
}

/**
 * @description Skeleton para el banner de bloqueo, útil mientras se verifica el período.
 * @returns {JSX.Element} Skeleton del banner.
 */
PeriodLockBanner.Skeleton = function PeriodLockBannerSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border rounded-lg border-gray-200 dark:border-gray-700">
      <Skeleton className="h-5 w-5 rounded mt-0.5" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-64" />
      </div>
    </div>
  );
};
