import { describe, expect, it, vi } from 'vitest';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import { createGeneratedBusinessApi } from './business-api';
import { loadBusinessSurface } from './business-surface';

describe('generated business API adapter', () => {
  it('uses the configured base URL, bearer token, and contract query params', async () => {
    const requests: Array<{ url: string; authorization: string | null }> = [];
    const fetchApi: FetchAPI = async (input, init) => {
      requests.push({
        url: String(input),
        authorization: new Headers(init?.headers).get('Authorization'),
      });
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const api = createGeneratedBusinessApi('https://example.test/', () => 'access-token', fetchApi);

    await api.dashboard({ ubicacionId: 'location-1', tipoUbicacion: 'almacen' });
    await api.products();
    await api.stock({ ubicacionId: 'location-1', tipoUbicacion: 'punto_venta', includeZero: 'false' });

    expect(requests).toEqual([
      {
        url: 'https://example.test/api/mobile/v1/dashboard/stats?ubicacionId=location-1&tipoUbicacion=almacen',
        authorization: 'Bearer access-token',
      },
      {
        url: 'https://example.test/api/mobile/v1/products',
        authorization: 'Bearer access-token',
      },
      {
        url: 'https://example.test/api/mobile/v1/products/stock?ubicacionId=location-1&tipoUbicacion=punto_venta&includeZero=false',
        authorization: 'Bearer access-token',
      },
    ]);
  });
});

describe('business surface loading orchestration', () => {
  it('keeps successful sections when one request fails and can retry one section', async () => {
    const api = {
      dashboard: vi.fn(async () => ({ total: 4 })),
      products: vi.fn(async () => { throw new Error('products unavailable'); }),
      stock: vi.fn(async () => ({ items: [{ id: 'p-1', nombre: 'Producto' }] })),
    };

    const result = await loadBusinessSurface(api, { tipoUbicacion: 'almacen', ubicacionId: 'location-1' });

    expect(result.data.dashboard).toEqual({ total: 4 });
    expect(result.data.products).toBeNull();
    expect(result.data.stock?.items[0].id).toBe('p-1');
    expect(result.errors.products?.message).toBe('products unavailable');
    await expect(api.products()).rejects.toThrow('products unavailable');
    expect(api.products).toHaveBeenCalledTimes(2);
  });

  it('does not request stock until both required location parameters are present', async () => {
    const api = {
      dashboard: vi.fn(async () => ({ total: 4 })),
      products: vi.fn(async () => ({ items: [] })),
      stock: vi.fn(async () => ({ items: [] })),
    };

    await loadBusinessSurface(api, { tipoUbicacion: 'almacen' });
    expect(api.stock).not.toHaveBeenCalled();

    await loadBusinessSurface(api, { tipoUbicacion: 'almacen', ubicacionId: 'location-1' });
    expect(api.stock).toHaveBeenCalledWith({
      tipoUbicacion: 'almacen',
      ubicacionId: 'location-1',
      includeZero: 'false',
    });
  });

  it.each([
    ['dashboard', 401], ['dashboard', 403], ['products', 401], ['products', 403],
    ['stock', 401], ['stock', 403],
  ])('calls the unauthorized callback for generated %s %s without logging bodies', async (endpoint, status) => {
    const unauthorized = vi.fn();
    const fetchApi: FetchAPI = async () => new Response('sensitive error body', { status });
    const api = createGeneratedBusinessApi('https://example.test', () => 'secret-token', fetchApi, unauthorized);
    const request = endpoint === 'dashboard'
      ? api.dashboard()
      : endpoint === 'products'
        ? api.products()
        : api.stock({ ubicacionId: 'location-1', tipoUbicacion: 'almacen' });

    await expect(request).rejects.toThrow();
    expect(unauthorized).toHaveBeenCalledOnce();
  });
});
