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

interface ConteosPageClientProps {
	almacenes: AlmacenOpcion[];
	puntosVenta: PuntoVentaOpcion[];
	conteosIniciales: ConteoRow[];
}

/**
 * @description Gestiona conteos físicos ciegos: iniciar, capturar dos pasadas
 * por usuarios distintos, conciliar con generación de ajustes y cancelar.
 * La captura se simplifica como pares producto/cantidad manuales.
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

	// Formulario de captura mínima: pares producto/cantidad
	const [capturaConteoId, setCapturaConteoId] = useState('');
	const [capturas, setCapturas] = useState<Array<{ productoId: string; cantidad: string }>>([
		{ productoId: '', cantidad: '' },
	]);

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
		const lineas = capturas
			.filter((c) => c.productoId && c.cantidad !== '')
			.map((c) => ({ productoId: c.productoId, cantidad: Number(c.cantidad) }));
		if (lineas.length === 0) return;
		await accion(() => registrarConteoAction({ conteoId: capturaConteoId, lineas }));
	}

	async function handleConciliar(conteoId: string) {
		await accion(() => conciliarConteoAction({ conteoId, finales: [] }));
	}

	async function handleCancelar(conteoId: string) {
		await accion(() => cancelarConteoAction({ conteoId }));
	}

	function actualizarCaptura(index: number, campo: 'productoId' | 'cantidad', valor: string) {
		setCapturas((prev) =>
			prev.map((c, i) => (i === index ? { ...c, [campo]: valor } : c)),
		);
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
										onClick={() => {
											setCapturaConteoId(conteo.id);
											setCapturas([{ productoId: '', cantidad: '' }]);
										}}
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

			{capturaConteoId && (
				<form
					className="space-y-3 rounded-md border p-4"
					onSubmit={(e) => {
						e.preventDefault();
						handleCaptura();
					}}
				>
					<h2 className="font-medium">Captura ciega del conteo {capturaConteoId}</h2>
					{capturas.map((c, idx) => (
						<div key={idx} className="flex gap-2">
							<div className="flex-1">
								<label htmlFor={`cap-prod-${idx}`} className="mb-1 block text-sm font-medium">
									Producto
								</label>
								<Input
									id={`cap-prod-${idx}`}
									aria-label="Producto"
									value={c.productoId}
									onChange={(e) => actualizarCaptura(idx, 'productoId', e.target.value)}
									required
								/>
							</div>
							<div className="w-32">
								<label htmlFor={`cap-cant-${idx}`} className="mb-1 block text-sm font-medium">
									Cantidad
								</label>
								<Input
									id={`cap-cant-${idx}`}
									aria-label="Cantidad"
									type="number"
									min={0}
									value={c.cantidad}
									onChange={(e) => actualizarCaptura(idx, 'cantidad', e.target.value)}
									required
								/>
							</div>
						</div>
					))}
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => setCapturas([...capturas, { productoId: '', cantidad: '' }])}
						>
							Agregar producto
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							Guardar captura
						</Button>
						<Button type="button" variant="ghost" onClick={() => setCapturaConteoId('')}>
							Cerrar
						</Button>
					</div>
				</form>
			)}
		</div>
	);
}
