import { describe, expect, it, vi } from 'vitest';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import { createGeneratedAccountingApi } from './accounting-api';

describe('generated accounting API adapter', () => {
  it('maps bank-account list and detail to the existing mobile routes', async () => {
    const requests: Array<{ method?: string; url?: string; authorization?: string }> = [];
    const fetchApi = vi.fn<FetchAPI>(async (input, init) => {
      requests.push({
        method: init?.method,
        url: String(input),
        authorization: new Headers(init?.headers).get('authorization') ?? undefined,
      });
      return new Response(JSON.stringify({ items: [], transacciones: [], resumen: {}, pagination: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const api = createGeneratedAccountingApi('https://example.test/', () => 'access-token', fetchApi);

    await api.listBankAccounts();
    await api.getBankAccount('bank-1');
    await api.getBankAccountHistory('bank-1', {
      page: 2,
      limit: 10,
      tipoMovimiento: 'venta',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-01-31T00:00:00.000Z'),
    });
    expect(requests).toEqual([
      { method: 'GET', url: 'https://example.test/api/mobile/v1/accounting/bank-accounts', authorization: 'Bearer access-token' },
      { method: 'GET', url: 'https://example.test/api/mobile/v1/accounting/bank-accounts/bank-1', authorization: 'Bearer access-token' },
      { method: 'GET', url: 'https://example.test/api/mobile/v1/accounting/bank-accounts/bank-1/history?fechaInicio=2026-01-01T00%3A00%3A00.000Z&fechaFin=2026-01-31T00%3A00%3A00.000Z&tipoMovimiento=venta&page=2&limit=10', authorization: 'Bearer access-token' },
    ]);
  });

  it('clears the mobile session on unauthorized bank-account responses', async () => {
    const onUnauthorized = vi.fn();
    const fetchApi = vi.fn<FetchAPI>(async () => new Response('{}', { status: 403 }));
    const api = createGeneratedAccountingApi('https://example.test', () => 'access-token', fetchApi, onUnauthorized);

    await expect(api.listBankAccounts()).rejects.toMatchObject({ response: { status: 403 } });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('clears the mobile session on unauthorized history responses', async () => {
    const onUnauthorized = vi.fn();
    const fetchApi = vi.fn<FetchAPI>(async () => new Response('{}', { status: 401 }));
    const api = createGeneratedAccountingApi('https://example.test', () => 'access-token', fetchApi, onUnauthorized);

    await expect(api.getBankAccountHistory('bank-1')).rejects.toMatchObject({ response: { status: 401 } });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
