/**
 * @description Tests unitarios para Server Actions de empleados.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    empleado: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getEmpleadosAction,
  getEmpleadoByIdAction,
  createEmpleadoAction,
  updateEmpleadoAction,
  deleteEmpleadoAction,
} from '@/features/empleados/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

describe('Empleados Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getEmpleadosAction retorna lista del tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.empleado.findMany).mockResolvedValue([]);
    const result = await getEmpleadosAction();
    expect(result.success).toBe(true);
  });

  it('getEmpleadoByIdAction retorna empleado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.empleado.findFirst).mockResolvedValue({ empleadoId: 'emp-1' } as any);
    const result = await getEmpleadoByIdAction('emp-1');
    expect(result.success).toBe(true);
  });

  it('createEmpleadoAction crea empleado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.empleado.create).mockResolvedValue({ empleadoId: 'emp-1' } as any);
    const result = await createEmpleadoAction({ nombre: 'Juan', apellido: 'Pérez', cargo: 'Vendedor', salarioBases: 50000 });
    expect(result.success).toBe(true);
  });

  it('updateEmpleadoAction actualiza empleado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.empleado.findFirst).mockResolvedValue({ empleadoId: 'emp-1' });
    vi.mocked(prisma.empleado.update).mockResolvedValue({} as any);
    const result = await updateEmpleadoAction({ empleadoId: 'emp-1', nombre: 'Juan Carlos' });
    expect(result.success).toBe(true);
  });

  it('deleteEmpleadoAction elimina empleado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.empleado.findFirst).mockResolvedValue({ empleadoId: 'emp-1' });
    vi.mocked(prisma.empleado.delete).mockResolvedValue({} as any);
    const result = await deleteEmpleadoAction('emp-1');
    expect(result.success).toBe(true);
  });

  it('retorna AUTH_REQUIRED sin usuario', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getEmpleadosAction();
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('AUTH_REQUIRED');
  });
});
