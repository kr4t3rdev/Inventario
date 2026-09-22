'use client';

import { useEffect, useState, type JSX } from 'react';
import { Loader2 } from 'lucide-react';

import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { getBalanceComprobacionAction } from '@/features/contabilidad-formal/actions-libros';
import type { ResultadoComprobacion } from '@/features/contabilidad-formal/services/balance-comprobacion-service';

interface ComprobacionTableProps {
	periodoId?: string;
}

/**
 * @description Balance de comprobación del período: sumas y saldos por cuenta.
 * @param {ComprobacionTableProps} props - Período seleccionado.
 * @returns {JSX.Element} Tabla de comprobación con totales cuadrados.
 */
export function ComprobacionTable({ periodoId }: ComprobacionTableProps): JSX.Element {
	const [data, setData] = useState<ResultadoComprobacion | null>(null);
	const [cargando, setCargando] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setCargando(true);
		setError(null);
		getBalanceComprobacionAction({ periodoId })
			.then((r) => {
				if (r.success && r.data) {
					setData(r.data as ResultadoComprobacion);
				} else {
					setError((!r.success && r.error?.message) || 'No se pudo cargar el balance');
				}
			})
			.catch(() => setError('No se pudo cargar el balance'))
			.finally(() => setCargando(false));
	}, [periodoId]);

	if (cargando) {
		return (
			<div className="flex items-center gap-2 py-10 text-muted-foreground" role="status">
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				Cargando balance de comprobación…
			</div>
		);
	}
	if (error) return <p className="py-6 text-sm text-destructive" role="alert">{error}</p>;
	if (!data || data.filas.length === 0) {
		return (
			<p className="py-6 text-sm text-muted-foreground">
				No hay cuentas con movimiento en el período.
			</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Código</TableHead>
					<TableHead>Cuenta</TableHead>
					<TableHead className="text-right">Sumas Debe</TableHead>
					<TableHead className="text-right">Sumas Haber</TableHead>
					<TableHead className="text-right">Saldo Deudor</TableHead>
					<TableHead className="text-right">Saldo Acreedor</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{data.filas.map((f) => (
					<TableRow key={f.cuentaId}>
						<TableCell className="font-mono text-xs">{f.codigo}</TableCell>
						<TableCell>{f.nombre}</TableCell>
						<TableCell className="text-right tabular-nums">{formatCurrency(f.sumaDebe)}</TableCell>
						<TableCell className="text-right tabular-nums">{formatCurrency(f.sumaHaber)}</TableCell>
						<TableCell className="text-right tabular-nums">
							{f.saldoDeudor > 0 ? formatCurrency(f.saldoDeudor) : ''}
						</TableCell>
						<TableCell className="text-right tabular-nums">
							{f.saldoAcreedor > 0 ? formatCurrency(f.saldoAcreedor) : ''}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
			<TableFooter>
				<TableRow className="font-semibold">
					<TableCell colSpan={2}>Totales</TableCell>
					<TableCell className="text-right tabular-nums">{formatCurrency(data.totales.debe)}</TableCell>
					<TableCell className="text-right tabular-nums">{formatCurrency(data.totales.haber)}</TableCell>
					<TableCell className="text-right tabular-nums">{formatCurrency(data.totales.saldoDeudor)}</TableCell>
					<TableCell className="text-right tabular-nums">{formatCurrency(data.totales.saldoAcreedor)}</TableCell>
				</TableRow>
			</TableFooter>
		</Table>
	);
}
