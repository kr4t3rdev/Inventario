import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCuentasBancarias } from './use-cuentas-bancarias';

describe('useCuentasBancarias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads cuentas from the stable route payload', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        cuentas: [
          { cuentaId: 'c1', nombreBanco: 'Banco 1', numeroCuenta: '123', moneda: 'CUP', saldo: 10, isActive: true },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ) as typeof fetch;

    const { result } = renderHook(() => useCuentasBancarias());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cuentas).toHaveLength(1);
    expect(result.current.cuentas[0].cuentaId).toBe('c1');
    expect(result.current.error).toBeUndefined();
  });

  it('clears cuentas on auth failures to avoid stale tenant data', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'No autorizado', code: 'FORBIDDEN' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const { result } = renderHook(() => useCuentasBancarias());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cuentas).toEqual([]);
    expect(result.current.error).toMatchObject({ code: 'FORBIDDEN' });
  });
});
