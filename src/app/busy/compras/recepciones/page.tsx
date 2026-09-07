import { getProductosAction } from '@/features/productos/actions';
import { getVendorsAction } from '@/features/vendors';
import { getOrdenesCompraAction } from '@/features/compras-productos/actions-oc';
import { OrdenesCompraPageClient } from '@/features/compras-productos/components/ordenes-compra-page-client';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { hasFeature } from '@/lib/services/tenant-scope';

export const metadata = { title: 'Recepciones de compra - FinanceMDM' };
export const dynamic = 'force-dynamic';

/**
 * @description Página de recepciones parciales y backorders. Las acciones de
 * gestión de OC se ocultan si el plan no incluye `ordenes-compra`.
 * @returns {Promise<JSX.Element>} Vista de recepciones.
 */
export default async function RecepcionesPage() {
  const [user, vendors, products, orders] = await Promise.all([
    getCurrentUser(),
    getVendorsAction(),
    getProductosAction(),
    getOrdenesCompraAction({ page: 1, limit: 50 }),
  ]);
  if (!orders.success) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Recepciones de compra</h1>
        <p role="alert" className="mt-2 text-sm text-destructive">
          {orders.error?.message ?? 'No se pudieron cargar las recepciones.'}
        </p>
      </div>
    );
  }
  const canManage = user ? hasFeature(user, 'ordenes-compra') : false;
  const canReceive = user ? hasFeature(user, 'recepciones') : false;
  return (
    <OrdenesCompraPageClient
      vendors={vendors.success ? (vendors.data ?? []) as any[] : []}
      products={products.success ? (products.data ?? []) as any[] : []}
      orders={(orders.data?.items ?? []) as any[]}
      canManageOrders={canManage}
      canReceive={canReceive}
    />
  );
}
