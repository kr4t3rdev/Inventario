import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';

import { afterEach, describe, expect, it } from 'vitest';

import {
  AccountingBankingApi,
  AuthApi,
  Configuration,
  DashboardApi,
  ProductsApi,
  ResponseError,
  SalesApi,
} from '../../../sdks/mobile-v1/typescript/src';

interface CapturedRequest {
  method: string;
  path: string;
  headers: IncomingMessage['headers'];
  body: unknown;
}

interface MockReply {
  status?: number;
  contentType?: string;
  body: unknown;
}

interface MockServer {
  basePath: string;
  requests: CapturedRequest[];
  close: () => Promise<void>;
}

const servers: MockServer[] = [];

/**
 * @description Reads and parses a request body when present.
 * @param {IncomingMessage} request - Incoming loopback HTTP request.
 * @returns {Promise<unknown>} Parsed JSON, raw text, or undefined.
 */
async function readRequestBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString('utf8');
  return request.headers['content-type']?.includes('application/json') ? JSON.parse(text) : text;
}

/**
 * @description Starts a deterministic loopback-only HTTP server for SDK smoke tests.
 * @param {(request: CapturedRequest) => MockReply} replyFor - Response factory per request.
 * @returns {Promise<MockServer>} Running server and captured request log.
 */
async function startMockServer(
  replyFor: (request: CapturedRequest) => MockReply,
): Promise<MockServer> {
  const requests: CapturedRequest[] = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const captured: CapturedRequest = {
      method: request.method ?? 'GET',
      path: request.url ?? '/',
      headers: request.headers,
      body: await readRequestBody(request),
    };
    requests.push(captured);
    const reply = replyFor(captured);
    response.writeHead(reply.status ?? 200, {
      'content-type': reply.contentType ?? 'application/json',
    });
    response.end(reply.contentType === 'application/pdf'
      ? reply.body as Uint8Array
      : JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');
  const mockServer: MockServer = {
    basePath: `http://127.0.0.1:${address.port}/api/mobile/v1`,
    requests,
    close: () => new Promise((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
  servers.push(mockServer);
  return mockServer;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('mobile v1 generated TypeScript SDK integration smoke', () => {
  it('exposes focused smoke scripts without requiring SDK regeneration', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['mobile:smoke'])
      .toBe('vitest run src/lib/openapi/mobile-v1-integration-smoke.test.ts');
    expect(packageJson.scripts['openapi:check']).toContain('pnpm run mobile:smoke');
    expect(packageJson.scripts['mobile:smoke']).not.toMatch(/generate|jar|java/i);
  });

  it('logs in publicly, switches tenant, and uses the replacement Bearer token', async () => {
    let token = '';
    const mock = await startMockServer((request) => {
      if (request.path.endsWith('/auth/login')) return {
        body: {
          accessToken: { token: 'token-a', expiresInSeconds: 900 },
          refreshToken: { token: 'refresh-a', expiresInSeconds: 2_592_000 },
          user: { userId: 'user-1', email: 'mobile@example.com', role: 'USER' },
        },
      };
      if (request.method === 'GET') return {
        body: { items: [{ tenantId: 'tenant-b', nombre: 'Sucursal B', tenantRole: 'MANAGER' }] },
      };
      return {
        body: {
          accessToken: { token: 'token-b', expiresInSeconds: 900 },
          refreshToken: { token: 'refresh-b', expiresInSeconds: 2_592_000 },
          tenantId: 'tenant-b',
          tenantRole: 'MANAGER',
        },
      };
    });
    const auth = new AuthApi(new Configuration({ basePath: mock.basePath, accessToken: () => token }));

    const session = await auth.mobilePostAuthLogin({
      loginRequest: { email: 'mobile@example.com', password: 'test-password' },
    });
    token = session.accessToken.token;
    const tenants = await auth.mobileGetAuthTenants();
    const switched = await auth.mobilePostAuthTenants({
      switchTenantRequest: { tenantId: 'tenant-b' },
    });
    token = switched.accessToken.token;
    await auth.mobileGetAuthTenants();

    expect(tenants.items[0]?.tenantId).toBe('tenant-b');
    expect(switched.tenantId).toBe('tenant-b');
    expect(mock.requests.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
      { method: 'POST', path: '/api/mobile/v1/auth/login', body: {
        email: 'mobile@example.com', password: 'test-password',
      } },
      { method: 'GET', path: '/api/mobile/v1/auth/tenants', body: undefined },
      { method: 'POST', path: '/api/mobile/v1/auth/tenants', body: { tenantId: 'tenant-b' } },
      { method: 'GET', path: '/api/mobile/v1/auth/tenants', body: undefined },
    ]);
    expect(mock.requests.map((request) => request.headers.authorization)).toEqual([
      undefined, 'Bearer token-a', 'Bearer token-a', 'Bearer token-b',
    ]);
  });

  it('exercises dashboard, product, sales, accounting, errors, and PDF responses', async () => {
    const pdf = Buffer.from('%PDF-1.7\nsmoke\n', 'utf8');
    const mock = await startMockServer((request) => {
      if (request.path === '/api/mobile/v1/dashboard/stats?ubicacionId=store-1&tipoUbicacion=punto_venta') {
        return { body: { total: 3, pagado: 125.5 } };
      }
      if (request.path === '/api/mobile/v1/products') return { body: { items: [{ id: 'p-1', nombre: 'Café' }] } };
      if (request.path.includes('/products/stock')) return { body: { items: [{ id: 'p-1', nombre: 'Café', stock: 8 }] } };
      if (request.path === '/api/mobile/v1/sales/create') return { body: { sale: { id: 'sale-1', estado: 'activa' } } };
      if (request.path === '/api/mobile/v1/sales/sale-1/update') return { body: { sale: { id: 'sale-1', descuento: 5 } } };
      if (request.path === '/api/mobile/v1/sales/sale-1/cancel') return { body: { sale: { id: 'sale-1', estado: 'cancelada' } } };
      if (request.path.startsWith('/api/mobile/v1/accounting/bank-adjustments')) return { body: { adjustment: { id: 'adj-1' } } };
      if (request.path === '/api/mobile/v1/accounting/bank-transfers/transfer-1/comprobante') {
        return { contentType: 'application/pdf', body: pdf };
      }
      return { status: 422, body: { error: { code: 'validation_error', message: 'Invalid sale' } } };
    });
    const configuration = new Configuration({ basePath: mock.basePath, accessToken: 'token-b' });
    const dashboard = new DashboardApi(configuration);
    const products = new ProductsApi(configuration);
    const sales = new SalesApi(configuration);
    const accounting = new AccountingBankingApi(configuration);

    const stats = await dashboard.mobileGetDashboardStats({ ubicacionId: 'store-1', tipoUbicacion: 'punto_venta' });
    const catalog = await products.mobileGetProducts();
    const stock = await products.mobileGetProductsStock({
      ubicacionId: 'store-1', tipoUbicacion: 'punto_venta', includeZero: 'false',
    });
    await sales.mobilePostSalesCreate({ saleCreateRequest: {
      puntoDeVentaId: 'store-1', descuento: 0,
      items: [{ productoId: 'p-1', cantidad: 2, precioUnitario: 10 }],
    } });
    await sales.mobilePatchSalesByIdUpdate({
      id: 'sale-1', saleUpdateRequest: { descuento: 5, observaciones: 'Cliente frecuente' },
    });
    await sales.mobilePostSalesByIdCancel({
      id: 'sale-1', saleCancelRequest: { motivo: 'Solicitud del cliente' },
    });
    await accounting.mobilePostAccountingBankAdjustments({
      cuentaId: 'bank-1', tipo: 'ingreso', page: 2, limit: 10,
      bankAdjustmentRequest: {
        cuentaId: 'bank-1', tipo: 'ingreso', monto: 100, moneda: 'USD',
        descripcion: 'Ajuste de apertura', motivo: 'Saldo inicial',
      },
    });
    const receipt = await accounting.mobileGetAccountingBankTransfersByIdComprobante({ id: 'transfer-1' });
    let responseError: ResponseError | undefined;
    try {
      await sales.mobileGetSalesById({ id: 'missing' });
    } catch (error) {
      responseError = error as ResponseError;
    }

    expect(stats.total).toBe(3);
    expect(catalog.items[0]?.nombre).toBe('Café');
    expect(stock.items[0]?.stock).toBe(8);
    expect(receipt.type).toBe('application/pdf');
    expect(Buffer.from(await receipt.arrayBuffer())).toEqual(pdf);
    expect(responseError).toBeInstanceOf(ResponseError);
    expect(responseError?.response.status).toBe(422);
    await expect(responseError?.response.json()).resolves.toEqual({
      error: { code: 'validation_error', message: 'Invalid sale' },
    });
    expect(mock.requests.every((request) => request.headers.authorization === 'Bearer token-b')).toBe(true);
    expect(mock.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /api/mobile/v1/dashboard/stats?ubicacionId=store-1&tipoUbicacion=punto_venta',
      'GET /api/mobile/v1/products',
      'GET /api/mobile/v1/products/stock?ubicacionId=store-1&tipoUbicacion=punto_venta&includeZero=false',
      'POST /api/mobile/v1/sales/create',
      'PATCH /api/mobile/v1/sales/sale-1/update',
      'POST /api/mobile/v1/sales/sale-1/cancel',
      'POST /api/mobile/v1/accounting/bank-adjustments?cuentaId=bank-1&tipo=ingreso&page=2&limit=10',
      'GET /api/mobile/v1/accounting/bank-transfers/transfer-1/comprobante',
      'GET /api/mobile/v1/sales/missing',
    ]);
    expect(mock.requests.slice(3, 7).map((request) => request.body)).toEqual([
      { puntoDeVentaId: 'store-1', descuento: 0, items: [{ productoId: 'p-1', cantidad: 2, precioUnitario: 10 }] },
      { observaciones: 'Cliente frecuente', descuento: 5 },
      { motivo: 'Solicitud del cliente' },
      { cuentaId: 'bank-1', tipo: 'ingreso', monto: 100, moneda: 'USD', descripcion: 'Ajuste de apertura', motivo: 'Saldo inicial' },
    ]);
  });
});
