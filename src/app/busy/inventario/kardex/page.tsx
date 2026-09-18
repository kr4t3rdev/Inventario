/**
 * @description Página del kardex de inventario.
 * Server Component que carga los catálogos necesarios para los filtros
 * y delega la consulta interactiva a KardexPageClient.
 *
 * @returns {Promise<JSX.Element>} Vista del kardex con filtros.
 */
import { getAlmacenesAction } from '@/features/almacenes';
import { getPuntosDeVentaAction } from '@/features/puntos-venta';
import { getProductosAction } from '@/features/productos/actions';
import { KardexPageClient } from '@/features/inventario/components/kardex-page-client';

export const metadata = {
	title: 'Kardex de inventario - FinanceMDM',
};

export const dynamic = 'force-dynamic';

export default async function KardexPage() {
	const [productosResult, almacenesResult, puntosVentaResult] = await Promise.all([
		getProductosAction(),
		getAlmacenesAction(),
		getPuntosDeVentaAction(),
	]);

	return (
		<KardexPageClient
			productos={productosResult.success ? (productosResult.data ?? []) : []}
			almacenes={almacenesResult.success ? (almacenesResult.data ?? []) : []}
			puntosVenta={puntosVentaResult.success ? (puntosVentaResult.data ?? []) : []}
		/>
	);
}
