'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { Loader2 } from 'lucide-react';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import {
	getCuentasMayorablesAction,
	getLibroMayorAction,
} from '@/features/contabilidad-formal/actions-libros';
import type { ResultadoLibroMayor } from '@/features/contabilidad-formal/services/libro-mayor-service';

interface CuentaOpcion {
	cuentaId: string;
	codigo: string;
	nombre: string;
	tipo: string;
}

interface LibroMayorPanelProps {
	fechaDesde: string;
	fechaHasta: string;
}

/**
 * @description Panel del libro mayor: selector de cuenta y movimientos con
 * saldo corrido según la naturaleza contable de la cuenta.
 * @param {LibroMayorPanelProps} props - Rango de fechas del período elegido.
 * @returns {JSX.Element} Panel del mayor.
 */
export function LibroMayorPanel({ fechaDesde, fechaHasta }: LibroMayorPanelProps): JSX.Element {
	const [cuentas, setCuentas] = useState<CuentaOpcion[]>([]);
	const [cuentaId, setCuentaId] = useState('');
	const [data, setData] = useState<ResultadoLibroMayor | null>(null);
	const [cargando, setCargando] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		getCuentasMayorablesAction()
			.then((r) => {
				if (r.success && Array.isArray(r.data)) {
					const opciones = r.data as CuentaOpcion[];
					setCuentas(opciones);
					if (opciones.length > 0) setCuentaId(opciones[0].cuentaId);
				}
			})
			.catch(() => setError('No se pudieron cargar las cuentas'));
	}, []);

	useEffect(() => {
		if (!cuentaId) return;
		setCargando(true);
		setError(null);
		getLibroMayorAction({ cuentaId, fechaDesde, fechaHasta })
			.then((r) => {
				if (r.success && r.data) {
					setData(r.data as ResultadoLibroMayor);
				} else {
					setError((!r.success && r.error?.message) || 'No se pudo cargar el mayor');
				}
			})
			.catch(() => setError('No se pudo cargar el mayor'))
			.finally(() => setCargando(false));
	}, [cuentaId, fechaDesde, fechaHasta]);

	const cuentaActual = useMemo(
		() => cuentas.find((c) => c.cuentaId === cuentaId),
		[cuentas, cuentaId],
	);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-3">
				<Select value={cuentaId} onValueChange={setCuentaId}>
					<SelectTrigger className="min-w-[280px]" aria-label="Cuenta del mayor">
						<SelectValue placeholder="Selecciona una cuenta" />
					</SelectTrigger>
					<SelectContent>
						{cuentas.map((c) => (
							<SelectItem key={c.cuentaId} value={c.cuentaId}>
								{c.codigo} — {c.nombre}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{data ? (
					<span className="text-sm text-muted-foreground">
						Saldo inicial: {formatCurrency(data.saldoInicial, data.moneda)} · Saldo
						final: {formatCurrency(data.saldoFinal, data.moneda)}
					</span>
				) : null}
			</div>

			{error ? (
				<p className="text-sm text-destructive" role="alert">{error}</p>
			) : cargando ? (
				<div className="flex items-center gap-2 py-6 text-muted-foreground" role="status">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					Cargando movimientos…
				</div>
			) : !data ? null : data.movimientos.length === 0 ? (
				<p className="py-6 text-sm text-muted-foreground">
					{cuentaActual ? `${cuentaActual.nombre} no tiene movimientos en el período.` : 'Sin movimientos.'}
				</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-24">Asiento</TableHead>
							<TableHead>Fecha</TableHead>
							<TableHead>Descripción</TableHead>
							<TableHead className="text-right">Debe</TableHead>
							<TableHead className="text-right">Haber</TableHead>
							<TableHead className="text-right">Saldo</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.movimientos.map((m) => (
							<TableRow key={m.asientoId}>
								<TableCell>{m.etiqueta}</TableCell>
								<TableCell>{new Date(m.fecha).toLocaleDateString('es-ES')}</TableCell>
								<TableCell className="max-w-[240px] truncate">{m.descripcion}</TableCell>
								<TableCell className="text-right tabular-nums">
									{m.debe > 0 ? formatCurrency(m.debe, data.moneda) : ''}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{m.haber > 0 ? formatCurrency(m.haber, data.moneda) : ''}
								</TableCell>
								<TableCell className="text-right tabular-nums font-medium">
									{formatCurrency(m.saldoCorrido, data.moneda)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}
