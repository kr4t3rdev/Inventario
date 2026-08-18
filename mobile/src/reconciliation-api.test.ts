import { describe, expect, it, vi } from 'vitest';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import { createGeneratedReconciliationApi } from './reconciliation-api';

describe('generated reconciliation API adapter', () => {
  it('maps pending and history reads for sales, services, and expenses', async () => {
    const requests: string[] = [];
    const fetchApi = vi.fn<FetchAPI>(async (input) => {
      requests.push(String(input));
      const url = String(input);
      if (url.endsWith('/stats')) {
        return new Response(JSON.stringify({ modules: {}, stats: {}, recentActivity: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      const history = url.includes('history');
      return new Response(JSON.stringify(history
        ? { items: [], estadisticas: {}, pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }
        : { items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const api = createGeneratedReconciliationApi('https://example.test', () => 'access-token', fetchApi);

    await api.listSales({
      fechaInicio: new Date('2026-04-01T00:00:00.000Z'),
      fechaFin: new Date('2026-04-30T00:00:00.000Z'),
      puntoDeVentaId: 'pos-1',
      page: 2,
      limit: 10,
    });
    await api.getSalesHistory({ cuentaId: 'bank-1', fechaDesde: new Date('2026-04-01T00:00:00.000Z') });
    await api.listServices({ page: 2, limit: 10 });
    await api.getServicesHistory({ cuentaId: 'bank-1' });
    await api.listExpenses({ tipoGasto: 'operativo', page: 2, limit: 10 });
    await api.getExpensesHistory({ cuentaId: 'bank-1', reconciliadoPor: 'user-1' });
    await api.getStats();

    expect(requests).toEqual([
      'https://example.test/api/mobile/v1/accounting/reconciliation/sales?fechaInicio=2026-04-01T00%3A00%3A00.000Z&fechaFin=2026-04-30T00%3A00%3A00.000Z&puntoDeVentaId=pos-1&page=2&limit=10',
      'https://example.test/api/mobile/v1/accounting/reconciliation/sales-history?fechaDesde=2026-04-01T00%3A00%3A00.000Z&cuentaId=bank-1',
      'https://example.test/api/mobile/v1/accounting/reconciliation/services?page=2&limit=10',
      'https://example.test/api/mobile/v1/accounting/reconciliation/services-history?cuentaId=bank-1',
      'https://example.test/api/mobile/v1/accounting/reconciliation/expenses?tipoGasto=operativo&page=2&limit=10',
      'https://example.test/api/mobile/v1/accounting/reconciliation/expenses-history?cuentaId=bank-1&reconciliadoPor=user-1',
      'https://example.test/api/mobile/v1/accounting/reconciliation/stats',
    ]);
  });

  it('preserves reconciliation response envelopes for mobile consumers', async () => {
    const fetchApi = vi.fn<FetchAPI>(async (input) => {
      const url = String(input);
      const body = url.endsWith('/stats')
        ? { modules: {}, stats: {}, recentActivity: [] }
        : { items: [{ reconciliacionId: 'recon-1' }], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const api = createGeneratedReconciliationApi('https://example.test', () => 'access-token', fetchApi);

    await expect(api.listSales()).resolves.toMatchObject({ items: [{ reconciliacionId: 'recon-1' }] });
    await expect(api.getStats()).resolves.toEqual({ modules: {}, stats: {}, recentActivity: [] });
  });

  it('clears the mobile session on unauthorized reconciliation responses', async () => {
    const onUnauthorized = vi.fn();
    const fetchApi = vi.fn<FetchAPI>(async () => new Response('{}', { status: 401 }));
    const api = createGeneratedReconciliationApi('https://example.test', () => 'access-token', fetchApi, onUnauthorized);

    await expect(api.listExpenses()).rejects.toMatchObject({ response: { status: 401 } });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
