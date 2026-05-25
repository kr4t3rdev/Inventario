/**
 * @description Badge de estado de período contable con colores del spec.
 *
 * - BORRADOR: gris
 * - ABIERTO: verde
 * - EN_CIERRE: naranja
 * - CERRADO: rojo
 * - APROBADO: rojo oscuro + candado
 * - REABIERTO: azul + advertencia
 */
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, type LucideIcon } from 'lucide-react';

const ESTADO_COLORS: Record<string, string> = {
  ABIERTO:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800',
  EN_CIERRE: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800',
  CERRADO:   'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800',
  APROBADO:  'bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800',
  REABIERTO: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  BORRADOR:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

const ESTADO_LABELS: Record<string, string> = {
  ABIERTO: 'Abierto',
  EN_CIERRE: 'En Cierre',
  CERRADO: 'Cerrado',
  APROBADO: 'Aprobado',
  REABIERTO: 'Reabierto',
  BORRADOR: 'Borrador',
};

const ESTADO_ICONS: Record<string, LucideIcon | null> = {
  APROBADO: Shield,
  REABIERTO: AlertTriangle,
};

export interface PeriodoBadgeProps {
  estado: string;
  showLabel?: boolean;
  className?: string;
}

/**
 * @description Badge de estado con color e icono según el estado del período.
 *
 * @param {PeriodoBadgeProps} props - Props del badge.
 * @param {string} props.estado - Estado del período (ABIERTO, CERRADO, etc.).
 * @param {boolean} [props.showLabel=true] - Si muestra el label textual.
 * @param {string} [props.className] - Clases adicionales.
 * @returns {JSX.Element} Badge con estilo de estado.
 */
export function PeriodoBadge({ estado, showLabel = true, className = '' }: PeriodoBadgeProps) {
  const Icon = ESTADO_ICONS[estado] ?? null;
  return (
    <Badge className={`${ESTADO_COLORS[estado] ?? ''} ${className}`}>
      <span className="flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {showLabel && (ESTADO_LABELS[estado] ?? estado)}
      </span>
    </Badge>
  );
}
