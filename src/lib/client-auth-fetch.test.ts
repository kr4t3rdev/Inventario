import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchClientAuthJson } from './client-auth-fetch';

describe('fetchClientAuthJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [{ tenantId: 'tenant-1' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await fetchClientAuthJson<{ items: Array<{ tenantId: string }> }>('/api/auth/tenants');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].tenantId).toBe('tenant-1');
    }
  });

  it('clears stale state on 401 auth failures', async () => {
    const clearState = vi.fn();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Token no proporcionado', code: 'AUTH_REQUIRED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await fetchClientAuthJson('/api/auth/tenants', { clearState });

    expect(result.success).toBe(false);
    expect(clearState).toHaveBeenCalledTimes(1);
    if (!result.success) {
      expect(result.shouldClearState).toBe(true);
      expect(result.error.code).toBe('AUTH_REQUIRED');
    }
  });

  it('clears stale state on version-like conflict codes', async () => {
    const clearState = vi.fn();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Cliente desactualizado', code: 'STALE_CLIENT_VERSION' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await fetchClientAuthJson('/api/auth/tenants', { clearState });

    expect(result.success).toBe(false);
    expect(clearState).toHaveBeenCalledTimes(1);
    if (!result.success) {
      expect(result.shouldClearState).toBe(true);
      expect(result.status).toBe(409);
    }
  });

  it('does not clear state on generic server errors', async () => {
    const clearState = vi.fn();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await fetchClientAuthJson('/api/auth/tenants', { clearState });

    expect(result.success).toBe(false);
    expect(clearState).not.toHaveBeenCalled();
    if (!result.success) {
      expect(result.shouldClearState).toBe(false);
      expect(result.error.message).toBe('Error interno del servidor');
    }
  });
});
