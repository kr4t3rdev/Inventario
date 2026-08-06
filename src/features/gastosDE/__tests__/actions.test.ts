import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { gastosDE: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }, gastoElemento: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }, gastoConcepto: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() } } }));
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getGastosDEAction, createGastosDEAction, deleteGastosDEAction, updateGastosDEAction, getGastoConceptosAction, createGastoConceptoAction, getGastoElementosAction, createGastoElementoAction } from '@/features/gastosDE/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
const u: AuthenticatedUser = { userId: 'u1', name: 'T', email: 't@t.com', role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'admin' };
const featureBlockedUser: AuthenticatedUser = {
  userId: 'u2',
  name: 'Feature Blocked',
  email: 'blocked@t.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 't1',
  tenantRole: 'economico',
  planFeatures: { gastos: false },
};
describe('GastosDE Actions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lista', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.gastosDE.findMany).mockResolvedValue([]); const r=await getGastosDEAction(); expect(r.success).toBe(true); });

  it('lista ordena por createdAt desc (no por monto)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.gastosDE.findMany).mockResolvedValue([]);
    await getGastosDEAction();
    expect(vi.mocked(prisma.gastosDE.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
  });

  it('crea', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.gastosDE.create).mockResolvedValue({gastosDEId:'g1'}as any); const r=await createGastosDEAction({proveedor:'P1',monto:5000,descripcion:'Test'}); expect(r.success).toBe(true); });
  it('elimina', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue({gastosDEId:'g1'}); vi.mocked(prisma.gastosDE.delete).mockResolvedValue({}as any); const r=await deleteGastosDEAction('g1'); expect(r.success).toBe(true); });

  describe('updateGastosDEAction', () => {
    const existing = { gastosDEId: 'g1', tenantId: 't1', tipo: null, conceptoId: null, elementoId: null, periodo: '2026-01', proveedor: 'P', monto: 100, descripcion: 'D' };

    it('persiste tipo cuando viene en el payload', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(u);
      vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue(existing as any);
      vi.mocked(prisma.gastosDE.update).mockResolvedValue({} as any);
      await updateGastosDEAction({ gastosDEId: 'g1', tipo: 'Tipo nuevo' });
      expect(vi.mocked(prisma.gastosDE.update)).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tipo: 'Tipo nuevo' }) })
      );
    });

    it('persiste conceptoId cuando viene en el payload', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(u);
      vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue(existing as any);
      vi.mocked(prisma.gastoConcepto.findFirst).mockResolvedValue({ conceptoId: 'c-1', tenantId: 't1', nombre: 'Arrendamiento' } as any);
      vi.mocked(prisma.gastosDE.update).mockResolvedValue({} as any);
      await updateGastosDEAction({ gastosDEId: 'g1', conceptoId: 'c-1' });
      expect(vi.mocked(prisma.gastosDE.update)).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ conceptoId: 'c-1' }) })
      );
    });

    it('persiste elementoId cuando viene en el payload', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(u);
      vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue(existing as any);
      vi.mocked(prisma.gastoElemento.findFirst).mockResolvedValue({ elementoId: 'e-1', tenantId: 't1', conceptoId: 'c-1' } as any);
      vi.mocked(prisma.gastosDE.update).mockResolvedValue({} as any);
      await updateGastosDEAction({ gastosDEId: 'g1', elementoId: 'e-1' });
      expect(vi.mocked(prisma.gastosDE.update)).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ elementoId: 'e-1' }) })
      );
    });

    it('persiste periodo cuando viene en el payload', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(u);
      vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue(existing as any);
      vi.mocked(prisma.gastosDE.update).mockResolvedValue({} as any);
      await updateGastosDEAction({ gastosDEId: 'g1', periodo: '2026-06' });
      expect(vi.mocked(prisma.gastosDE.update)).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ periodo: '2026-06' }) })
      );
    });

    it('rechaza update con conceptoId + elementoId que no se relacionan', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(u);
      vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue(existing as any);
      vi.mocked(prisma.gastoConcepto.findFirst).mockResolvedValue({ conceptoId: 'c-1', tenantId: 't1', nombre: 'Arrendamiento' } as any);
      vi.mocked(prisma.gastoElemento.findFirst).mockResolvedValue(null);
      const r = await updateGastosDEAction({ gastosDEId: 'g1', conceptoId: 'c-1', elementoId: 'e-from-c2' });
      expect(r.success).toBe(false);
      expect(r.error?.code).toBe('VALIDATION_ERROR');
      expect(vi.mocked(prisma.gastosDE.update)).not.toHaveBeenCalled();
    });

    it('rechaza update con concepto de otro tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(u);
      vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue(existing as any);
      vi.mocked(prisma.gastoConcepto.findFirst).mockResolvedValue(null);
      const r = await updateGastosDEAction({ gastosDEId: 'g1', conceptoId: 'c-de-otro-tenant' });
      expect(r.success).toBe(false);
      expect(r.error?.code).toBe('VALIDATION_ERROR');
      expect(vi.mocked(prisma.gastosDE.update)).not.toHaveBeenCalled();
    });

    it('rechaza update con elemento de otro tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(u);
      vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue(existing as any);
      vi.mocked(prisma.gastoElemento.findFirst).mockResolvedValue(null);
      const r = await updateGastosDEAction({ gastosDEId: 'g1', elementoId: 'e-de-otro-tenant' });
      expect(r.success).toBe(false);
      expect(r.error?.code).toBe('VALIDATION_ERROR');
      expect(vi.mocked(prisma.gastosDE.update)).not.toHaveBeenCalled();
    });

    it('rechaza update cross-tenant con NOT_FOUND', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(u);
      vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue(null);
      const r = await updateGastosDEAction({ gastosDEId: 'g-otro-tenant', monto: 100 });
      expect(r.success).toBe(false);
      expect(r.error?.code).toBe('NOT_FOUND');
      expect(vi.mocked(prisma.gastosDE.update)).not.toHaveBeenCalled();
    });

    it('update parcial con solo monto no toca otros campos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(u);
      vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue(existing as any);
      vi.mocked(prisma.gastosDE.update).mockResolvedValue({} as any);
      await updateGastosDEAction({ gastosDEId: 'g1', monto: 2000 });
      const dataArg = vi.mocked(prisma.gastosDE.update).mock.calls[0][0].data;
      expect(dataArg).toEqual({ monto: 2000 });
      expect(dataArg).not.toHaveProperty('proveedor');
      expect(dataArg).not.toHaveProperty('descripcion');
    });
  });

  it('rechaza delete cross-tenant con NOT_FOUND', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue(null);
    const r = await deleteGastosDEAction('g-otro-tenant');
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('NOT_FOUND');
    expect(vi.mocked(prisma.gastosDE.delete)).not.toHaveBeenCalled();
  });

  it('bloquea acceso cuando el plan no incluye gastos', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(featureBlockedUser);

    const r = await getGastosDEAction();

    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(vi.mocked(prisma.gastosDE.findMany)).not.toHaveBeenCalled();
  });
});

describe('GastosDE Conceptos/Elementos - aislamiento por tenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getGastoConceptosAction filtra por tenantId', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.gastoConcepto.findMany).mockResolvedValue([]);
    await getGastoConceptosAction({});
    expect(prisma.gastoConcepto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1' }) })
    );
  });

  it('createGastoConceptoAction asigna tenantId y valida duplicado por tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.gastoConcepto.findFirst).mockResolvedValue({ conceptoId: 'c-1', tenantId: 't1', nombre: 'Arrendamiento' } as any);
    const r = await createGastoConceptoAction({ nombre: 'Arrendamiento' });
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('DUPLICATE');
    expect(prisma.gastoConcepto.create).not.toHaveBeenCalled();
  });

  it('createGastoConceptoAction crea con tenantId', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.gastoConcepto.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.gastoConcepto.create).mockResolvedValue({ conceptoId: 'c-nuevo' } as any);
    const r = await createGastoConceptoAction({ nombre: 'Marketing' });
    expect(r.success).toBe(true);
    expect(prisma.gastoConcepto.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', nombre: 'Marketing' }) })
    );
  });

  it('getGastoElementosAction filtra por conceptoId y tenantId', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.gastoElemento.findMany).mockResolvedValue([]);
    await getGastoElementosAction('c-1');
    expect(prisma.gastoElemento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ conceptoId: 'c-1', tenantId: 't1' }) })
    );
  });

  it('createGastoElementoAction rechaza concepto de otro tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.gastoConcepto.findFirst).mockResolvedValue(null);
    const r = await createGastoElementoAction({ conceptoId: 'c-de-otro-tenant', nombre: 'Extra' });
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('NOT_FOUND');
    expect(prisma.gastoElemento.create).not.toHaveBeenCalled();
  });

  it('createGastoElementoAction crea con tenantId', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.gastoConcepto.findFirst).mockResolvedValue({ conceptoId: 'c-1', tenantId: 't1' } as any);
    vi.mocked(prisma.gastoElemento.create).mockResolvedValue({ elementoId: 'e-nuevo' } as any);
    const r = await createGastoElementoAction({ conceptoId: 'c-1', nombre: 'Local' });
    expect(r.success).toBe(true);
    expect(prisma.gastoElemento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', conceptoId: 'c-1' }) })
    );
  });

  it('createGastosDEAction rechaza concepto de otro tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.gastoConcepto.findFirst).mockResolvedValue(null);
    const r = await createGastosDEAction({ proveedor: 'P', monto: 100, descripcion: 'D', conceptoId: 'c-de-otro-tenant' });
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('VALIDATION_ERROR');
    expect(prisma.gastosDE.create).not.toHaveBeenCalled();
  });

  it('createGastosDEAction rechaza elemento de otro tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.gastoElemento.findFirst).mockResolvedValue(null);
    const r = await createGastosDEAction({ proveedor: 'P', monto: 100, descripcion: 'D', elementoId: 'e-de-otro-tenant' });
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('VALIDATION_ERROR');
    expect(prisma.gastosDE.create).not.toHaveBeenCalled();
  });
});
