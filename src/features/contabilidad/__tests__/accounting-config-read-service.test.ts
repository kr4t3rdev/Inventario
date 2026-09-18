/**
 * @description Tests para AccountingConfigReadService.
 * Tenant isolation — RED phase: deben fallar hasta que se implemente filtro por tenant.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tipoPago: {
      findMany: vi.fn(),
    },
    cuentaBancaria: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { AccountingConfigReadService } from '@/features/contabilidad/services/accounting-config-read-service';

const mockTipoPagoA = {
  tipoId: 'tp-a',
  nombre: 'Efectivo',
  descripcion: null,
  requiereCuenta: false,
  cuentaDefecto: null,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockCuentaA = {
  cuentaId: 'cb-a',
  tenantId: 'tenant-a',
  nombreBanco: 'Banco A',
  numeroCuenta: '123',
  tipoCuenta: 'AHORROS',
  saldo: 1000,
  moneda: 'CUP',
  isActive: true,
  createdAt: new Date('2024-01-01'),
};

const mockCuentaB = {
  cuentaId: 'cb-b',
  tenantId: 'tenant-b',
  nombreBanco: 'Banco B',
  numeroCuenta: '456',
  tipoCuenta: 'CORRIENTE',
  saldo: 2000,
  moneda: 'USD',
  isActive: true,
  createdAt: new Date('2024-01-01'),
};

describe('AccountingConfigReadService.getPaymentTypes — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('RED: debe filtrar tipos de pago por tenantId', async () => {
    vi.mocked(prisma.tipoPago.findMany).mockResolvedValue([mockTipoPagoA]);

    // El servicio debe aceptar tenantId como parámetro
    const result = await AccountingConfigReadService.getPaymentTypes('tenant-a');

    expect(result.data).toHaveLength(1);

    // ASSERT: El where enviado a Prisma debe incluir tenantId
    const callWhere = vi.mocked(prisma.tipoPago.findMany).mock.calls[0][0]?.where;
    expect(callWhere).toHaveProperty('tenantId');
    // @ts-expect-error TODO: fix type for mock call args
    expect(callWhere.tenantId).toBe('tenant-a');
  });

  it('RED: debe aplicar tenantId junto con filtros adicionales', async () => {
    vi.mocked(prisma.tipoPago.findMany).mockResolvedValue([mockTipoPagoA]);

    await AccountingConfigReadService.getPaymentTypes('tenant-a', { requiereCuenta: true });

    const callWhere = vi.mocked(prisma.tipoPago.findMany).mock.calls[0][0]?.where;
    expect(callWhere).toHaveProperty('tenantId');
    // @ts-expect-error TODO: fix type for mock call args
    expect(callWhere.tenantId).toBe('tenant-a');
    expect(callWhere).toHaveProperty('requiereCuenta');
    // @ts-expect-error TODO: fix type for mock call args
    expect(callWhere.requiereCuenta).toBe(true);
  });
});

describe('AccountingConfigReadService.getAvailableAccounts — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('RED: debe filtrar cuentas bancarias por tenantId', async () => {
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([mockCuentaA]);
    vi.mocked(prisma.cuentaBancaria.findUnique).mockResolvedValue(mockCuentaA);
    vi.mocked(prisma.tipoPago.findMany).mockResolvedValue([]);
    vi.mocked(prisma.cuentaBancaria.groupBy).mockResolvedValue([
      { moneda: 'CUP', _count: { cuentaId: 1 } },
    ]);

    const result = await AccountingConfigReadService.getAvailableAccounts('tenant-a');

    expect(result.cuentas).toHaveLength(1);

    // El findMany de cuentas debe incluir tenantId
    const callWhere = vi.mocked(prisma.cuentaBancaria.findMany).mock.calls[0][0]?.where;
    expect(callWhere).toHaveProperty('tenantId');
    // @ts-expect-error TODO: fix type for mock call args
    expect(callWhere.tenantId).toBe('tenant-a');

    // El groupBy de estadísticas también debe incluir tenantId
    const groupByWhere = vi.mocked(prisma.cuentaBancaria.groupBy).mock.calls[0][0]?.where;
    expect(groupByWhere).toHaveProperty('tenantId');
    // @ts-expect-error TODO: fix type for mock call args
    expect(groupByWhere.tenantId).toBe('tenant-a');
  });

  it('RED: no debe retornar cuentas de otros tenants', async () => {
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([]);
    vi.mocked(prisma.tipoPago.findMany).mockResolvedValue([]);
    vi.mocked(prisma.cuentaBancaria.groupBy).mockResolvedValue([]);
    
    const result = await AccountingConfigReadService.getAvailableAccounts('tenant-a');
    
    // Verificar que el filtro incluye tenantId
    expect(vi.mocked(prisma.cuentaBancaria.findMany).mock.calls[0][0]?.where).toHaveProperty('tenantId');
    // tenant-a no tiene cuentas, debería retornar vacío
    expect(result.cuentas).toHaveLength(0);
  });

  it('RED: las estadísticas deben reflejar solo el tenant consultado', async () => {
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([mockCuentaA]);
    vi.mocked(prisma.cuentaBancaria.findUnique).mockResolvedValue(mockCuentaA);
    vi.mocked(prisma.tipoPago.findMany).mockResolvedValue([]);
    vi.mocked(prisma.cuentaBancaria.groupBy).mockResolvedValue([
      { moneda: 'CUP', _count: { cuentaId: 1 } },
    ]);

    await AccountingConfigReadService.getAvailableAccounts('tenant-a');

    // Verificar que groupBy incluya tenantId
    const groupByCalls = vi.mocked(prisma.cuentaBancaria.groupBy).mock.calls;
    for (const call of groupByCalls) {
      expect(call[0]?.where).toHaveProperty('tenantId');
    }
  });
});
