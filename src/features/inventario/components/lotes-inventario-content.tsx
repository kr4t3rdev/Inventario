'use client';

import Link from 'next/link';
import { type ReactElement } from 'react';

export interface LoteListadoFila {
	id: string;
	codigo: string;
	productoNombre: string;
	fechaVencimiento: string | Date | null;
	cantidadInicial: number;
	cantidadDisponible: number;
}

interface LotesInventarioContentProps {
	lotes: LoteListadoFila[];
}

/**
 * @description Formatea una fecha de vencimiento que puede venir como ISO o Date.
 * @param {string | Date | null} valor - Fecha recibida del servidor.
 * @returns {string} Fecha legible o guion cuando no existe.
 */
function formatearVencimiento(valor: string | Date | null): string {
	if (!valor) return '-';
	const fecha = valor instanceof Date ? valor : new Date(valor);
	if (Number.isNaN(fecha.getTime())) return '-';
	return fecha.toISOString().slice(0, 10);
}

/**
 * @description Muestra el listado de lotes del inventario con acceso a su trazabilidad.
 * @param {LotesInventarioContentProps} props - Lotes a mostrar.
 * @returns {ReactElement} Tabla de lotes o estado vacío.
 */
export function LotesInventarioContent({ lotes }: LotesInventarioContentProps): ReactElement {
	if (lotes.length === 0) {
		return (
			<p role="status" className="mt-4 text-sm text-muted-foreground">
				Todavia no hay lotes registrados en el inventario.
			</p>
		);
	}

	return (
		<table className="mt-4 w-full text-left text-sm">
			<caption className="sr-only">Lotes del inventario</caption>
			<thead>
				<tr className="border-b">
					<th scope="col" className="py-2">Lote</th>
					<th scope="col" className="py-2">Producto</th>
					<th scope="col" className="py-2">Vencimiento</th>
					<th scope="col" className="py-2">Inicial</th>
					<th scope="col" className="py-2">Disponible</th>
					<th scope="col" className="py-2">Trazabilidad</th>
				</tr>
			</thead>
			<tbody>
				{lotes.map((lote) => (
					<tr key={lote.id} className="border-b last:border-0">
						<td className="py-2 font-medium">{lote.codigo}</td>
						<td className="py-2">{lote.productoNombre}</td>
						<td className="py-2">{formatearVencimiento(lote.fechaVencimiento)}</td>
						<td className="py-2">{lote.cantidadInicial}</td>
						<td className="py-2">{lote.cantidadDisponible}</td>
						<td className="py-2">
							<Link
								href={`/busy/inventario/lotes/${lote.id}`}
								className="underline underline-offset-4"
							>
								Ver trazabilidad
							</Link>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
