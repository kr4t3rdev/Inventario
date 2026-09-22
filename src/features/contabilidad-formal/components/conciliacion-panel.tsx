'use client';

import { useEffect, useState, type JSX } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { getConciliacionCruzadaAction } from '@/features/contabilidad-formal/actions-libros';
import type { ResultadoConciliacion } from '@/features/contabilidad-formal/services/conciliacion-cruzada-service';

/**
 * @description Panel de conciliación cruzada: compara el saldo de los libros
 * formales contra el saldo operativo de la base caja por rubro, marcando las
 * divergencias con el monto exacto.
 * @returns {JSX.Element} Panel de conciliación cruzada.
 */
export function ConciliacionPanel(): JSX.Element {
	const [data, setData] = useState<ResultadoConciliacion | null>(null);
	const [cargando, setCargando] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const cargar = () => {
		setCargando(true);
		setError(null);
		getConciliacionCruzadaAction()
			.then((r) => {
				if (r.success && r.data) {
					setData(r.data as ResultadoConciliacion);
				} else {
					setError((!r.success && r.error?.message) || 'No se pudo cargar la conciliación');
				}
			})
			.catch(() => setError('No se pudo cargar la conciliación'))
			.finally(() => setCargando(false));
	};

	useEffect(() => {
		cargar();
	}, []);

	if (cargando && !data) {
		return (
			<div className="flex items-center gap-2 py-10 text-muted-foreground" role="status">
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				Calculando conciliación…
			</div>
		);
	}
	if (error) return <p className="py-6 text-sm text-destructive" role="alert">{error}</p>;
	if (!data) return null;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<p className="text-sm text-muted-foreground">
					Compara los saldos de la capa formal contra los registros operativos de la
					base caja. Moneda funcional: {data.monedaFuncional}.
				</p>
				<Button variant="outline" size="sm" onClick={cargar} disabled={cargando}>
					<RefreshCw
						className={`mr-2 h-4 w-4 ${cargando ? 'animate-spin' : ''}`}
						aria-hidden="true"
					/>
					Actualizar
				</Button>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				{data.rubros.map((rubro) => (
					<Card key={rubro.clave} data-testid={`rubro-${rubro.clave}`}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">{rubro.nombre}</CardTitle>
							{rubro.estado === 'OK' ? (
								<Badge variant="secondary" className="gap-1">
									<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
									Cuadra
								</Badge>
							) : (
								<Badge variant="destructive" className="gap-1">
									<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
									Diverge
								</Badge>
							)}
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Según libros</span>
								<span className="tabular-nums font-medium">
									{formatCurrency(rubro.saldoLibros, data.monedaFuncional)}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Según operación</span>
								<span className="tabular-nums">
									{formatCurrency(rubro.saldoOperativo, data.monedaFuncional)}
								</span>
							</div>
							{rubro.diferencia !== 0 ? (
								<div className="flex justify-between border-t pt-2 font-medium">
									<span>Diferencia</span>
									<span className="tabular-nums text-destructive">
										{formatCurrency(rubro.diferencia, data.monedaFuncional)}
									</span>
								</div>
							) : null}
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
