import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/errors/route';

/**
 * @description Construye una petición POST con el reporte de error y la IP
 * de origen, para poder probar el rate limit de forma aislada.
 * @param {unknown} body - Cuerpo del reporte.
 * @param {string} ip - IP de origen simulada.
 * @returns {Request} Petición lista para el handler.
 */
function buildRequest(body: unknown, ip: string): Request {
  return new Request('http://localhost/api/errors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/errors', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('registra el error en el log del servidor y responde 204', async () => {
    const response = await POST(
      buildRequest(
        {
          message: 'Fallo de render',
          digest: 'abc123',
          path: '/busy/inventario/ajustes',
          userAgent: 'Mozilla/5.0',
        },
        '10.0.0.1',
      ),
    );

    expect(response.status).toBe(204);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[client-error]',
      expect.objectContaining({
        message: 'Fallo de render',
        digest: 'abc123',
        path: '/busy/inventario/ajustes',
        ip: '10.0.0.1',
        origen: 'client',
      }),
    );
  });

  it('acepta un reporte sin campos opcionales', async () => {
    const response = await POST(buildRequest({ message: 'Fallo mínimo' }, '10.0.0.2'));

    expect(response.status).toBe(204);
  });

  it('rechaza un payload sin mensaje', async () => {
    const response = await POST(buildRequest({ digest: 'abc123' }, '10.0.0.3'));

    expect(response.status).toBe(400);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('rechaza un mensaje demasiado largo', async () => {
    const response = await POST(
      buildRequest({ message: 'x'.repeat(501) }, '10.0.0.4'),
    );

    expect(response.status).toBe(400);
  });

  it('rechaza un cuerpo que no es JSON válido', async () => {
    const response = await POST(buildRequest('{no-json', '10.0.0.5'));

    expect(response.status).toBe(400);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('aplica rate limit por IP y responde 429 al superar elCupo', async () => {
    const ip = '10.0.0.99';

    for (let i = 0; i < 10; i += 1) {
      const response = await POST(buildRequest({ message: `Fallo ${i}` }, ip));
      expect(response.status).toBe(204);
    }

    const response = await POST(buildRequest({ message: 'Fallo excedido' }, ip));

    expect(response.status).toBe(429);
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      '[client-error]',
      expect.objectContaining({ message: 'Fallo excedido' }),
    );
  });

  it('mantiene el rate limit aislado por IP', async () => {
    const response = await POST(buildRequest({ message: 'Otra IP' }, '10.0.0.100'));

    expect(response.status).toBe(204);
  });
});
