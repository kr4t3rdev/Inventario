import { getProductosAction } from '@/features/productos/actions';
import { getVendorsAction } from '@/features/vendors';
import { getOrdenesCompraAction } from '@/features/compras-productos/actions-oc';
import { OrdenesCompraPageClient } from '@/features/compras-productos/components/ordenes-compra-page-client';

export const metadata = { title: 'Órdenes de compra - FinanceMDM' };
export const dynamic = 'force-dynamic';

/**
 * @description Página de órdenes de compra para el plan Profesional.
 * @returns {Promise<JSX.Element>} Vista de órdenes y recepciones.
 */
export default async function OrdenesCompraPage() {
  const [vendors, products, orders] = await Promise.all([
    getVendorsAction(),
    getProductosAction(),
    getOrdenesCompraAction({ page: 1, limit: 50 }),
  ]);
  return (
    <OrdenesCompraPageClient
      vendors={vendors.success ? (vendors.data ?? []) as any[] : []}
      products={products.success ? (products.data ?? []) as any[] : []}
      orders={orders.success ? (orders.data?.items ?? []) as any[] : []}
    />
  );
}
