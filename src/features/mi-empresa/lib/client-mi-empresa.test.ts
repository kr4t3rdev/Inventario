import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchMiEmpresaSettings,
  updateMiEmpresaSettings,
} from './client-mi-empresa';

describe('client mi empresa transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads mi empresa settings from the stable route payload', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ nombre: 'Mi Empresa', usaCodigoEan13: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await fetchMiEmpresaSettings();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ nombre: 'Mi Empresa', usaCodigoEan13: true });
    }
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/mi-empresa',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('clears stale browser state on forbidden mi empresa reads', async () => {
    const clearState = vi.fn();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'No autorizado', code: 'FORBIDDEN' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await fetchMiEmpresaSettings(clearState);

    expect(result.success).toBe(false);
    expect(result.shouldClearState).toBe(true);
    expect(clearState).toHaveBeenCalledTimes(1);
  });

  it('updates mi empresa through a stable PUT route', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        data: { nombre: 'Mi Empresa', usaCodigoEan13: false },
        message: 'Mi Empresa updated',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await updateMiEmpresaSettings({ nombre: 'Mi Empresa', usaCodigoEan13: false });

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/mi-empresa',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nombre: 'Mi Empresa', usaCodigoEan13: false }),
      }),
    );
  });
});
