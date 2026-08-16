import type { SaleCreateRequest } from '../../sdks/mobile-v1/typescript/src';

export interface SaleFormState {
  puntoDeVentaId: string;
  productoId: string;
  cantidad: string;
  precioUnitario: string;
  observaciones: string;
}

/**
 * @description Validates mobile sale fields against the existing backend schema and builds its request.
 * @param {SaleFormState} form - Raw controlled form values.
 * @returns {{ request: SaleCreateRequest | null; error: string }} Validated request or safe message.
 */
export function buildSaleCreateRequest(form: SaleFormState): { request: SaleCreateRequest | null; error: string } {
  const cantidad = Number(form.cantidad);
  const precioUnitario = Number(form.precioUnitario);
  if (!form.puntoDeVentaId.trim() || !form.productoId.trim()) {
    return { request: null, error: 'Completa el punto de venta y el producto.' };
  }
  if (!form.cantidad.trim() || !form.precioUnitario.trim()) {
    return { request: null, error: 'Completa la cantidad y el precio unitario.' };
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0 || !Number.isInteger(precioUnitario) || precioUnitario < 0) {
    return { request: null, error: 'La cantidad debe ser un entero mayor a 0 y el precio un entero no negativo.' };
  }
  return {
    request: {
      puntoDeVentaId: form.puntoDeVentaId.trim(),
      items: [{ productoId: form.productoId.trim(), cantidad, precioUnitario }],
      ...(form.observaciones.trim() ? { observaciones: form.observaciones.trim() } : {}),
    },
    error: '',
  };
}
