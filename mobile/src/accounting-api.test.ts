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

  it('validates and creates bank transfers through the generated operations', async () => {
    const requests: Array<{ url: string; method?: string; body?: string }> = [];
    const fetchApi = vi.fn<FetchAPI>(async (input, init) => {
      requests.push({
        url: String(input),
        method: init?.method,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      const response = String(input).endsWith('/validate')
        ? { saldoSuficiente: true, advertencias: [] }
        : {
            transferencia: { transferenciaId: 'transfer-1', montoOrigen: 100, montoDestino: 100 },
            numeroComprobante: 'TRF-000001',
          };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const api = createGeneratedAccountingApi('https://example.test', () => 'access-token', fetchApi);

    const input = {
      cuentaOrigenId: 'account-1',
      cuentaDestinoId: 'account-2',
      montoOrigen: 100,
      motivo: 'Reposición',
    };
    await expect(api.validateBankTransfer({ ...input, monto: input.montoOrigen })).resolves.toEqual({
      saldoSuficiente: true,
      advertencias: [],
    });
    await expect(api.createBankTransfer(input)).resolves.toMatchObject({
      transferencia: { transferenciaId: 'transfer-1', montoOrigen: 100, montoDestino: 100 },
      numeroComprobante: 'TRF-000001',
    });

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      url: 'https://example.test/api/mobile/v1/accounting/bank-transfers/validate',
      method: 'POST',
    });
    expect(JSON.parse(requests[0].body ?? '{}')).toEqual({
      cuentaOrigenId: 'account-1',
      cuentaDestinoId: 'account-2',
      monto: 100,
      motivo: 'Reposición',
    });
    expect(JSON.parse(requests[1].body ?? '{}')).toEqual(input);
  });

  it('clears the mobile session on forbidden bank-transfer mutations', async () => {
    const onUnauthorized = vi.fn();
    const fetchApi = vi.fn<FetchAPI>(async () => new Response('{}', { status: 403 }));
    const api = createGeneratedAccountingApi('https://example.test', () => 'access-token', fetchApi, onUnauthorized);

    await expect(api.validateBankTransfer({
      cuentaOrigenId: 'account-1',
      cuentaDestinoId: 'account-2',
      monto: 100,
      motivo: 'Reposición',
    })).rejects.toMatchObject({ response: { status: 403 } });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('downloads bank-transfer vouchers as binary PDFs', async () => {
    const requests: Array<{ url: string; method?: string; authorization?: string }> = [];
    const fetchApi = vi.fn<FetchAPI>(async (input, init) => {
      requests.push({
        url: String(input),
        method: init?.method,
        authorization: new Headers(init?.headers).get('authorization') ?? undefined,
      });
      return new Response(new Uint8Array([37, 80, 68, 70]), {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      });
    });
    const api = createGeneratedAccountingApi('https://example.test', () => 'access-token', fetchApi);

    const response = await api.downloadBankTransferReceipt('transfer/id');

    expect(response).toMatchObject({ size: 4, type: 'application/pdf' });
    expect(response.type).toBe('application/pdf');
    expect(await response.arrayBuffer()).toEqual(new Uint8Array([37, 80, 68, 70]).buffer);
    expect(requests).toEqual([{
      url: 'https://example.test/api/mobile/v1/accounting/bank-transfers/transfer%2Fid/comprobante',
      method: 'GET',
      authorization: 'Bearer access-token',
    }]);
  });

  it('clears the mobile session on unauthorized bank-transfer voucher responses', async () => {
    const onUnauthorized = vi.fn();
    const fetchApi = vi.fn<FetchAPI>(async () => new Response('{}', { status: 401 }));
    const api = createGeneratedAccountingApi('https://example.test', () => 'access-token', fetchApi, onUnauthorized);

    await expect(api.downloadBankTransferReceipt('transfer-1')).rejects.toMatchObject({ response: { status: 401 } });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
