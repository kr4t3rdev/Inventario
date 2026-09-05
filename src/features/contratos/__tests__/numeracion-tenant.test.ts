/**
 * @description Tests de numeración de contratos por tenant (CU-02).
 * @param {void} No aplica - suite de tests
 * @returns {void} Aserciones vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findFirst: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  generarProximoConsecutivo,
  formatearNumeroContrato,
  validarFormatoNumeroContrato,
  derivarPrefijoCustom,
  crearContratoConConsecutivo,
} from '@/features/contratos/lib/numeroContratoGenerator';

describe('CU-02 numeración de contratos por tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filtra el consecutivo por tenant y tipo', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    await generarProximoConsecutivo('tenant-A', 'COMPRA_VENTA');
    expect(prisma.contrato.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-A', tipo: 'COMPRA_VENTA' },
      orderBy: { numeroConsecutivo: 'desc' },
      select: { numeroConsecutivo: true },
    });
  });

  it('dos tenants obtienen consecutivos independientes', async () => {
    vi.mocked(prisma.contrato.findFirst)
      .mockResolvedValueOnce({ numeroConsecutivo: 3 } as never)
      .mockResolvedValueOnce({ numeroConsecutivo: 10 } as never);
    const a = await generarProximoConsecutivo('tenant-A', 'SERVICIO');
    const b = await generarProximoConsecutivo('tenant-B', 'SERVICIO');
    expect(a).toBe(4);
    expect(b).toBe(11);
  });

  it('reintenta ante colisión P2002 en creaciones concurrentes', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ numeroConsecutivo: 5 } as never);
    const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
    const create = vi.fn()
      .mockRejectedValueOnce(p2002)
      .mockResolvedValueOnce({ contratoId: 'ct-1', numeroConsecutivo: 7 });
    const result = await crearContratoConConsecutivo({
      tenantId: 'tenant-A',
      tipo: 'COMPRA_VENTA',
      buildData: (consecutivo, numero) => ({ numeroConsecutivo: consecutivo, numeroContrato: numero }),
      create,
    });
    expect(result.contratoId).toBe('ct-1');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('lanza tras 3 colisiones consecutivas', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ numeroConsecutivo: 1 } as never);
    const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
    const create = vi.fn().mockRejectedValue(p2002);
    await expect(
      crearContratoConConsecutivo({
        tenantId: 'tenant-A',
        tipo: 'COMPRA_VENTA',
        buildData: (c, n) => ({ numeroConsecutivo: c, numeroContrato: n }),
        create,
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('deriva prefijos custom de forma determinista con fallback CUS', () => {
    expect(derivarPrefijoCustom('Mantenimiento')).toBe('MAN');
    expect(derivarPrefijoCustom('Servicios técnicos')).toBe('SER');
    expect(derivarPrefijoCustom('Áé')).toBe('CUS');
    expect(formatearNumeroContrato('Mantenimiento', 1)).toBe('MAN-0001');
    expect(validarFormatoNumeroContrato('MAN-0001')).toBe(true);
    expect(validarFormatoNumeroContrato('CV-0001')).toBe(true);
    expect(validarFormatoNumeroContrato('XX-0001')).toBe(false);
  });
});
