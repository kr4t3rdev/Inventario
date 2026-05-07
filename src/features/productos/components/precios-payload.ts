export interface PrecioListaPayload {
  listaPrecioId: string;
  precio: number;
}

/**
 * @description Normaliza el estado del formulario de precios por lista al payload de API.
 * @param {Record<string, string>} preciosPorLista - Mapa de listaPrecioId a valor string capturado en inputs.
 * @returns {PrecioListaPayload[]} Arreglo de precios válido para enviar a backend.
 */
export function buildPreciosPayload(
  preciosPorLista: Record<string, string>,
): PrecioListaPayload[] {
  return Object.entries(preciosPorLista)
    .filter(([, precio]) => precio !== '' && !Number.isNaN(Number(precio)))
    .map(([listaPrecioId, precio]) => ({
      listaPrecioId,
      precio: Number(precio),
    }));
}
