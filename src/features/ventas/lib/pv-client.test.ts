import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createVentaPos,
  fetchAnticiposCobroDisponibles,
  fetchProductosPuntoVenta,
  fetchTurnoActivoPuntoVenta,
} from './pv-client';

describe('pv-client stable transport helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads productos through the stable POS route', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        productos: [{ id: 'prod-1', nombre: 'Producto 1', stockEnUbicacion: 3 }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await fetchProductosPuntoVenta('pv-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([{ id: 'prod-1', nombre: 'Producto 1', stockEnUbicacion: 3 }]);
    }
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ventas/punto-venta/pv-1/productos',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('clears stale POS shift state on forbidden responses', async () => {
    const clearState = vi.fn();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'No autorizado', code: 'FORBIDDEN' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await fetchTurnoActivoPuntoVenta('pv-1', clearState);

    expect(result.success).toBe(false);
    expect(result.shouldClearState).toBe(true);
    expect(clearState).toHaveBeenCalledTimes(1);
  });

  it('clears stale anticipos state on client-version mismatches', async () => {
    const clearState = vi.fn();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Cliente desactualizado', code: 'STALE_CLIENT_VERSION' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await fetchAnticiposCobroDisponibles('cliente-1', clearState);

    expect(result.success).toBe(false);
    expect(result.shouldClearState).toBe(true);
    expect(clearState).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/contabilidad/anticipos/disponibles?contexto=factura&clienteId=cliente-1&moneda=CUP',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('creates POS sales through the stable POST route', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ventaId: 'v-1', total: 1000 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await createVentaPos({
      puntoDeVentaId: 'pv-1',
      items: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 500 }],
    });

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ventas/punto-venta/ventas',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          puntoDeVentaId: 'pv-1',
          items: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 500 }],
        }),
      }),
    );
  });
});
