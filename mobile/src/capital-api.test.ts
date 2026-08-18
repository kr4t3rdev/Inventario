import { describe, expect, it, vi } from 'vitest';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import { createGeneratedCapitalApi } from './capital-api';

describe('generated capital API adapter', () => {
  it('maps capital-injection reads, creation, and payment to existing routes', async () => {
    const requests: Array<{ url: string; method?: string; body?: string }> = [];
    const fetchApi = vi.fn<FetchAPI>(async (input, init) => {
      requests.push({
        url: String(input),
        method: init?.method,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      const url = String(input);
      const response = url.includes('/payments')
        ? { inyeccionId: 'capital-1', monto: 75, moneda: 'CUP' }
        : url.includes('?')
          ? { items: [{ inyeccionId: 'capital-1', monto: 500, moneda: 'CUP' }] }
          : { inyeccionId: 'capital-1', monto: 500, moneda: 'CUP' };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const api = createGeneratedCapitalApi('https://example.test', () => 'access-token', fetchApi);
    const createInput = {
      monto: 500,
      moneda: 'CUP',
      tipo: 'APORTE',
      descripcion: 'Capital inicial',
      cuentaBancariaId: 'bank-1',
    };
    const paymentInput = {
      monto: 75,
      cuentaBancariaId: 'bank-1',
      tipoPagoId: 'cash',
      observaciones: 'Primera cuota',
    };

    await expect(api.listCapitalInjections({ tipo: 'APORTE' })).resolves.toMatchObject({
      items: [{ inyeccionId: 'capital-1', monto: 500 }],
    });
    await expect(api.createCapitalInjection(createInput)).resolves.toMatchObject({
      inyeccionId: 'capital-1',
      monto: 500,
    });
    await expect(api.registerCapitalPayment('capital/id', paymentInput)).resolves.toMatchObject({
      inyeccionId: 'capital-1',
      monto: 75,
    });

    expect(requests.map(({ url, method }) => ({ url, method }))).toEqual([
      { url: 'https://example.test/api/mobile/v1/accounting/capital-injections?tipo=APORTE', method: 'GET' },
      { url: 'https://example.test/api/mobile/v1/accounting/capital-injections', method: 'POST' },
      { url: 'https://example.test/api/mobile/v1/accounting/capital-injections/capital%2Fid/payments', method: 'POST' },
    ]);
    expect(JSON.parse(requests[1].body ?? '{}')).toEqual(createInput);
    expect(JSON.parse(requests[2].body ?? '{}')).toEqual(paymentInput);
  });

  it('clears the mobile session on unauthorized capital responses', async () => {
    const onUnauthorized = vi.fn();
    const fetchApi = vi.fn<FetchAPI>(async () => new Response('{}', { status: 403 }));
    const api = createGeneratedCapitalApi('https://example.test', () => 'access-token', fetchApi, onUnauthorized);

    await expect(api.listCapitalInjections()).rejects.toMatchObject({ response: { status: 403 } });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
