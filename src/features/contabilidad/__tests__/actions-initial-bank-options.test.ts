import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: {
    userId: 'user-a', tenantId: 'tenant-a', tenantRole: 'manager', role: 'user',
    isActive: true, name: 'Manager', email: 'manager@example.com',
    permissions: new Set(['financiero.apertura.aprobar']),
    planFeatures: { contabilidad: true, 'multi-moneda': true } as Record<string, boolean>,
  },
  prisma: { cuentaRolTenant: { findMany: vi.fn() }, moneda: { findMany: vi.fn() } },
  policy: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: state.prisma }));
vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => ({
  getRequiredTenantAccountingPolicy: state.policy,
}));
vi.mock('@/lib/server-actions', () => ({
  withAction: (callback: (input: unknown, user: typeof state.user) => Promise<unknown>) =>
    async (input: unknown) => {
      try { return { success: true, data: await callback(input, state.user) }; }
      catch (error) { return { success: false, error }; }
    },
}));

describe('getInitialBankOptionsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user.tenantId = 'tenant-a';
    state.user.permissions = new Set(['financiero.apertura.aprobar']);
    state.user.planFeatures = { contabilidad: true, 'multi-moneda': true };
    state.policy.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
    state.prisma.cuentaRolTenant.findMany.mockResolvedValue([
      { rol: 'BANCOS', cuenta: { cuentaContableId: 'bank-a', codigo: '102', nombre: 'Banco' } },
    ]);
    state.prisma.moneda.findMany.mockResolvedValue([
      { codigo: 'CUP', nombre: 'Peso cubano' }, { codigo: 'USD', nombre: 'Dólar' },
    ]);
  });

  it('devuelve solo roles activos de tesorería del tenant y monedas activas', async () => {
    const { getInitialBankOptionsAction } = await import('../actions-initial-bank-options');
    const result = await getInitialBankOptionsAction({});
    expect(result).toEqual({ success: true, data: {
      roles: [{ rol: 'BANCOS', cuentaContableId: 'bank-a', codigo: '102', nombre: 'Banco' }],
      monedas: [{ codigo: 'CUP', nombre: 'Peso cubano' }, { codigo: 'USD', nombre: 'Dólar' }],
      monedaFuncional: 'CUP', multiMoneda: true,
    } });
    expect(state.prisma.cuentaRolTenant.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-a', cuenta: expect.objectContaining({ activa: true, aceptaMovimiento: true, tipo: 'ACTIVO' }) }),
    }));
    expect(state.prisma.moneda.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
  });

  it('limita la consulta a moneda funcional si el plan no permite multimoneda', async () => {
    state.user.planFeatures = { contabilidad: true };
    state.prisma.moneda.findMany.mockResolvedValue([{ codigo: 'CUP', nombre: 'Peso cubano' }]);
    const { getInitialBankOptionsAction } = await import('../actions-initial-bank-options');
    const result = await getInitialBankOptionsAction({});
    expect(result.success).toBe(true);
    expect(state.prisma.moneda.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true, codigo: 'CUP' } }));
  });

  it('permite solicitar sin permiso de aprobación y exige la función contable', async () => {
    const { getInitialBankOptionsAction } = await import('../actions-initial-bank-options');
    state.user.permissions = new Set();
    expect((await getInitialBankOptionsAction({})).success).toBe(true);
    vi.clearAllMocks();
    state.user.planFeatures = {};
    expect((await getInitialBankOptionsAction({})).success).toBe(false);
    expect(state.policy).not.toHaveBeenCalled();
    expect(state.prisma.cuentaRolTenant.findMany).not.toHaveBeenCalled();
  });

  it('rechaza si falta tenant o política, sin consultar roles', async () => {
    const { getInitialBankOptionsAction } = await import('../actions-initial-bank-options');
    state.user.tenantId = '';
    expect((await getInitialBankOptionsAction({})).success).toBe(false);
    state.user.tenantId = 'tenant-a';
    state.policy.mockRejectedValue(new Error('Política no disponible'));
    expect((await getInitialBankOptionsAction({})).success).toBe(false);
    expect(state.prisma.cuentaRolTenant.findMany).not.toHaveBeenCalled();
  });
});
