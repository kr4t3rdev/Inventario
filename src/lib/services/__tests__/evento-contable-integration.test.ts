import { beforeEach, describe, expect, it, vi } from 'vitest';

const eventoContableCreateMock = vi.fn();

const prismaMock = vi.hoisted(() => ({
  default: {
    eventoContable: undefined as unknown,
  },
}));

vi.mock('@/lib/prisma', () => prismaMock);

import { registrarEventoContable } from '@/lib/services/evento-contable-integration';

describe('evento-contable-integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams = {
    origenTipo: 'VENTA' as const,
    origenId: 'venta-1',
    monto: 1000,
    moneda: 'CUP',
    fechaOperacion: new Date('2026-04-23'),
    descripcion: 'Test venta',
    usuarioId: 'user-1',
  };

  it('retorna false y no lanza si modelo EventoContable no existe', async () => {
    (prismaMock as unknown as Record<string, unknown>).default = {} as Record<string, unknown>;

    const result = await registrarEventoContable(baseParams);
    expect(result).toBe(false);
  });

  it('retorna false y no lanza si eventoContable.create no es función', async () => {
    (prismaMock as unknown as Record<string, unknown>).default = {
      eventoContable: { create: undefined },
    } as Record<string, unknown>;

    const result = await registrarEventoContable(baseParams);
    expect(result).toBe(false);
  });

  it('retorna true y persiste evento con líneas si modelo existe', async () => {
    eventoContableCreateMock.mockResolvedValue({ eventoId: 'ev-1' });
    (prismaMock as unknown as Record<string, unknown>).default = {
      eventoContable: { create: eventoContableCreateMock },
    } as Record<string, unknown>;

    const result = await registrarEventoContable(baseParams);

    expect(result).toBe(true);
    expect(eventoContableCreateMock).toHaveBeenCalledTimes(1);

    const callArg = eventoContableCreateMock.mock.calls[0][0];
    expect(callArg.data.lineas.create).toBeDefined();
    expect(callArg.data.lineas.create.length).toBeGreaterThan(0);
  });

  it('retorna false si create lanza un error', async () => {
    eventoContableCreateMock.mockRejectedValue(new Error('DB error'));
    (prismaMock as unknown as Record<string, unknown>).default = {
      eventoContable: { create: eventoContableCreateMock },
    } as Record<string, unknown>;

    const result = await registrarEventoContable(baseParams);
    expect(result).toBe(false);
  });

  it('genera líneas de doble partida con cuenta contra', async () => {
    eventoContableCreateMock.mockResolvedValue({ eventoId: 'ev-2' });
    (prismaMock as unknown as Record<string, unknown>).default = {
      eventoContable: { create: eventoContableCreateMock },
    } as Record<string, unknown>;

    await registrarEventoContable(baseParams);

    const callArg = eventoContableCreateMock.mock.calls[0][0];
    const lineas = callArg.data.lineas.create;
    expect(lineas).toHaveLength(2);

    const debitoTotal = lineas.reduce((s: number, l: { debito: number }) => s + l.debito, 0);
    const creditoTotal = lineas.reduce((s: number, l: { credito: number }) => s + l.credito, 0);
    expect(Math.abs(debitoTotal - creditoTotal)).toBeLessThanOrEqual(0.01);
  });
});