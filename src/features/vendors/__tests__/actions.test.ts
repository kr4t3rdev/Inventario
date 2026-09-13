/**
 * @description Tests unitarios para Server Actions de proveedores.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    vendor: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    vendorCodeSequence: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    // Guarda B-03: conteos de dependencias del proveedor
    producto: { count: vi.fn().mockResolvedValue(0) },
    gastoCompra: { count: vi.fn().mockResolvedValue(0) },
    compraProducto: { count: vi.fn().mockResolvedValue(0) },
    compraDocumento: { count: vi.fn().mockResolvedValue(0) },
    ordenCompra: { count: vi.fn().mockResolvedValue(0) },
    deudaCash: { count: vi.fn().mockResolvedValue(0) },
    cuentaPorPagar: { count: vi.fn().mockResolvedValue(0) },
    anticipo: { count: vi.fn().mockResolvedValue(0) },
    compraServicio: { count: vi.fn().mockResolvedValue(0) },
    contrato: { count: vi.fn().mockResolvedValue(0) },
    gastosDE: { count: vi.fn().mockResolvedValue(0) },
  },
}));
vi.mock('@/lib/vendor-code-utils', () => ({
  getNextVendorCode: vi.fn(),
  initializeVendorCodeSequence: vi.fn(),
  generateVendorEan13: vi.fn(),
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getNextVendorCode, initializeVendorCodeSequence, generateVendorEan13 } from '@/lib/vendor-code-utils';
import {
  getVendorsAction,
  getVendorByIdAction,
  createVendorAction,
  updateVendorAction,
  deleteVendorAction,
} from '@/features/vendors/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Test',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'admin',
};

const mockVendorRow = {
  vendorId: 'ven-1',
  nombre: 'Proveedor Test',
  vendorCode: '01',
  direccion: 'Calle 123',
  telefono: '555-0001',
  contacto: 'Juan',
  cuentaCUP: 'CUP001',
  cuentaUSD: null,
  logo: null,
  contrato: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('Vendors Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getVendorsAction', () => {
    it('retorna lista de proveedores del tenant con EAN-13', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.vendor.findMany).mockResolvedValue([mockVendorRow]);
      vi.mocked(generateVendorEan13).mockReturnValue('0100000000011');

      const result = await getVendorsAction();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].nombre).toBe('Proveedor Test');
      expect(result.data![0].ean13Code).toBe('0100000000011');
    });

    it('retorna lista vacía si no hay proveedores', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.vendor.findMany).mockResolvedValue([]);

      const result = await getVendorsAction();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getVendorByIdAction', () => {
    it('retorna proveedor por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.vendor.findFirst).mockResolvedValue(mockVendorRow);
      vi.mocked(generateVendorEan13).mockReturnValue('0100000000011');

      const result = await getVendorByIdAction('ven-1');

      expect(result.success).toBe(true);
      expect(result.data!.nombre).toBe('Proveedor Test');
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null);

      const result = await getVendorByIdAction('ven-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  describe('createVendorAction', () => {
    it('crea proveedor con código auto-asignado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(initializeVendorCodeSequence).mockResolvedValue(undefined);
      vi.mocked(getNextVendorCode).mockResolvedValue('05');
      vi.mocked(prisma.vendor.create).mockResolvedValue({ ...mockVendorRow, vendorCode: '05' });
      vi.mocked(generateVendorEan13).mockReturnValue('0500000000011');

      const result = await createVendorAction({ nombre: 'Nuevo Proveedor' });

      expect(result.success).toBe(true);
      expect(getNextVendorCode).toHaveBeenCalled();
      expect(result.data!.vendorCode).toBe('05');
    });

    it('retorna error si el nombre está vacío', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await createVendorAction({ nombre: '' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('updateVendorAction', () => {
    it('actualiza proveedor exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.vendor.findFirst).mockResolvedValue(mockVendorRow);
      vi.mocked(prisma.vendor.update).mockResolvedValue({ ...mockVendorRow, nombre: 'Actualizado' });
      vi.mocked(generateVendorEan13).mockReturnValue('0100000000011');

      const result = await updateVendorAction({ vendorId: 'ven-1', nombre: 'Actualizado' });

      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null);

      const result = await updateVendorAction({ vendorId: 'ven-noexiste', nombre: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrado');
    });
  });

  describe('deleteVendorAction', () => {
    it('elimina proveedor exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.vendor.findFirst).mockResolvedValue(mockVendorRow);
      vi.mocked(prisma.vendor.delete).mockResolvedValue(mockVendorRow);

      const result = await deleteVendorAction('ven-1');

      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null);

      const result = await deleteVendorAction('ven-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrado');
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getVendorsAction();
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
