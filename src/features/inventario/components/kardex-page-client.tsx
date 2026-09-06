'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { getKardexAction } from '@/features/inventario';

interface ProductoOpcion {
	id: string;
	nombre: string;
}

interface AlmacenOpcion {
	almacenId: string;
	nombre: string;
}

interface PuntoVentaOpcion {
	pvId: string;
	nombre: string;
}

interface KardexMovimientoItem {
	id: string;
	tipoOrigen: string;
	origenId: string;
	tipoUbicacion?: string;
	ubicacionId?: string;
	cantidad: number;
	costoUnitario: number;
	createdAt: string;
	saldo: number;
}

interface KardexDatos {
	items: KardexMovimientoItem[];
	saldoInicial: number;
	total: number;
	page: number;
	limit: number;
}

interface KardexPageClientProps {
	productos: ProductoOpcion[];
	almacenes: AlmacenOpcion[];
	puntosVenta: PuntoVentaOpcion[];
}

const PAGE_SIZE = 50;

/**
 * @description Convierte las filas del kardex en CSV con saldo acumulado.
 * @param {KardexDatos} datos - Datos actuales del kardex.
 * @returns {string} Contenido CSV.
 */
function kardexToCsv(datos: KardexDatos): string {
	const encabezados = [
		'fecha',
		'tipo',
		'origen',
		'cantidad',
		'costoUnitario',
		'saldo',
	];
	const filas = datos.items.map((item) =>
		[
			item.createdAt,
			item.tipoOrigen,
			item.origenId,
			item.cantidad,
			item.costoUnitario,
			item.saldo,
		].join(','),
	);
	return [`# Saldo inicial: ${datos.saldoInicial}`, encabezados.join(','), ...filas].join('\n');
}

/**
 * @description Componente cliente del kardex: filtros, tabla con saldo
 * acumulado, paginación y exportación CSV.
 * @param {KardexPageClientProps} props - Catálogos de productos, almacenes y puntos de venta.
 * @returns {JSX.Element} Vista interactiva del kardex.
 */
export function KardexPageClient({
	productos,
	almacenes,
	puntosVenta,
}: KardexPageClientProps) {
	const [productoId, setProductoId] = useState('');
	const [tipoUbicacion, setTipoUbicacion] = useState<string>('');
	const [ubicacionId, setUbicacionId] = useState<string>('');
	const [fechaDesde, setFechaDesde] = useState('');
	const [fechaHasta, setFechaHasta] = useState('');
	const [page, setPage] = useState(1);
	const [datos, setDatos] = useState<KardexDatos | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const ubicacionesDisponibles = useMemo(() => {
		if (tipoUbicacion === 'almacen') return almacenes.map((a) => ({ id: a.almacenId, nombre: a.nombre }));
		if (tipoUbicacion === 'punto_venta') return puntosVenta.map((p) => ({ id: p.pvId, nombre: p.nombre }));
		return [];
	}, [tipoUbicacion, almacenes, puntosVenta]);

	const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.limit)) : 0;

	async function consultar(nuevaPagina = 1) {
		if (!productoId) return;
		setIsLoading(true);
		setError(null);
		setPage(nuevaPagina);
		try {
			const result = await getKardexAction({
				productoId,
				tipoUbicacion: (tipoUbicacion || undefined) as 'almacen' | 'punto_venta' | undefined,
				ubicacionId: ubicacionId || undefined,
				fechaDesde: fechaDesde ? new Date(fechaDesde) : undefined,
				fechaHasta: fechaHasta ? new Date(fechaHasta) : undefined,
				page: nuevaPagina,
				limit: PAGE_SIZE,
			});
			if (!result.success || !result.data) {
				setError(result.error?.message ?? 'No se pudo cargar el kardex');
				setDatos(null);
				return;
			}
			setDatos(result.data as unknown as KardexDatos);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado');
			setDatos(null);
		} finally {
			setIsLoading(false);
		}
	}

	function exportarCsv() {
		if (!datos) return;
		const blob = new Blob([kardexToCsv(datos)], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const enlace = document.createElement('a');
		enlace.href = url;
		enlace.download = `kardex-${productoId}-${Date.now()}.csv`;
		enlace.click();
		URL.revokeObjectURL(url);
	}

	return (
		<div className="space-y-4 p-6">
			<h1 className="text-2xl font-semibold">Kardex de inventario</h1>

			<div className="grid grid-cols-1 gap-3 md:grid-cols-5">
				<div className="md:col-span-2">
					<label htmlFor="producto" className="mb-1 block text-sm font-medium">
						Producto
					</label>
					<select
						id="producto"
						aria-label="Producto"
						className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						value={productoId}
						onChange={(e) => setProductoId(e.target.value)}
					>
						<option value="">Selecciona un producto</option>
						{productos.map((p) => (
							<option key={p.id} value={p.id}>
								{p.nombre}
							</option>
						))}
					</select>
				</div>

				<div>
					<label htmlFor="tipoUbicacion" className="mb-1 block text-sm font-medium">
						Tipo de ubicación
					</label>
					<select
						id="tipoUbicacion"
						aria-label="Tipo de ubicación"
						className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						value={tipoUbicacion}
						onChange={(e) => {
							setTipoUbicacion(e.target.value);
							setUbicacionId('');
						}}
					>
						<option value="">Todas</option>
						<option value="almacen">Almacén</option>
						<option value="punto_venta">Punto de venta</option>
					</select>
				</div>

				<div>
					<label htmlFor="ubicacionId" className="mb-1 block text-sm font-medium">
						Ubicación
					</label>
					<select
						id="ubicacionId"
						aria-label="Ubicación"
						className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						value={ubicacionId}
						disabled={!tipoUbicacion}
						onChange={(e) => setUbicacionId(e.target.value)}
					>
						<option value="">Todas</option>
						{ubicacionesDisponibles.map((u) => (
							<option key={u.id} value={u.id}>
								{u.nombre}
							</option>
						))}
					</select>
				</div>

				<div>
					<label htmlFor="fechaDesde" className="mb-1 block text-sm font-medium">
						Desde
					</label>
					<Input
						id="fechaDesde"
						type="date"
						value={fechaDesde}
						onChange={(e) => setFechaDesde(e.target.value)}
					/>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<Input
					id="fechaHasta"
					aria-label="Hasta"
					type="date"
					className="w-48"
					value={fechaHasta}
					onChange={(e) => setFechaHasta(e.target.value)}
				/>
				<Button onClick={() => consultar(1)} disabled={!productoId || isLoading}>
					{isLoading ? 'Consultando…' : 'Consultar'}
				</Button>
				<Button variant="outline" onClick={exportarCsv} disabled={!datos || datos.items.length === 0}>
					<Download className="mr-2 h-4 w-4" />
					Exportar CSV
				</Button>
			</div>

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			{!datos && !error && !isLoading && (
				<p className="text-sm text-muted-foreground">
					Selecciona un producto y consulta su historial de movimientos.
				</p>
			)}

			{datos && (
				<div className="space-y-3">
					<p className="text-sm text-muted-foreground">
						Saldo inicial: {datos.saldoInicial} · Total de movimientos: {datos.total}
					</p>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Fecha</TableHead>
								<TableHead>Tipo</TableHead>
								<TableHead>Origen</TableHead>
								<TableHead className="text-right">Cantidad</TableHead>
								<TableHead className="text-right">Costo unitario</TableHead>
								<TableHead className="text-right">Saldo</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{datos.items.map((item) => (
								<TableRow key={item.id}>
									<TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
									<TableCell>{item.tipoOrigen}</TableCell>
									<TableCell>{item.origenId}</TableCell>
									<TableCell className="text-right">{item.cantidad}</TableCell>
									<TableCell className="text-right">{item.costoUnitario}</TableCell>
									<TableCell className="text-right font-medium">{item.saldo}</TableCell>
								</TableRow>
							))}
							{datos.items.length === 0 && (
								<TableRow>
									<TableCell colSpan={6} className="text-center text-muted-foreground">
										Sin movimientos para los filtros seleccionados.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>

					{totalPaginas > 1 && (
						<div className="flex items-center justify-end gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={page <= 1 || isLoading}
								onClick={() => consultar(page - 1)}
							>
								Anterior
							</Button>
							<span className="text-sm">
								Página {page} de {totalPaginas}
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={page >= totalPaginas || isLoading}
								onClick={() => consultar(page + 1)}
							>
								Siguiente
							</Button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
