'use client';

/**
 * @description Pantalla del reporte contable formal: elige un período con
 * evidencia en el mayor formal y presenta el balance por cuenta y el estado
 * de resultados. Sin evidencia suficiente, muestra la causa y no publica
 * importes parciales.
 */
import { useEffect, useState, type JSX } from 'react';
import { Loader2 } from 'lucide-react';

import {
	getFormalFinancialReportAction,
	listarPeriodosFormalesAction,
} from '@/features/contabilidad-formal/actions-reporte';
import { FormalReportView } from '@/features/contabilidad-formal/components/formal-report-view';
import type { FormalFinancialReportResolution } from '@/features/contabilidad-formal/services/formal-financial-report-contract';
import type { FormalPeriodSummary } from '@/features/contabilidad-formal/services/formal-periods-service';

/**
 * @description Describe un período con su código y rango de fechas.
 * @param {FormalPeriodSummary} periodo - Período con evidencia formal.
 * @returns {string} Etiqueta legible del período.
 */
function etiquetaPeriodo(periodo: FormalPeriodSummary): string {
	const rango = `${periodo.fechaInicio.slice(0, 10)} → ${periodo.fechaFin.slice(0, 10)}`;
	return periodo.codigo ? `${periodo.codigo} · ${rango}` : `${periodo.tipo} · ${rango}`;
}

/**
 * @description Presenta el reporte contable formal del período seleccionado.
 * @returns {JSX.Element} Selector de período y reporte formal.
 */
export default function ReporteFormalPage(): JSX.Element {
	const [periodos, setPeriodos] = useState<FormalPeriodSummary[]>([]);
	const [periodoId, setPeriodoId] = useState('');
	const [resolucion, setResolucion] = useState<FormalFinancialReportResolution | null>(null);
	const [cargando, setCargando] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let vigente = true;
		void (async () => {
			const respuesta = await listarPeriodosFormalesAction();
			if (!vigente) return;
			setCargando(false);
			if (!respuesta.success) {
				setError(respuesta.error?.message ?? 'No se pudieron consultar los períodos formales');
				return;
			}
			setPeriodos(respuesta.data);
			setPeriodoId(respuesta.data[0]?.periodoId ?? '');
		})();
		return () => { vigente = false; };
	}, []);

	useEffect(() => {
		if (!periodoId) return;
		let vigente = true;
		void (async () => {
			const respuesta = await getFormalFinancialReportAction({ periodoId });
			if (!vigente) return;
			if (!respuesta.success) {
				setResolucion(null);
				setError(respuesta.error?.message ?? 'No se pudo consultar el reporte formal');
				return;
			}
			setError(null);
			setResolucion(respuesta.data);
		})();
		return () => { vigente = false; };
	}, [periodoId]);
	return (
		<div className="space-y-6">
			<header className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Reporte contable formal</h1>
				<p className="text-sm text-muted-foreground">
					Balance general y estado de resultados desde el mayor formal, por cuenta y tipo contable.
				</p>
			</header>

			{periodos.length > 0 && (
				<div className="flex flex-col gap-1.5">
					<label htmlFor="periodo-formal" className="text-sm font-medium">
						Período contable
					</label>
					<select
						id="periodo-formal"
						value={periodoId}
						onChange={(evento) => setPeriodoId(evento.target.value)}
						className="h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
					>
						{periodos.map((periodo) => (
							<option key={periodo.periodoId} value={periodo.periodoId}>
								{etiquetaPeriodo(periodo)}
							</option>
						))}
					</select>
				</div>
			)}

			{cargando && (
				<p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					Cargando períodos con evidencia formal
				</p>
			)}

			{error && (
				<p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
					{error}
				</p>
			)}

			{!cargando && !error && periodos.length === 0 && (
				<p role="status" className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm">
					No hay períodos con asientos en el mayor formal. El reporte queda no disponible hasta que
					exista evidencia contable verificable.
				</p>
			)}

			{resolucion && <FormalReportView resolution={resolucion} />}
		</div>
	);
}
