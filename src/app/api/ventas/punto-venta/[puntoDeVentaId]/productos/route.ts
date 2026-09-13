import { NextRequest } from 'next/server';
import { withAuthGet } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getProductosPorUbicacion } from '@/lib/api/productos-ubicacion';
import { ServerActionError } from '@/lib/api/errors';

/**
 * @description Obtiene los productos disponibles para un punto de venta mediante una ruta estable.
 * @param {NextRequest} _request - Request HTTP autenticado.
 * @param {{ params: Promise<{ puntoDeVentaId: string }> }} context - Parámetros de la ruta.
 * @returns {Promise<Response>} Payload canónico `{ productos }`.
 */
export const GET = withAuthGet(
  async (
    request: NextRequest,
    context: { params: Promise<{ puntoDeVentaId: string }> },
  ) => {
    try {
      const { puntoDeVentaId } = await context.params;
      const clienteId = request.nextUrl.searchParams.get('clienteId') ?? undefined;
      const productos = await getProductosPorUbicacion(puntoDeVentaId, clienteId);
      return successResponse({ productos });
    } catch (error) {
      if (error instanceof ServerActionError) {
        const code = error.status === 404 ? 'LOCATION_NOT_FOUND' : 'PRODUCTS_READ_FAILED';
        return errorResponse(error.message, error.status, code);
      }

      console.error('Error al obtener productos por punto de venta:', error);
      return errorResponse('Error al cargar productos', 500, 'PRODUCTS_READ_FAILED');
    }
  },
);
