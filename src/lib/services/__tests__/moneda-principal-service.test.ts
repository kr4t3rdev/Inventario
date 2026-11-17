import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  tenantAccountingPolicy: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('resolverMonedaPrincipal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resuelve la moneda principal desde la política contable del tenant', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'USD',
    });
    const { resolverMonedaPrincipal } = await import('../moneda-principal-service');

    const resultado = await resolverMonedaPrincipal('tenant-a');

    expect(resultado).toEqual({ estado: 'CONFIGURADA', moneda: 'USD' });
    expect(prismaMock.tenantAccountingPolicy.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
      select: { functionalCurrencyCode: true },
    });
  });

  it('normaliza la moneda de la política a mayúsculas sin espacios', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: ' cup ',
    });
    const { resolverMonedaPrincipal } = await import('../moneda-principal-service');

    const resultado = await resolverMonedaPrincipal('tenant-a');

    expect(resultado).toEqual({ estado: 'CONFIGURADA', moneda: 'CUP' });
  });

  it('reporta estado ausente cuando el tenant no tiene política', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    const { resolverMonedaPrincipal } = await import('../moneda-principal-service');

    const resultado = await resolverMonedaPrincipal('tenant-a');

    expect(resultado).toEqual({ estado: 'AUSENTE', moneda: null });
  });

  it('reporta estado ausente cuando la política no tiene moneda', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: '   ',
    });
    const { resolverMonedaPrincipal } = await import('../moneda-principal-service');

    const resultado = await resolverMonedaPrincipal('tenant-a');

    expect(resultado).toEqual({ estado: 'AUSENTE', moneda: null });
  });

  it('no presenta CUP como configurado cuando falla la consulta', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockRejectedValue(
      new Error('base de datos no disponible'),
    );
    const { resolverMonedaPrincipal } = await import('../moneda-principal-service');

    const resultado = await resolverMonedaPrincipal('tenant-a');

    expect(resultado).toEqual({ estado: 'ERROR', moneda: null });
  });

  it('no sustituye la moneda de un tenant por la de otro', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-b',
      functionalCurrencyCode: 'EUR',
    });
    const { resolverMonedaPrincipal } = await import('../moneda-principal-service');

    const resultadoB = await resolverMonedaPrincipal('tenant-b');

    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
    });
    const resultadoA = await resolverMonedaPrincipal('tenant-a');

    expect(resultadoB).toEqual({ estado: 'CONFIGURADA', moneda: 'EUR' });
    expect(resultadoA).toEqual({ estado: 'CONFIGURADA', moneda: 'CUP' });
    expect(prismaMock.tenantAccountingPolicy.findUnique).toHaveBeenLastCalledWith({
      where: { tenantId: 'tenant-a' },
      select: { functionalCurrencyCode: true },
    });
  });
});
