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

  it('encodes bank-account identifiers and clears the session on forbidden history responses', async () => {
    const onUnauthorized = vi.fn();
    const requests: string[] = [];
    const fetchApi = vi.fn<FetchAPI>(async (input) => {
      requests.push(String(input));
      return new Response('{}', { status: 403 });
    });
    const api = createGeneratedAccountingApi('https://example.test', () => 'access-token', fetchApi, onUnauthorized);

    await expect(api.getBankAccountHistory('bank/id')).rejects.toMatchObject({ response: { status: 403 } });
    expect(requests).toEqual(['https://example.test/api/mobile/v1/accounting/bank-accounts/bank%2Fid/history']);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('deserializes the bank-account history contract returned by the backend', async () => {
    const fetchApi = vi.fn<FetchAPI>(async () => new Response(JSON.stringify({
      transacciones: [{
        transaccionId: 'tx-1',
        fecha: '2026-01-15T12:00:00.000Z',
        tipoMovimiento: 'venta',
        descripcion: 'Venta POS',
        montoOriginal: 100,
        monedaOriginal: 'USD',
        tasaCambio: null,
        montoConvertido: 100,
      }],
      resumen: {
        saldoActual: 500,
        totalIngresos: 700,
        totalEgresos: 200,
        totalMovimientos: 2,
      },
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const api = createGeneratedAccountingApi('https://example.test', () => 'access-token', fetchApi);

    const response = await api.getBankAccountHistory('bank-1');

    expect(response.transacciones[0]).toMatchObject({
      transaccionId: 'tx-1',
      tipoMovimiento: 'venta',
      montoConvertido: 100,
    });
    expect(response.transacciones[0].fecha).toEqual(new Date('2026-01-15T12:00:00.000Z'));
    expect(response.resumen).toEqual({
      saldoActual: 500,
      totalIngresos: 700,
      totalEgresos: 200,
      totalMovimientos: 2,
    });
    expect(response.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('maps bank-transfer list filters and detail to the existing mobile routes', async () => {
    const requests: string[] = [];
    const fetchApi = vi.fn<FetchAPI>(async (input) => {
      requests.push(String(input));
      return new Response(JSON.stringify(
        String(input).includes('/bank-transfers?')
          ? { items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }
          : { transferenciaId: 'transfer-1' },
      ), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const api = createGeneratedAccountingApi('https://example.test', () => 'access-token', fetchApi);

    await api.listBankTransfers({
      fechaInicio: new Date('2026-02-01T00:00:00.000Z'),
      fechaFin: new Date('2026-02-28T00:00:00.000Z'),
      cuentaId: 'account-1',
    });
    await api.getBankTransfer('transfer-1');

    expect(requests).toEqual([
      'https://example.test/api/mobile/v1/accounting/bank-transfers?fechaInicio=2026-02-01T00%3A00%3A00.000Z&fechaFin=2026-02-28T00%3A00%3A00.000Z&cuentaId=account-1',
      'https://example.test/api/mobile/v1/accounting/bank-transfers/transfer-1',
    ]);
  });

  it('clears the mobile session on unauthorized bank-transfer detail responses', async () => {
    const onUnauthorized = vi.fn();
    const fetchApi = vi.fn<FetchAPI>(async () => new Response('{}', { status: 401 }));
    const api = createGeneratedAccountingApi('https://example.test', () => 'access-token', fetchApi, onUnauthorized);

    await expect(api.getBankTransfer('transfer-1')).rejects.toMatchObject({ response: { status: 401 } });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
