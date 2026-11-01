'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

import {
	cancelarConteoAction,
	conciliarConteoAction,
	getConteoLineasAction,
	iniciarConteoAction,
	registrarConteoAction,
} from '@/features/inventario/actions-conteos';

interface AlmacenOpcion {
	almacenId: string;
	nombre: string;
}

interface PuntoVentaOpcion {
	pvId: string;
	nombre: string;
}

interface ConteoRow {
	id: string;
	tenantId: string;
	tipoUbicacion: string;
	ubicacionId: string;
	estado: string;
	createdAt: string;
}

interface ProductoConteo {
	productoId: string;
	nombre: string;
	codigoInterno: string | null;
	codigoNegocio: string | null;
	cantidad?: string;
	conteo1?: number | null;
	conteo2?: number | null;
}

interface ConteosPageClientProps {
	almacenes: AlmacenOpcion[];
	puntosVenta: PuntoVentaOpcion[];
	conteosIniciales: ConteoRow[];
}

/**
 * @description Gestiona conteos físicos ciegos: iniciar, capturar dos pasadas
 * por usuarios distintos, conciliar con generación de ajustes y cancelar.
 * La captura muestra el catálogo completo y exige una cantidad por producto.
 * @param {ConteosPageClientProps} props - Catálogos de ubicaciones y conteos.
 * @returns {JSX.Element} Vista de conteos físicos.
 */
export function ConteosPageClient({
	almacenes,
	puntosVenta,
	conteosIniciales,
}: ConteosPageClientProps) {
	const router = useRouter();
	const [tipoUbicacion, setTipoUbicacion] = useState<'almacen' | 'punto_venta'>('almacen');
	const [ubicacionId, setUbicacionId] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [captura, setCaptura] = useState<{ conteoId: string; lineas: ProductoConteo[] } | null>(null);
	const [conciliacion, setConciliacion] = useState<{
		conteoId: string;
		lineas: ProductoConteo[];
	} | null>(null);

	const ubicaciones = tipoUbicacion === 'almacen'
		? almacenes.map((a) => ({ id: a.almacenId, nombre: a.nombre }))
		: puntosVenta.map((p) => ({ id: p.pvId, nombre: p.nombre }));

	async function accion(fn: () => Promise<{ success: boolean; error?: { message?: string } | null }>) {
		setIsSubmitting(true);
		setError(null);
		try {
			const result = await fn();
			if (!result.success) setError(result.error?.message ?? 'La acción falló');
			router.refresh();
			return result;
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleIniciar() {
		await accion(() =>
			iniciarConteoAction({ tipoUbicacion, ubicacionId }),
		);
	}

	async function handleCaptura() {
		if (!captura) return;
		if (captura.lineas.some((linea) => linea.cantidad === undefined || linea.cantidad === '')) {
			setError('Debes registrar una cantidad para cada producto.');
			return;
		}
		const lineas = captura.lineas.map((linea) => ({
			productoId: linea.productoId,
			cantidad: Number(linea.cantidad),
		}));
		const result = await accion(() => registrarConteoAction({ conteoId: captura.conteoId, lineas }));
		if (result.success) setCaptura(null);
	}

	async function handleConciliar(conteoId: string) {
		setIsSubmitting(true);
		setError(null);
		try {
			const result = await getConteoLineasAction({ conteoId });
			if (!result.success) {
				setError(result.error?.message ?? 'No se pudo cargar la conciliación');
				return;
			}
			setConciliacion({ conteoId, lineas: result.data.lineas });
			setCaptura(null);
		} finally {
			setIsSubmitting(false);
		}
	}

	async function abrirCaptura(conteoId: string) {
		setIsSubmitting(true);
		setError(null);
		try {
			const result = await getConteoLineasAction({ conteoId });
			if (!result.success) {
				setError(result.error?.message ?? 'No se pudieron cargar los productos');
				return;
			}
			setCaptura({
				conteoId,
				lineas: result.data.lineas.map((linea) => ({ ...linea, cantidad: '' })),
			});
			setConciliacion(null);
		} finally {
			setIsSubmitting(false);
		}
	}

	async function confirmarConciliacion() {
		if (!conciliacion) return;
		const diferencias = conciliacion.lineas.filter((linea) => linea.conteo1 !== linea.conteo2);
		if (diferencias.some((linea) => linea.cantidad === undefined || linea.cantidad === '')) {
			setError('Debes confirmar la cantidad final de cada diferencia.');
			return;
		}
		const finales = conciliacion.lineas
			.filter((linea) => linea.conteo1 !== linea.conteo2)
			.map((linea) => ({
				productoId: linea.productoId,
				contadoFinal: Number(linea.cantidad),
			}));
		const result = await accion(() =>
			conciliarConteoAction({ conteoId: conciliacion.conteoId, finales }),
		);
		if (result.success) setConciliacion(null);
	}

	async function handleCancelar(conteoId: string) {
		await accion(() => cancelarConteoAction({ conteoId }));
	}

	function actualizarCantidad(index: number, valor: string) {
		setCaptura((prev) => prev && ({
			...prev,
			lineas: prev.lineas.map((linea, i) =>
				i === index ? { ...linea, cantidad: valor } : linea,
			),
		}));
	}

	function actualizarFinal(index: number, valor: string) {
		setConciliacion((prev) => prev && ({
			...prev,
			lineas: prev.lineas.map((linea, i) =>
				i === index ? { ...linea, cantidad: valor } : linea,
			),
		}));
	}

	function mostrarCodigo(producto: ProductoConteo) {
		return producto.codigoInterno || producto.codigoNegocio || producto.productoId;
	}

	return (
		<div className="space-y-4 p-6">
			<h1 className="text-2xl font-semibold">Conteos físicos</h1>

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			<form
				className="flex flex-wrap items-end gap-3 rounded-md border p-4"
				onSubmit={(e) => {
					e.preventDefault();
					handleIniciar();
				}}
			>
				<div>
					<label htmlFor="c-tipo" className="mb-1 block text-sm font-medium">
						Tipo de ubicación
					</label>
					<select
						id="c-tipo"
						aria-label="Tipo de ubicación"
						className="h-9 rounded-md border border-input bg-background px-3 text-sm"
						value={tipoUbicacion}
						onChange={(e) => {
							setTipoUbicacion(e.target.value as 'almacen' | 'punto_venta');
							setUbicacionId('');
						}}
					>
						<option value="almacen">Almacén</option>
						<option value="punto_venta">Punto de venta</option>
					</select>
				</div>
				<div>
					<label htmlFor="c-ubicacion" className="mb-1 block text-sm font-medium">
						Ubicación
					</label>
					<select
						id="c-ubicacion"
						aria-label="Ubicación"
						className="h-9 rounded-md border border-input bg-background px-3 text-sm"
						value={ubicacionId}
						onChange={(e) => setUbicacionId(e.target.value)}
						required
					>
						<option value="">Selecciona una ubicación</option>
						{ubicaciones.map((u) => (
							<option key={u.id} value={u.id}>
								{u.nombre}
							</option>
						))}
					</select>
				</div>
				<Button type="submit" disabled={!ubicacionId || isSubmitting}>
					Iniciar conteo
				</Button>
			</form>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Ubicación</TableHead>
						<TableHead>Estado</TableHead>
						<TableHead>Creado</TableHead>
						<TableHead className="text-right">Acciones</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{conteosIniciales.map((conteo) => (
						<TableRow key={conteo.id}>
							<TableCell>{conteo.ubicacionId}</TableCell>
							<TableCell>{conteo.estado}</TableCell>
							<TableCell>{new Date(conteo.createdAt).toLocaleDateString()}</TableCell>
							<TableCell className="space-x-2 text-right">
								{['BORRADOR', 'CONTEO_1'].includes(conteo.estado) && (
									<Button
									variant="outline"
									size="sm"
									onClick={() => abrirCaptura(conteo.id)}
									disabled={isSubmitting}
									>
										Capturar
									</Button>
								)}
								{conteo.estado === 'CONTEO_2' && (
									<Button
										size="sm"
										onClick={() => handleConciliar(conteo.id)}
										disabled={isSubmitting}
									>
										Conciliar
									</Button>
								)}
								{['BORRADOR', 'CONTEO_1', 'CONTEO_2'].includes(conteo.estado) && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleCancelar(conteo.id)}
										disabled={isSubmitting}
									>
										Cancelar
									</Button>
								)}
							</TableCell>
						</TableRow>
					))}
					{conteosIniciales.length === 0 && (
						<TableRow>
							<TableCell colSpan={4} className="text-center text-muted-foreground">
								No hay conteos registrados.
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>

			{captura && (
				<form
					className="space-y-3 rounded-md border p-4"
					onSubmit={(e) => {
						e.preventDefault();
						handleCaptura();
					}}
				>
					<h2 className="font-medium">Captura ciega del conteo {captura.conteoId}</h2>
					<p className="text-sm text-muted-foreground">
						Registra la cantidad física de cada producto. Los productos con existencia teórica
						cero también están incluidos.
					</p>
					{captura.lineas.length === 0 && (
						<p className="text-sm">No hay productos en el catálogo para contar.</p>
					)}
					{captura.lineas.map((linea, idx) => (
						<div key={linea.productoId} className="flex items-end gap-3">
							<div className="min-w-0 flex-1">
								<p className="font-medium">{linea.nombre}</p>
								<p className="text-xs text-muted-foreground">{mostrarCodigo(linea)}</p>
							</div>
							<div className="w-32">
								<label htmlFor={`cap-cant-${idx}`} className="mb-1 block text-sm font-medium">
									Cantidad
								</label>
								<Input
									id={`cap-cant-${idx}`}
									aria-label={`Cantidad de ${linea.nombre}`}
									type="number"
									min={0}
									step={1}
									value={linea.cantidad ?? ''}
									onChange={(e) => actualizarCantidad(idx, e.target.value)}
									required
								/>
							</div>
						</div>
					))}
					<div className="flex gap-2">
						<Button type="submit" disabled={isSubmitting}>
							Guardar captura
						</Button>
						<Button type="button" variant="ghost" onClick={() => setCaptura(null)}>
							Cerrar
						</Button>
					</div>
				</form>
			)}

			{conciliacion && (
				<form
					className="space-y-3 rounded-md border p-4"
					onSubmit={(e) => {
						e.preventDefault();
						confirmarConciliacion();
					}}
				>
					<h2 className="font-medium">Conciliar conteo {conciliacion.conteoId}</h2>
					<p className="text-sm text-muted-foreground">
						Confirma la cantidad final para los productos cuyas dos capturas difieren.
					</p>
					{conciliacion.lineas.map((linea, idx) => (
						<div key={linea.productoId} className="flex items-end gap-3">
							<div className="min-w-0 flex-1">
								<p className="font-medium">{linea.nombre}</p>
								<p className="text-xs text-muted-foreground">
									{mostrarCodigo(linea)} · Pasada 1: {linea.conteo1 ?? '—'} · Pasada 2: {linea.conteo2 ?? '—'}
								</p>
							</div>
							{linea.conteo1 !== linea.conteo2 ? (
								<div className="w-36">
									<label htmlFor={`final-${idx}`} className="mb-1 block text-sm font-medium">
										Cantidad final
									</label>
									<Input
										id={`final-${idx}`}
										aria-label={`Cantidad final de ${linea.nombre}`}
										type="number"
										min={0}
										step={1}
										value={linea.cantidad ?? ''}
										onChange={(e) => actualizarFinal(idx, e.target.value)}
										required
									/>
								</div>
							) : (
								<p className="w-36 text-sm">Coinciden: {linea.conteo1}</p>
							)}
						</div>
					))}
					<div className="flex gap-2">
						<Button type="submit" disabled={isSubmitting}>Confirmar conciliación</Button>
						<Button type="button" variant="ghost" onClick={() => setConciliacion(null)}>
							Cerrar
						</Button>
					</div>
				</form>
			)}
		</div>
	);
}
