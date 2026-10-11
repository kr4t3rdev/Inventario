import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getDashboardStatsData } from '@/features/dashboard/services/dashboard-stats-service';

export const dynamic = 'force-dynamic';

/**
 * @description Mobile dashboard transfers endpoint (Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Dashboard section response.
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const { searchParams } = new URL(request.url);
    const data = await getDashboardStatsData({
      tenantId,
      ubicacionId: searchParams.get('ubicacionId'),
      tipoUbicacion: searchParams.get('tipoUbicacion'),
    });
    const s = data.transferenciasStats;
    const items = [
      { id: 'almacen-almacen', descripcion: 'Almacén → Almacén', monto: s.almacenAAlmacen, estado: 'Completada' },
      { id: 'almacen-punto-venta', descripcion: 'Almacén → Punto de Venta', monto: s.almacenAPuntoVenta, estado: 'Completada' },
      { id: 'punto-venta-almacen', descripcion: 'Punto de Venta → Almacén', monto: s.puntoVentaAAlmacen, estado: 'Completada' },
      { id: 'punto-venta-punto-venta', descripcion: 'Punto de Venta → Punto de Venta', monto: s.puntoVentaAPuntoVenta, estado: 'Completada' },
    ];
    return successResponse({ items });
  } catch (error) {
    console.error('Error en mobile dashboard transfers route:', error);
    return errorResponse('Error al obtener transferencias', 500, 'INTERNAL_ERROR');
  }
}
