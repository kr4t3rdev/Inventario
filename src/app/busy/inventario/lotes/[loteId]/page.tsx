import { type ReactElement } from 'react';

import { TrazabilidadLotePanel } from '@/features/inventario/components/trazabilidad-lote-panel';

interface TrazabilidadLotePageProps {
	params: Promise<{ loteId: string }>;
}

/**
 * @description Pagina de trazabilidad de un lote del inventario.
 * @param {TrazabilidadLotePageProps} props - Parametros de ruta con el identificador del lote.
 * @returns {Promise<ReactElement>} Vista del lote con su origen y sus ventas destino.
 */
export default async function TrazabilidadLotePage({
	params,
}: TrazabilidadLotePageProps): Promise<ReactElement> {
	const { loteId } = await params;

	return (
		<div className="mx-auto w-full max-w-3xl p-4">
			<h1 className="text-xl font-semibold">Trazabilidad del lote</h1>
			<TrazabilidadLotePanel loteId={loteId} />
		</div>
	);
}
