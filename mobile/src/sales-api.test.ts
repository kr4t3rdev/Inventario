import { describe, expect, it, vi } from 'vitest';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import { createGeneratedSalesApi } from './sales-api';

describe('generated sales API adapter', () => {
  it('uses the authenticated SDK contract for reads and mutations', async () => {
    const requests: Array<{ method: string; url: string; body: unknown; authorization: string | null }> = [];
    const fetchApi: FetchAPI = async (input, init) => {
      requests.push({
        method: init?.method ?? 'GET',
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
        authorization: new Headers(init?.headers).get('Authorization'),
      });
      return new Response(JSON.stringify({ items: [], ventaId: 'sale-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const api = createGeneratedSalesApi('https://example.test/', () => 'access-token', fetchApi);

    await api.list();
    await api.create({ puntoDeVentaId: 'pos-1', items: [{ productoId: 'product-1', cantidad: 1, precioUnitario: 12 }] });
    await api.update('sale-1', { descuento: 2, observaciones: 'Actualizada desde mobile' });
    await api.cancel('sale-1', { motivo: 'Solicitud del cliente' });

    expect(requests).toEqual([
      { method: 'GET', url: 'https://example.test/api/mobile/v1/sales', body: null, authorization: 'Bearer access-token' },
      { method: 'POST', url: 'https://example.test/api/mobile/v1/sales/create', body: { puntoDeVentaId: 'pos-1', items: [{ productoId: 'product-1', cantidad: 1, precioUnitario: 12 }] }, authorization: 'Bearer access-token' },
      { method: 'PATCH', url: 'https://example.test/api/mobile/v1/sales/sale-1/update', body: { descuento: 2, observaciones: 'Actualizada desde mobile' }, authorization: 'Bearer access-token' },
      { method: 'POST', url: 'https://example.test/api/mobile/v1/sales/sale-1/cancel', body: { motivo: 'Solicitud del cliente' }, authorization: 'Bearer access-token' },
    ]);
  });

  it('expires the local session callback on unauthorized mutations', async () => {
    const unauthorized = vi.fn();
    const fetchApi: FetchAPI = async () => new Response('unauthorized', { status: 403 });
    const api = createGeneratedSalesApi('https://example.test', () => 'secret-token', fetchApi, unauthorized);

    await expect(api.cancel('sale-1', { motivo: 'duplicate' })).rejects.toThrow();
    expect(unauthorized).toHaveBeenCalledOnce();
  });
});
