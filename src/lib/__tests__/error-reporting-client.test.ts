import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportClientError } from '@/lib/error-reporting-client';

describe('reportClientError', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía el reporte al endpoint interno de errores', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = await reportClientError({
      message: 'Fallo de render',
      digest: 'abc123',
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/errors',
      expect.objectContaining({ method: 'POST' }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual(
      expect.objectContaining({ message: 'Fallo de render', digest: 'abc123' }),
    );
  });

  it('devuelve false sin lanzar cuando la red falla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    await expect(reportClientError({ message: 'Fallo' })).resolves.toBe(false);
  });

  it('devuelve false cuando el servidor rechaza el reporte', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(reportClientError({ message: 'Fallo' })).resolves.toBe(false);
  });
});
