/**
 * @description Página de conteos físicos ciegos (bucle: iniciar → dos capturas
 * por usuarios distintos → conciliación con ajuste automático).
 *
 * @returns {Promise<JSX.Element>} Vista de conteos.
 */
import { getAlmacenesAction } from '@/features/almacenes';
import { getPuntosDeVentaAction } from '@/features/puntos-venta';
import { getConteosAction } from '@/features/inventario/actions-conteos';
import { ConteosPageClient } from '@/features/inventario/components/conteos-page-client';

export const metadata = {
	title: 'Conteos físicos - FinanceMDM',
};

export const dynamic = 'force-dynamic';

export default async function ConteosPage() {
	const [almacenes, puntosVenta, conteos] = await Promise.all([
		getAlmacenesAction(),
		getPuntosDeVentaAction(),
		getConteosAction({}),
	]);

	return (
		<ConteosPageClient
			almacenes={almacenes.success ? (almacenes.data ?? []) : []}
			puntosVenta={puntosVenta.success ? (puntosVenta.data ?? []) : []}
			conteosIniciales={conteos.success ? (conteos.data ?? []) : []}
		/>
	);
}
