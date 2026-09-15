'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * @description Etiquetas visibles del ciclo de vida del pedido de venta.
 */
const ESTADO_LABELS: Record<string, string> = {
	PEDIDO: 'Pedido',
	ENTREGADA: 'Entregada',
	FACTURADA: 'Facturada',
	ANULADA: 'Anulada',
};

const ESTADO_STYLES: Record<string, string> = {
	PEDIDO: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
	ENTREGADA: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
	FACTURADA: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
	ANULADA: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

/**
 * @description Badge del estado del ciclo de vida de una venta (PVE).
 * @param {object} props - Props del componente.
 * @param {string | null | undefined} props.estado - Estado actual de la venta.
 * @returns {JSX.Element} Badge con la etiqueta y color del estado.
 */
export function EstadoVentaBadge({ estado }: { estado?: string | null }): React.JSX.Element {
	const key = estado ?? 'ENTREGADA';
	return (
		<Badge
			variant="outline"
			className={cn('font-medium', ESTADO_STYLES[key] ?? ESTADO_STYLES.ENTREGADA)}
		>
			{ESTADO_LABELS[key] ?? key}
		</Badge>
	);
}
