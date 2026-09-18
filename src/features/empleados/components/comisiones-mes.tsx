'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { getComisionesDelMesAction } from '@/features/empleados/actions-comisiones';

interface FilaComision {
	empleadoId: string;
	nombre: string;
	comisionPct: number;
	ventasElegibles: number;
	baseBruta: number;
	devolucionesElegibles: number;
	baseNeta: number;
	comisionCalculada: number;
	meta?: {
		metaMensual: number;
		progreso: number;
		cumplida: boolean;
	} | null;
}

const MESES = [
	{ v: '1', label: 'Enero' }, { v: '2', label: 'Febrero' }, { v: '3', label: 'Marzo' },
	{ v: '4', label: 'Abril' }, { v: '5', label: 'Mayo' }, { v: '6', label: 'Junio' },
	{ v: '7', label: 'Julio' }, { v: '8', label: 'Agosto' }, { v: '9', label: 'Septiembre' },
	{ v: '10', label: 'Octubre' }, { v: '11', label: 'Noviembre' }, { v: '12', label: 'Diciembre' },
];

/**
 * @description Reporte mensual de comisiones por empleado (Gap 5): ventas netas,
 * comisión % y progreso de la meta.
 * @returns {JSX.Element} Tabla del reporte del mes.
 */
export function ComisionesMesClient() {
	const ahora = new Date();
	const [anio, setAnio] = useState(String(ahora.getFullYear()));
	const [mes, setMes] = useState(String(ahora.getMonth() + 1));
	const [filas, setFilas] = useState<FilaComision[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setIsLoading(true);
		setError(null);
		getComisionesDelMesAction({ anio: Number(anio), mes: Number(mes) })
			.then((r) => {
				if (r.success) {
					setFilas((r.data as FilaComision[] | undefined) ?? []);
				} else {
					setError(r.error?.message ?? 'Error al cargar el reporte');
				}
			})
			.catch(() => setError('Error de red al cargar el reporte'))
			.finally(() => setIsLoading(false));
	}, [anio, mes]);

	const anios = useMemo(() => {
		const lista: string[] = [];
		const a = new Date().getFullYear();
		for (let y = a - 2; y <= a; y++) lista.push(String(y));
		return lista;
	}, []);

	return (
		<div className="container mx-auto py-6 space-y-4">
			<div>
				<h1 className="text-2xl font-bold">Comisiones por mes</h1>
				<p className="text-sm text-muted-foreground">
					Ventas efectivamente cobradas (ENTREGADA/FACTURADA) − devoluciones, por empleado.
				</p>
			</div>

			<div className="flex gap-2">
				<Select value={mes} onValueChange={setMes}>
					<SelectTrigger className="w-40"><SelectValue placeholder="Mes" /></SelectTrigger>
					<SelectContent>
						{MESES.map((m) => <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>)}
					</SelectContent>
				</Select>
				<Select value={anio} onValueChange={setAnio}>
					<SelectTrigger className="w-28"><SelectValue placeholder="Año" /></SelectTrigger>
					<SelectContent>
						{anios.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
					</SelectContent>
				</Select>
			</div>

			{isLoading ? (
				<div className="space-y-2">
					{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
				</div>
			) : error ? (
				<p className="text-sm text-destructive">{error}</p>
			) : filas.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No hay ventas elegibles este mes o ningún empleado tiene comisión configurada.
				</p>
			) : (
				<div className="space-y-2">
					{filas.map((f) => (
						<Card key={f.empleadoId}>
							<CardContent className="py-3 flex items-center justify-between">
								<div>
									<p className="font-medium">{f.nombre}</p>
									<p className="text-xs text-muted-foreground">
										{formatCurrency(f.baseBruta)} cobrado
										{f.devolucionesElegibles > 0 &&
											` · −${formatCurrency(f.devolucionesElegibles)} por devoluciones`}
										{' · '}neta {formatCurrency(f.baseNeta)}
									</p>
								</div>
								<div className="flex items-center gap-3 text-right">
									{f.meta && (
										<div className="text-xs text-muted-foreground">
											Meta {formatCurrency(f.meta.metaMensual)} — {f.meta.progreso}%
											{f.meta.cumplida && (
												<Badge className="ml-2 bg-emerald-100 text-emerald-800 border-emerald-200">
													Cumplida
												</Badge>
											)}
										</div>
									)}
									<div>
										<p className="text-sm font-semibold">
											{formatCurrency(f.comisionCalculada)}
										</p>
										<p className="text-xs text-muted-foreground">
											{f.comisionPct}%
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
