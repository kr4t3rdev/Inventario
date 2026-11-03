'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { BookOpen } from 'lucide-react';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import { listarPeriodosAction } from '@/features/contabilidad/actions-periodos';
import { LibroDiarioTable } from '@/features/contabilidad-formal/components/libro-diario-table';
import { LibroMayorPanel } from '@/features/contabilidad-formal/components/libro-mayor-panel';
import { ComprobacionTable } from '@/features/contabilidad-formal/components/comprobacion-table';
import { ConciliacionPanel } from '@/features/contabilidad-formal/components/conciliacion-panel';

interface PeriodoOpcion {
	periodoId: string;
	codigo?: string | null;
	label?: string;
	estado: string;
	fechaInicio: string | Date;
	fechaFin: string | Date;
}

function inicioDeMesActual(): { desde: string; hasta: string } {
	const ahora = new Date();
	const desde = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
	const hasta = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 0, 23, 59, 59));
	return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

/**
 * @description Página cliente de los libros formales (CTA-2): selector de
 * período y cuatro pestañas (Diario, Mayor, Comprobación, Conciliación).
 * Solo se renderiza con el flag `contabilidad-formal` del plan.
 * @returns {JSX.Element | null} Página de libros o null si no aplica.
 */
export function LibrosPageClient(): JSX.Element | null {
	const { user } = useAuth();
	const habilitado =
		user?.role === 'admin' || user?.planFeatures?.['contabilidad-formal'] === true;

	const [periodos, setPeriodos] = useState<PeriodoOpcion[]>([]);
	const [periodoId, setPeriodoId] = useState('');

	useEffect(() => {
		if (!habilitado) return;
		listarPeriodosAction({ limit: 60 })
			.then((r) => {
				if (!r.success || !Array.isArray(r.data?.periodos)) return;
				const lista = (r.data.periodos as PeriodoOpcion[]).slice().sort(
					(a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime(),
				);
				setPeriodos(lista);
				if (lista.length > 0) setPeriodoId(lista[0].periodoId);
			})
			.catch(() => setPeriodos([]));
	}, [habilitado]);

	const fechaEfectiva = useMemo(() => {
		const seleccionado = periodos.find((p) => p.periodoId === periodoId);
		if (seleccionado) {
			return {
				desde: new Date(seleccionado.fechaInicio).toISOString(),
				hasta: new Date(seleccionado.fechaFin).toISOString(),
			};
		}
		return inicioDeMesActual();
	}, [periodos, periodoId]);

	if (!habilitado) return null;

	return (
		<div className="container mx-auto space-y-6 px-4 py-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<BookOpen className="h-6 w-6 text-blue-600" aria-hidden="true" />
					<div>
						<h1 className="text-2xl font-bold tracking-tight">Libros contables</h1>
						<p className="text-sm text-muted-foreground">
							Libro diario, mayor, comprobación y conciliación entre caja y asientos.
						</p>
					</div>
				</div>
				<Select value={periodoId} onValueChange={setPeriodoId}>
					<SelectTrigger className="min-w-[240px]" aria-label="Período contable">
						<SelectValue placeholder="Período contable" />
					</SelectTrigger>
					<SelectContent>
						{periodos.map((p) => (
							<SelectItem key={p.periodoId} value={p.periodoId}>
								{p.codigo ?? p.label ?? p.periodoId} · {p.estado}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<Tabs defaultValue="diario">
				<TabsList>
					<TabsTrigger value="diario">Libro diario</TabsTrigger>
					<TabsTrigger value="mayor">Libro mayor</TabsTrigger>
					<TabsTrigger value="comprobacion">Balance de comprobación</TabsTrigger>
					<TabsTrigger value="conciliacion">Conciliación caja ↔ asientos</TabsTrigger>
				</TabsList>

				<TabsContent value="diario" className="mt-4">
					<LibroDiarioTable periodoId={periodoId || undefined} />
				</TabsContent>
				<TabsContent value="mayor" className="mt-4">
					<LibroMayorPanel fechaDesde={fechaEfectiva.desde} fechaHasta={fechaEfectiva.hasta} />
				</TabsContent>
				<TabsContent value="comprobacion" className="mt-4">
					<ComprobacionTable periodoId={periodoId || undefined} />
				</TabsContent>
				<TabsContent value="conciliacion" className="mt-4">
					<ConciliacionPanel />
				</TabsContent>
			</Tabs>
		</div>
	);
}
