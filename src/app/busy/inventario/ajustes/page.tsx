/**
 * @description Página de ajustes de inventario.
 * Carga los catálogos y el listado inicial vía Server Actions.
 *
 * @returns {Promise<JSX.Element>} Vista de ajustes.
 */
import { getAlmacenesAction } from '@/features/almacenes';
import { getPuntosDeVentaAction } from '@/features/puntos-venta';
import { getProductosAction } from '@/features/productos';
import { getAjustesAction } from '@/features/inventario/actions-ajustes';
import { AjustesPageClient } from '@/features/inventario/components/ajustes-page-client';

export const metadata = {
	title: 'Ajustes de inventario - FinanceMDM',
};

export const dynamic = 'force-dynamic';

export default async function AjustesPage() {
	const [productos, almacenes, puntosVenta, ajustes] = await Promise.all([
		getProductosAction(),
		getAlmacenesAction(),
		getPuntosDeVentaAction(),
		getAjustesAction({ limit: 100 }),
	]);

	return (
		<AjustesPageClient
			productos={productos.success ? (productos.data ?? []) : []}
			almacenes={almacenes.success ? (almacenes.data ?? []) : []}
			puntosVenta={puntosVenta.success ? (puntosVenta.data ?? []) : []}
			ajustesIniciales={ajustes.success ? (ajustes.data?.items ?? []) : []}
		/>
	);
}
