'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';

import { getTrazabilidadLoteAction } from '@/features/inventario/actions-trazabilidad';
import type { TrazabilidadLote } from '@/features/inventario/services/trazabilidad-lote';

interface TrazabilidadLotePanelProps {
	loteId: string;
}

/**
 * @description Muestra la trazabilidad de un lote: origen y ventas que consumieron sus unidades.
 * @param {TrazabilidadLotePanelProps} props - Identificador del lote a consultar.
 * @returns {ReactElement} Panel con estado de carga, error o la línea de tiempo del lote.
 */
export function TrazabilidadLotePanel({ loteId }: TrazabilidadLotePanelProps): ReactElement {
	const [trazabilidad, setTrazabilidad] = useState<TrazabilidadLote | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [cargando, setCargando] = useState(true);

	useEffect(() => {
		let activo = true;
		setCargando(true);
		setError(null);
		getTrazabilidadLoteAction(loteId)
			.then((resultado) => {
				if (!activo) return;
				if (!resultado.success) {
					setError(resultado.error?.message ?? 'No se pudo consultar la trazabilidad del lote');
					return;
				}
				setTrazabilidad(resultado.data ?? null);
			})
			.catch((fallo: unknown) => {
				if (!activo) return;
				console.error('Error al cargar la trazabilidad del lote:', fallo);
				setError('No se pudo consultar la trazabilidad del lote');
			})
			.finally(() => {
				if (activo) setCargando(false);
			});
		return () => {
			activo = false;
		};
	}, [loteId]);

	if (cargando) {
		return (
			<div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
				Cargando trazabilidad del lote...
			</div>
		);
	}

	if (error) {
		return (
			<div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
				{error}
			</div>
		);
	}

	if (!trazabilidad) {
		return (
			<p role="status" className="text-sm text-muted-foreground">
				No hay informacion de trazabilidad para este lote.
			</p>
		);
	}

	const { lote, origen, destinos, cantidadAsignada } = trazabilidad;

	return (
		<section aria-labelledby="trazabilidad-lote-titulo" className="space-y-4">
			<div>
				<h2 id="trazabilidad-lote-titulo" className="text-lg font-semibold">
					Lote {lote.codigo} · {lote.productoNombre}
				</h2>
				<p className="text-sm text-muted-foreground">
					Inicial {lote.cantidadInicial} · Disponible {lote.cantidadDisponible} · Asignado {cantidadAsignada}
				</p>
			</div>

			<div className="rounded-lg border p-4">
				<h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Origen</h3>
				{origen ? (
					<p className="text-sm">
						{origen.tipo === 'COMPRA' ? 'Compra' : 'Recepcion'} {origen.numero} · {origen.proveedor} ·{' '}
						{origen.cantidad} unidades
					</p>
				) : (
					<p className="text-sm text-muted-foreground">El lote no tiene documento de origen registrado.</p>
				)}
			</div>

			<div>
				<h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Ventas destino</h3>
				{destinos.length === 0 ? (
					<p className="text-sm text-muted-foreground">Este lote todavia no tiene ventas asociadas.</p>
				) : (
					<ul className="space-y-2">
						{destinos.map((destino) => (
							<li key={destino.ventaItemId} className="rounded-lg border p-3 text-sm">
								{destino.numeroFactura ?? destino.ventaId} · {destino.cliente} · {destino.cantidad} unidades
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
