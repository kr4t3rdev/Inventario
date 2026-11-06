import { type ReactElement } from 'react';

import { getLotesInventarioAction } from '@/features/inventario/actions-lotes';
import {
	LotesInventarioContent,
	type LoteListadoFila,
} from '@/features/inventario/components/lotes-inventario-content';

/**
 * @description Pagina de listado de lotes del inventario con acceso a la trazabilidad.
 * @returns {Promise<ReactElement>} Listado de lotes del tenant o aviso de error.
 */
export default async function LotesInventarioPage(): Promise<ReactElement> {
	const resultado = await getLotesInventarioAction({ limit: 100 });

	if (!resultado.success) {
		return (
			<div
				role="alert"
				className="mx-auto w-full max-w-4xl rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm"
			>
				No se pudieron cargar los lotes del inventario.
			</div>
		);
	}

	const lotes: LoteListadoFila[] = resultado.data?.lotes.map((lote) => ({
		id: lote.id,
		codigo: lote.codigo,
		productoNombre: lote.producto.nombre,
		fechaVencimiento: lote.fechaVencimiento,
		cantidadInicial: lote.cantidadInicial,
		cantidadDisponible: lote.cantidadDisponible,
	})) ?? [];

	return (
		<div className="mx-auto w-full max-w-4xl p-4">
			<h1 className="text-xl font-semibold">Lotes del inventario</h1>
			<LotesInventarioContent lotes={lotes} />
		</div>
	);
}
