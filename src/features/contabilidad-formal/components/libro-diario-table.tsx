'use client';

import { Fragment, useEffect, useState, type JSX } from 'react';
import { Loader2 } from 'lucide-react';

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { getLibroDiarioAction } from '@/features/contabilidad-formal/actions-libros';
import type { ResultadoLibroDiario } from '@/features/contabilidad-formal/services/libro-diario-service';

interface LibroDiarioTableProps {
	periodoId?: string;
}

/**
 * @description Tabla del libro diario: asientos del período con sus líneas,
 * paginados. @param {LibroDiarioTableProps} props - Filtro por período.
 * @returns {JSX.Element} Tabla del libro diario.
 */
export function LibroDiarioTable({ periodoId }: LibroDiarioTableProps): JSX.Element {
	const [data, setData] = useState<ResultadoLibroDiario | null>(null);
	const [page, setPage] = useState(1);
	const [cargando, setCargando] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let activo = true;
		setCargando(true);
		setError(null);
		getLibroDiarioAction({ periodoId, page, limit: 50 })
			.then((r) => {
				if (!activo) return;
				if (r.success && r.data) {
					setData(r.data as ResultadoLibroDiario);
				} else {
					setError((!r.success && r.error?.message) || 'No se pudo cargar el libro diario');
				}
			})
			.catch(() => activo && setError('No se pudo cargar el libro diario'))
			.finally(() => activo && setCargando(false));
		return () => {
			activo = false;
		};
	}, [periodoId, page]);

	if (cargando && !data) {
		return (
			<div className="flex items-center gap-2 py-10 text-muted-foreground" role="status">
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				Cargando libro diario…
			</div>
		);
	}
	if (error) return <p className="py-6 text-sm text-destructive" role="alert">{error}</p>;
	if (!data || data.asientos.length === 0) {
		return (
			<p className="py-6 text-sm text-muted-foreground">
				No hay asientos en el período seleccionado.
			</p>
		);
	}

	return (
		<div className="space-y-3">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-24">Asiento</TableHead>
						<TableHead>Fecha</TableHead>
						<TableHead>Descripción</TableHead>
						<TableHead>Cuenta</TableHead>
						<TableHead className="text-right">Debe</TableHead>
						<TableHead className="text-right">Haber</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{data.asientos.map((asiento) => (
						<Fragment key={asiento.asientoId}>
							<TableRow className="bg-muted/40 font-medium">
								<TableCell>{asiento.etiqueta}</TableCell>
								<TableCell>
									{new Date(asiento.fecha).toLocaleDateString('es-ES')}
								</TableCell>
								<TableCell className="max-w-[280px] truncate">
									{asiento.descripcion}
									<span className="ml-2 text-xs text-muted-foreground">
										({asiento.origenTipo})
									</span>
								</TableCell>
								<TableCell colSpan={3} className="text-xs text-muted-foreground">
									{asiento.lineas.length} línea(s)
								</TableCell>
							</TableRow>
							{asiento.lineas.map((linea, idx) => (
								<TableRow key={`${asiento.asientoId}-${idx}`} className="text-sm">
									<TableCell />
									<TableCell />
									<TableCell />
									<TableCell>
										{linea.cuentaCodigo} — {linea.cuentaNombre}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{linea.debe > 0 ? formatCurrency(linea.debe) : ''}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{linea.haber > 0 ? formatCurrency(linea.haber) : ''}
									</TableCell>
								</TableRow>
							))}
						</Fragment>
					))}
				</TableBody>
			</Table>

			{data.paginas > 1 ? (
				<div className="flex items-center justify-between text-sm text-muted-foreground">
					<span>
						Página {data.page} de {data.paginas} ({data.total} asientos)
					</span>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={page <= 1}
							onClick={() => setPage((p) => Math.max(1, p - 1))}
						>
							Anterior
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={page >= data.paginas}
							onClick={() => setPage((p) => p + 1)}
						>
							Siguiente
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}
