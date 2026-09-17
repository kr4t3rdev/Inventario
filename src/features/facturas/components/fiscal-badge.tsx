'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ESTADOS: Record<string, { label: string; clase: string }> = {
	PENDIENTE: { label: 'Fiscal: pendiente', clase: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
	PROCESANDO: { label: 'Fiscal: procesando', clase: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
	TIMBRADA: { label: 'Fiscal: timbrada', clase: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
	RECHAZADA: { label: 'Fiscal: rechazada', clase: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
	CANCELADA: { label: 'Fiscal: cancelada', clase: 'border-gray-300 bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300' },
};

/**
 * @description Badge del estado fiscal de la factura (Gap 4). null = sin
 * documento fiscal para esta factura.
 * @param {object} props - Estado del documento fiscal asociado (o null).
 * @returns {JSX.Element | null} Badge o nada si no hay documento.
 */
export function FiscalBadge({ estado }: { estado?: string | null }): JSX.Element | null {
	if (!estado) return null;
	const cfg = ESTADOS[estado] ?? { label: `Fiscal: ${estado.toLowerCase()}`, clase: '' };
	return (
		<Badge variant="outline" className={cn('font-normal', cfg.clase)} title="Documento fiscal">
			{cfg.label}
		</Badge>
	);
}
