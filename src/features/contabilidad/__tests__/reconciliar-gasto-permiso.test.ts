/**
 * @description Gate de permiso de la fila 24: `reconciliarGastoAction` y el adapter
 * `reconciliarGastoAdapter` (canal web/mobile) exigen
 * `financiero.contabilidad.acceder` antes de ejecutar el workflow de pago de gastos.
 * Un dependiente sin el permiso se deniega con 403 `FORBIDDEN` antes de tocar CxP.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  auditLog: { create: vi.fn() },
  gastosDE: { findFirst: vi.fn().mockResolvedValue({ gastosDEId: 'gde-1' }) },
  pagosalario: { findFirst: vi.fn().mockResolvedValue(null) },
  gastoCompra: { findFirst: vi.fn().mockResolvedValue(null) },
  reconciliacionGasto: { findFirst: vi.fn().mockResolvedValue(null) },
  cuentaBancaria: {
    findFirst: vi.fn().mockResolvedValue({ cuentaId: 'cb-1', saldo: 1000, isActive: true }),
    findMany: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

const getCurrentUserMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: getCurrentUserMock,
}));

const workflowMock = vi.hoisted(() => ({
  applyPagoGastoWorkflow: vi.fn(),
  isGastoWorkflowError: vi.fn(() => false),
}));

vi.mock('@/lib/services/pago-gastos-workflow', () => ({
  applyPagoGastoWorkflow: workflowMock.applyPagoGastoWorkflow,
  isGastoWorkflowError: workflowMock.isGastoWorkflowError,
}));

vi.mock('@/lib/services/periodo-contable-guard', () => ({
  PeriodoGuard: vi.fn().mockImplementation(() => ({
    verificarEscritura: vi.fn().mockResolvedValue({
      permitido: true,
      error: null,
      codigo: null,
    }),
  })),
  getGuardConfigExtended: vi.fn().mockReturnValue({
    mode: 'enforce',
    enabled: true,
    auditLogPath: null,
    bypassSuperAdmin: false,
    bypassRoles: [],
  }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { reconciliarGastoAction } from '@/features/contabilidad/actions-reconciliacion';
import { reconciliarGastoAdapter } from '@/features/contabilidad/api/reconciliacion-gastos-adapter';

const dependiente = {
  userId: 'user-dep',
  tenantId: 'tenant-1',
  name: 'Dependiente',
  email: 'dep@test.com',
  role: 'regularUser' as const,
  tenantRole: 'dependiente' as const,
  planFeatures: { contabilidad: true },
  isActive: true,
};

describe('fila 24 — permiso contable en pago de gastos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue(dependiente);
    workflowMock.applyPagoGastoWorkflow.mockResolvedValue({ reconciliaciones: [] });
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ $executeRaw: vi.fn() }));
  });

  it('la action deniega un dependiente sin permiso antes del workflow', async () => {
    const result = await reconciliarGastoAction({
      gastosDEId: 'gde-1',
      cuentaId: 'cb-1',
      tipoPagoId: 'tp-1',
      monto: 100,
    });
    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('FORBIDDEN');
    expect(workflowMock.applyPagoGastoWorkflow).not.toHaveBeenCalled();
  });

  it('el adapter deniega un dependiente sin permiso antes de tocar CxP', async () => {
    await expect(reconciliarGastoAdapter({
      tipoGasto: 'gastoDE',
      gastosDEId: 'gde-1',
      referenciaId: 'gde-1',
      cuentaId: 'cb-1',
      tipoPagoId: 'tp-1',
      monto: 100,
      descripcion: 'Pago gasto',
    }, dependiente as never)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
