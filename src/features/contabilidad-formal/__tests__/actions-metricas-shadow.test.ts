import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: queryMock } }));

const usuarioBase = {
  userId: 'u-a', tenantId: 'tenant-a', tenantRole: 'manager', role: 'user',
  isActive: true, name: 'Gestor', email: 'gestor@example.com',
  planFeatures: { 'contabilidad-formal': true },
};
let usuarioActual: typeof usuarioBase = usuarioBase;

vi.mock('@/lib/server-actions', () => ({
  withAction: (callback: (input: unknown, user: typeof usuarioBase) => Promise<unknown>) =>
    (input?: unknown) => callback(input, usuarioActual)
      .then((data) => ({ success: true, data }))
      .catch((error: { code?: string }) => ({ success: false, error: { code: error.code } })),
}));

describe('consulta autenticada de métricas shadow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usuarioActual = usuarioBase;
    queryMock.mockImplementation(async (strings: TemplateStringsArray, tenantId: string) => {
      expect(strings.join('?')).toContain('WHERE "tenantId" = ?');
      return tenantId === 'tenant-a'
        ? [{ tipoEvento: 'VENTA_CONTADO', estado: 'SIMULADO', causa: null,
          cantidad: 1, latenciaP95Ms: 12 }]
        : [];
    });
  });

  it('A jamás lee B, ignora tenantId suministrado y cuenta solo evidencia confirmada idempotente', async () => {
    const { getMetricasShadowAction } = await import('@/features/contabilidad-formal/actions-metricas-shadow');
    const respuesta = await getMetricasShadowAction({ tenantId: 'tenant-b' } as never);
    expect(respuesta).toEqual({ success: true, data: [{
      tipoEvento: 'VENTA_CONTADO', estado: 'SIMULADO', causa: null,
      cantidad: 1, latenciaP95Ms: 12,
    }] });
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][1]).toBe('tenant-a');
  });

  it('bloquea la consulta sin licencia', async () => {
    usuarioActual = { ...usuarioBase, planFeatures: { 'contabilidad-formal': false } };
    const { getMetricasShadowAction } = await import('@/features/contabilidad-formal/actions-metricas-shadow');
    const r1 = await getMetricasShadowAction();
    expect(r1.success).toBe(false);
    if (r1.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(r1.error?.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('bloquea rol insuficiente aun con feature y tenant', async () => {
    usuarioActual = { ...usuarioBase, tenantRole: 'dependiente' };
    const { getMetricasShadowAction } = await import('@/features/contabilidad-formal/actions-metricas-shadow');
    const r2 = await getMetricasShadowAction();
    expect(r2.success).toBe(false);
    if (r2.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(r2.error?.code).toBe('FORBIDDEN');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rechaza ausencia de tenant antes de consultar', async () => {
    usuarioActual = { ...usuarioBase, tenantId: '' };
    const { getMetricasShadowAction } = await import('@/features/contabilidad-formal/actions-metricas-shadow');
    expect((await getMetricasShadowAction()).success).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
