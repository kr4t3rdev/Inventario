/**
 * @description Tests del generador de numeración de ofertas con reintento ante P2002 (E-1).
 * @param {void} No aplica - suite de tests
 * @returns {void} Aserciones vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    oferta: { findFirst: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  generarProximoNumeroOferta,
  formatearNumeroOferta,
  crearOfertaConNumero,
} from '@/features/ofertas/lib/numero-oferta-generator';

const p2002 = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

describe('E-1 numeración de ofertas por tenant con reintento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consulta el último número scoped por tenant en orden descendente', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(null as never);
    await generarProximoNumeroOferta('tenant-A');
    expect(prisma.oferta.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-A' },
      orderBy: { numeroOferta: 'desc' },
      select: { numeroOferta: true },
    });
  });

  it('devuelve 1 cuando el tenant no tiene ofertas', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(null as never);
    expect(await generarProximoNumeroOferta('tenant-A')).toBe(1);
  });

  it('continúa la secuencia del último número existente', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ numeroOferta: 'OF-000007' } as never);
    expect(await generarProximoNumeroOferta('tenant-A')).toBe(8);
  });

  it('formatea con prefijo OF y seis dígitos', () => {
    expect(formatearNumeroOferta(1)).toBe('OF-000001');
    expect(formatearNumeroOferta(42)).toBe('OF-000042');
    expect(formatearNumeroOferta(1234567)).toBe('OF-1234567');
  });

  it('crea la oferta con el número formateado en el primer intento', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ numeroOferta: 'OF-000005' } as never);
    const create = vi.fn().mockResolvedValue({ id: 'of-1', numeroOferta: 'OF-000006' });
    const buildData = vi.fn((numeroOferta: string) => ({ numeroOferta }));

    const result = await crearOfertaConNumero({ tenantId: 'tenant-A', buildData, create });

    expect(buildData).toHaveBeenCalledWith('OF-000006');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ numeroOferta: 'OF-000006' });
    expect(result).toEqual({ id: 'of-1', numeroOferta: 'OF-000006' });
  });

  it('reintenta ante colisión P2002 y resuelve con otro número', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ numeroOferta: 'OF-000005' } as never);
    const create = vi.fn()
      .mockRejectedValueOnce(p2002())
      .mockResolvedValueOnce({ id: 'of-2', numeroOferta: 'OF-000007' });

    const result = await crearOfertaConNumero({
      tenantId: 'tenant-A',
      buildData: (numeroOferta: string) => ({ numeroOferta }),
      create,
    });

    expect(result.id).toBe('of-2');
    expect(create).toHaveBeenCalledTimes(2);
    expect(prisma.oferta.findFirst).toHaveBeenCalledTimes(2);
  });

  it('lanza el último P2002 tras agotar los 3 intentos', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ numeroOferta: 'OF-000001' } as never);
    const create = vi.fn().mockRejectedValue(p2002());

    await expect(
      crearOfertaConNumero({
        tenantId: 'tenant-A',
        buildData: (numeroOferta: string) => ({ numeroOferta }),
        create,
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('propaga errores no-P2002 sin reintentar', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(null as never);
    const errorOtros = Object.assign(new Error('Cable roto'), { code: 'P1001' });
    const create = vi.fn().mockRejectedValue(errorOtros);

    await expect(
      crearOfertaConNumero({
        tenantId: 'tenant-A',
        buildData: (numeroOferta: string) => ({ numeroOferta }),
        create,
      }),
    ).rejects.toMatchObject({ code: 'P1001' });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
