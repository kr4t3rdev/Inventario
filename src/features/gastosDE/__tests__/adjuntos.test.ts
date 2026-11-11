/**
 * @description Tests F-4: adjuntos de comprobante en gastos (CloudinaryAsset
 * con ownerType 'gastoDE' y slot 'comprobante').
 *
 * Contrato del spec gastos-recurrentes-adjuntos:
 * - Registrar exige gasto del tenant y delega en recordOwnerAsset.
 * - Listar devuelve solo adjuntos activos ordenados por posición.
 * - Eliminar es soft-delete (status 'deleted' + deletedAt).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/upload/cloudinary-admin', () => ({
  recordOwnerAsset: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    gastosDE: { findFirst: vi.fn() },
    cloudinaryAsset: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { recordOwnerAsset } from '@/lib/upload/cloudinary-admin';
import {
  getAdjuntosGastoAction,
  registrarAdjuntoGastoAction,
  removeAdjuntoGastoAction,
} from '../adjuntos';

const user = {
  userId: 'user-1',
  role: 'admin',
  tenantId: 'tenant-1',
  tenantRole: 'admin',
  isActive: true,
  planFeatures: { gastos: true },
} as any;

describe('F-4: adjuntos de gasto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue({
      gastosDEId: 'gde-1',
      tenantId: 'tenant-1',
    } as any);
    vi.mocked(recordOwnerAsset).mockResolvedValue(undefined);
  });

  it('registrar valida el gasto y delega en recordOwnerAsset', async () => {
    const result = await registrarAdjuntoGastoAction({
      gastosDEId: 'gde-1',
      publicId: 'tenant-1/gastosDE/gde-1/comprobantes/abc',
      secureUrl: 'https://res.cloudinary.com/x/image/upload/tenant-1/gastosDE/gde-1/comprobantes/abc.jpg',
      mimeType: 'image/jpeg',
    });

    expect(result.success).toBe(true);
    const llamada = vi.mocked(recordOwnerAsset).mock.calls[0][0];
    expect(llamada.tenantId).toBe('tenant-1');
    expect(llamada.ownerType).toBe('gastoDE');
    expect(llamada.ownerId).toBe('gde-1');
    expect(llamada.slot).toBe('comprobante');
    expect(llamada.asset.publicId).toBe('tenant-1/gastosDE/gde-1/comprobantes/abc');
    expect(llamada.asset.secureUrl).toBe('https://res.cloudinary.com/x/image/upload/tenant-1/gastosDE/gde-1/comprobantes/abc.jpg');
  });

  it('registrar rechaza gasto ajeno al tenant', async () => {
    vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue(null as any);

    const result = await registrarAdjuntoGastoAction({
      gastosDEId: 'gde-ajeno',
      publicId: 'tenant-1/gastosDE/gde-1/comprobantes/abc',
      secureUrl: 'https://res.cloudinary.com/x/image/upload/tenant-1/gastosDE/gde-1/comprobantes/abc.jpg',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(recordOwnerAsset).not.toHaveBeenCalled();
  });

  it('rechaza URLs externas o publicId fuera de la carpeta del gasto', async () => {
    const result = await registrarAdjuntoGastoAction({
      gastosDEId: 'gde-1',
      publicId: 'tenant-1/gastosDE/otro-gasto/comprobantes/abc',
      secureUrl: 'https://example.com/abc.jpg',
      mimeType: 'image/jpeg',
    });

    expect(result.success).toBe(false);
    expect(recordOwnerAsset).not.toHaveBeenCalled();
  });

  it('listar devuelve solo adjuntos activos por posición', async () => {
    vi.mocked(prisma.cloudinaryAsset.findMany).mockResolvedValue([
      { assetId: 'a-1', position: 0 },
    ] as any);

    const result = await getAdjuntosGastoAction('gde-1');

    expect(result.success).toBe(true);
    expect(prisma.cloudinaryAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          ownerType: 'gastoDE',
          ownerId: 'gde-1',
          status: 'active',
        }),
        orderBy: { position: 'asc' },
      }),
    );
    expect(result.data).toHaveLength(1);
  });

  it('remove hace soft-delete del adjunto del tenant', async () => {
    vi.mocked(prisma.cloudinaryAsset.findFirst).mockResolvedValue({
      assetId: 'a-1',
      tenantId: 'tenant-1',
      ownerType: 'gastoDE',
    } as any);
    vi.mocked(prisma.cloudinaryAsset.update).mockResolvedValue({
      assetId: 'a-1',
      status: 'deleted',
    } as any);

    const result = await removeAdjuntoGastoAction('a-1');

    expect(result.success).toBe(true);
    expect(prisma.cloudinaryAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'deleted' }),
      }),
    );
  });
});
