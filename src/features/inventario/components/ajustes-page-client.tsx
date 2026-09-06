'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import {
	anularAjusteAction,
	createAjusteAction,
} from '@/features/inventario/actions-ajustes';
import { MOTIVOS_AJUSTE } from '@/features/inventario/schemas';

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

interface AjusteRow {
	id: string;
	productoId: string;
	motivo: string;
	tipoUbicacion: string;
	ubicacionId: string;
	cantidadTeorica: number;
	cantidadContada: number;
	diferencia: number;
	costoTotal: number;
	estado: string;
	createdAt: string;
}

interface AjustesPageClientProps {
	productos: ProductoOpcion[];
	almacenes: AlmacenOpcion[];
	puntosVenta: PuntoVentaOpcion[];
	ajustesIniciales: AjusteRow[];
}

/**
 * @description Pantalla de ajustes de inventario: crea ajustes con motivo de
 * catálogo y permite anular ajustes aplicados generando compensación.
 * @param {AjustesPageClientProps} props - Catálogos y ajustes iniciales.
 * @returns {JSX.Element} Vista interactiva de ajustes.
 */
export function AjustesPageClient({
	productos,
	almacenes,
	puntosVenta,
	ajustesIniciales,
}: AjustesPageClientProps) {
	const router = useRouter();
	const [mostrarFormulario, setMostrarFormulario] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [ajustePorAnular, setAjustePorAnular] = useState<AjusteRow | null>(null);

	const [productoId, setProductoId] = useState('');
	const [motivo, setMotivo] = useState<string>('');
	const [cantidadContada, setCantidadContada] = useState('');
	const [tipoUbicacion, setTipoUbicacion] = useState<'almacen' | 'punto_venta'>('almacen');
	const [ubicacionId, setUbicacionId] = useState('');

	const ubicaciones = useMemo(() => {
		return tipoUbicacion === 'almacen'
			? almacenes.map((a) => ({ id: a.almacenId, nombre: a.nombre }))
			: puntosVenta.map((p) => ({ id: p.pvId, nombre: p.nombre }));
	}, [tipoUbicacion, almacenes, puntosVenta]);

	async function handleCrear(e: React.FormEvent) {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);
		try {
			const result = await createAjusteAction({
				productoId,
				tipoUbicacion,
				ubicacionId,
				motivo: motivo as typeof MOTIVOS_AJUSTE[number],
				cantidadContada: Number(cantidadContada),
			});
			if (!result.success) {
				setError(result.error?.message ?? 'No se pudo crear el ajuste');
				return;
			}
			setMostrarFormulario(false);
			setProductoId('');
			setMotivo('');
			setCantidadContada('');
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado');
		} finally {
			setIsSubmitting(false);
		}
	}

	async function confirmarAnulacion() {
		if (!ajustePorAnular) return;
		setIsSubmitting(true);
		try {
			const result = await anularAjusteAction(ajustePorAnular.id);
			if (!result.success) {
				setError(result.error?.message ?? 'No se pudo anular el ajuste');
			}
			setAjustePorAnular(null);
			router.refresh();
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className="space-y-4 p-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Ajustes de inventario</h1>
				<Button onClick={() => setMostrarFormulario((v) => !v)}>
					{mostrarFormulario ? 'Cerrar' : 'Nuevo ajuste'}
				</Button>
			</div>

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			{mostrarFormulario && (
				<form onSubmit={handleCrear} className="space-y-3 rounded-md border p-4">
					<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
						<div>
							<label htmlFor="aj-producto" className="mb-1 block text-sm font-medium">
								Selecciona el producto
							</label>
							<select
								id="aj-producto"
								aria-label="Producto"
								className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
								value={productoId}
								onChange={(e) => setProductoId(e.target.value)}
								required
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
							<label htmlFor="aj-motivo" className="mb-1 block text-sm font-medium">
								Motivo
							</label>
							<select
								id="aj-motivo"
								aria-label="Motivo"
								className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
								value={motivo}
								onChange={(e) => setMotivo(e.target.value)}
								required
							>
								<option value="">Selecciona un motivo</option>
								{MOTIVOS_AJUSTE.map((m) => (
									<option key={m} value={m}>
										{m}
									</option>
								))}
							</select>
						</div>

						<div>
							<label htmlFor="aj-tipoUbicacion" className="mb-1 block text-sm font-medium">
								Tipo de ubicación
							</label>
							<select
								id="aj-tipoUbicacion"
								aria-label="Tipo de ubicación"
								className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
							<label htmlFor="aj-ubicacion" className="mb-1 block text-sm font-medium">
								Ubicación
							</label>
							<select
								id="aj-ubicacion"
								aria-label="Ubicación"
								className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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

						<div>
							<label htmlFor="aj-contada" className="mb-1 block text-sm font-medium">
								Cantidad contada
							</label>
							<Input
								id="aj-contada"
								type="number"
								min={0}
								value={cantidadContada}
								onChange={(e) => setCantidadContada(e.target.value)}
								required
							/>
						</div>
					</div>

					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? 'Aplicando…' : 'Aplicar ajuste'}
					</Button>
				</form>
			)}

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Producto</TableHead>
						<TableHead>Motivo</TableHead>
						<TableHead className="text-right">Teórico</TableHead>
						<TableHead className="text-right">Contado</TableHead>
						<TableHead className="text-right">Diferencia</TableHead>
						<TableHead className="text-right">Costo</TableHead>
						<TableHead>Estado</TableHead>
						<TableHead />
					</TableRow>
				</TableHeader>
				<TableBody>
					{ajustesIniciales.map((ajuste) => (
						<TableRow key={ajuste.id}>
							<TableCell>{ajuste.productoId}</TableCell>
							<TableCell>{ajuste.motivo}</TableCell>
							<TableCell className="text-right">{ajuste.cantidadTeorica}</TableCell>
							<TableCell className="text-right">{ajuste.cantidadContada}</TableCell>
							<TableCell className="text-right">{ajuste.diferencia}</TableCell>
							<TableCell className="text-right">{ajuste.costoTotal}</TableCell>
							<TableCell>{ajuste.estado}</TableCell>
							<TableCell>
								{ajuste.estado === 'APLICADO' && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setAjustePorAnular(ajuste)}
									>
										Anular
									</Button>
								)}
							</TableCell>
						</TableRow>
					))}
					{ajustesIniciales.length === 0 && (
						<TableRow>
							<TableCell colSpan={8} className="text-center text-muted-foreground">
								No hay ajustes registrados.
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>

			<AlertDialog open={ajustePorAnular !== null} onOpenChange={(open) => !open && setAjustePorAnular(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>¿Anular este ajuste?</AlertDialogTitle>
						<AlertDialogDescription>
							El kardex recibirá un movimiento compensatorio con el costo original y
							el stock regresará a su valor previo.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Volver</AlertDialogCancel>
						<AlertDialogAction onClick={confirmarAnulacion} disabled={isSubmitting} aria-label="Confirmar anulación">
							Confirmar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
