import { fetchClientAuthJson, type ClientAuthFetchResult } from '@/lib/client-auth-fetch';
import type { ProductoConStock } from '@/lib/api/productos-ubicacion';
import type { CreateVentaInput } from '@/features/ventas/schemas';

interface TurnoActivoPayload {
  turno: unknown | null;
}

interface ProductosPayload {
  productos?: ProductoConStock[];
}

interface AnticiposPayload {
  anticipos?: unknown[];
}

async function unwrapArrayResult<T>(
  result: ClientAuthFetchResult<{ [key: string]: T[] | undefined }>,
  key: string,
): Promise<ClientAuthFetchResult<T[]>> {
  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: (result.data[key] as T[] | undefined) ?? [],
    status: result.status,
    shouldClearState: false,
  };
}

/**
 * @description Carga productos de un punto de venta mediante una ruta estable.
 * @param {string} puntoDeVentaId - ID del punto de venta.
 * @param {() => void} clearState - Callback para limpiar estado stale.
 * @returns {Promise<ClientAuthFetchResult<ProductoConStock[]>>} Resultado normalizado.
 */
export async function fetchProductosPuntoVenta(
  puntoDeVentaId: string,
  clearState?: () => void,
): Promise<ClientAuthFetchResult<ProductoConStock[]>> {
  const result = await fetchClientAuthJson<ProductosPayload>(
    `/api/ventas/punto-venta/${puntoDeVentaId}/productos`,
    {
      clearState,
      defaultErrorMessage: 'Error al cargar productos',
    },
  );

  return unwrapArrayResult<ProductoConStock>(result as ClientAuthFetchResult<{ [key: string]: ProductoConStock[] | undefined }>, 'productos');
}

/**
 * @description Carga el turno activo de un punto de venta mediante una ruta estable.
 * @param {string} puntoDeVentaId - ID del punto de venta.
 * @param {() => void} clearState - Callback para limpiar estado stale.
 * @returns {Promise<ClientAuthFetchResult<unknown | null>>} Resultado normalizado.
 */
export async function fetchTurnoActivoPuntoVenta(
  puntoDeVentaId: string,
  clearState?: () => void,
): Promise<ClientAuthFetchResult<unknown | null>> {
  const result = await fetchClientAuthJson<TurnoActivoPayload>(
    `/api/ventas/punto-venta/${puntoDeVentaId}/turno-activo`,
    {
      clearState,
      defaultErrorMessage: 'Error al cargar el turno activo',
    },
  );

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: result.data.turno ?? null,
    status: result.status,
    shouldClearState: false,
  };
}

/**
 * @description Carga anticipos de cobro disponibles para facturación POS mediante una ruta estable.
 * @param {string} clienteId - ID del cliente.
 * @param {() => void} clearState - Callback para limpiar estado stale.
 * @returns {Promise<ClientAuthFetchResult<unknown[]>>} Resultado normalizado.
 */
export async function fetchAnticiposCobroDisponibles(
  clienteId: string,
  clearState?: () => void,
): Promise<ClientAuthFetchResult<unknown[]>> {
  const query = new URLSearchParams({
    contexto: 'factura',
    clienteId,
    moneda: 'CUP',
  });

  const result = await fetchClientAuthJson<AnticiposPayload>(
    `/api/contabilidad/anticipos/disponibles?${query.toString()}`,
    {
      clearState,
      defaultErrorMessage: 'Error al cargar anticipos disponibles',
    },
  );

  return unwrapArrayResult<unknown>(result as ClientAuthFetchResult<{ [key: string]: unknown[] | undefined }>, 'anticipos');
}

/**
 * @description Crea una venta POS mediante la ruta estable browser-safe.
 * @param {CreateVentaInput} input - Payload de la venta.
 * @param {() => void} clearState - Callback para limpiar estado stale.
 * @returns {Promise<ClientAuthFetchResult<unknown>>} Resultado normalizado.
 */
export async function createVentaPos(
  input: CreateVentaInput,
  clearState?: () => void,
): Promise<ClientAuthFetchResult<unknown>> {
  return fetchClientAuthJson<unknown>('/api/ventas/punto-venta/ventas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    clearState,
    defaultErrorMessage: 'Ha ocurrido un error al procesar la venta. Intente nuevamente.',
  });
}
