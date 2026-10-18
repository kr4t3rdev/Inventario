/**
 * @description Tests para las Server Actions de Tipos de Pago.
 * Tenant isolation tests — RED phase: deben fallar hasta que se implemente el filtrado.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(async () => undefined) },
}));
// El mock se declara en vi.hoisted para que el factory de vi.mock pueda
// referenciarlo: asi el objeto conserva el tipo Mock de cada metodo y se
// accede a el directamente (mockPrisma.modelo.metodo). Envolver un metodo
// sobrecargado de Prisma en vi.mocked() devuelve NormalizedProcedure<...> y
// pierde los setters (mockResolvedValue / mockImplementation).
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tipoPago: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    cuentaBancaria: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import {
  getTiposPagoAction,
  getTipoPagoAction,
  createTipoPagoAction,
  updateTipoPagoAction,
  deleteTipoPagoAction,
} from '@/features/contabilidad/actions-tipos-pago';
import { AccountingConfigReadService } from '@/features/contabilidad/services/accounting-config-read-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockCuentaA_full = {
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

const mockCuentaB_full = {
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

const tenantA_user: AuthenticatedUser = {
  userId: 'u1',
  name: 'User A',
  email: 'a@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-a',
  tenantRole: 'manager',
};

const tenantB_user: AuthenticatedUser = {
  userId: 'u2',
  name: 'User B',
  email: 'b@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-b',
  tenantRole: 'manager',
};

const mockTipoPagoA = {
  tipoId: 'tp-a',
  nombre: 'Efectivo A',
  descripcion: null,
  requiereCuenta: false,
  cuentaDefecto: null,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  _count: { reconciliacionesVenta: 0, reconciliacionesServicio: 0, reconciliacionesGasto: 0 },
};

const mockTipoPagoB = {
  tipoId: 'tp-b',
  nombre: 'Efectivo B',
  descripcion: null,
  requiereCuenta: false,
  cuentaDefecto: null,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  _count: { reconciliacionesVenta: 0, reconciliacionesServicio: 0, reconciliacionesGasto: 0 },
};

// We need to mock getCurrentUser inside the tested module
// The actions use withAction which calls getCurrentUser internally
// So we mock the auth layer
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';

describe('getTiposPagoAction — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(tenantA_user);
  });

  it('RED: debe retornar solo tipos de pago del tenant del usuario', async () => {
    mockPrisma.tipoPago.findMany.mockResolvedValue([mockTipoPagoA]);

    const result = await getTiposPagoAction();

    expect(result.success).toBe(true);
    expect(expectActionSuccess(result).data?.data).toHaveLength(1);

    // ASSERT: el where DEBE incluir tenantId
    const callWhere = mockPrisma.tipoPago.findMany.mock.calls[0][0]?.where;
    expect(callWhere).toHaveProperty('tenantId');
    expect(callWhere.tenantId).toBe('tenant-a');
  });

  it('RED: no debe incluir tipos de pago de otro tenant cuando existen ambos', async () => {
    mockPrisma.tipoPago.findMany.mockImplementation(async (args: any = {}) => {
      const { where } = args;
      // Simular filtro por tenantId
      if (where?.tenantId === 'tenant-a') return [mockTipoPagoA];
      if (where?.tenantId === 'tenant-b') return [mockTipoPagoB];
      // Sin filtro retorna ambos (problema de seguridad)
      return [mockTipoPagoA, mockTipoPagoB];
    });

    const result = await getTiposPagoAction();

    expect(result.success).toBe(true);
    // Si el filtro no funciona, retorna 2 en vez de 1
    expect(expectActionSuccess(result).data?.data).toHaveLength(1);
    expect(expectActionSuccess(result).data?.data[0].tipoId).toBe('tp-a');
  });
});

describe('getTipoPagoAction — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(tenantA_user);
  });

  it('RED: debe retornar tipo de pago si pertenece al tenant', async () => {
    mockPrisma.tipoPago.findFirst.mockResolvedValue(mockTipoPagoA);

    const result = await getTipoPagoAction('tp-a');

    expect(result.success).toBe(true);
    expect(expectActionSuccess(result).data?.tipoId).toBe('tp-a');
  });

  it('RED: debe fallar con NOT_FOUND si el tipo pertenece a otro tenant', async () => {
        // Simular filtro correcto por tenantId: cuando busca tp-b + tenant-a, no lo encuentra
        mockPrisma.tipoPago.findFirst.mockImplementation(async (args: any) => {
        const { where } = args;
          if (where?.tipoId === 'tp-b' && where?.tenantId === 'tenant-a') return null;
          if (where?.tipoId === 'tp-b') return mockTipoPagoB;
          return mockTipoPagoA;
        });
    
        const result = await getTipoPagoAction('tp-b');
    
        // Debe fallar porque tp-b no pertenece al tenant del usuario
        expect(result.success).toBe(false);
        expect(expectActionFailure(result).error?.code).toBe('PAYMENT_TYPE_NOT_FOUND');
      });

  it('RED: debe fallar con NOT_FOUND si no existe', async () => {
    mockPrisma.tipoPago.findFirst.mockResolvedValue(null);

    const result = await getTipoPagoAction('no-existe');

          expect(result.success).toBe(false);
          expect(expectActionFailure(result).error?.code).toBe('PAYMENT_TYPE_NOT_FOUND');
        });
    });

    describe('Cross-tenant access isolation', () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });
    
      it('INTEGRATION: Tenant A no ve los TipoPago de Tenant B', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(tenantA_user);
        mockPrisma.tipoPago.findMany.mockImplementation(async (args: any) => {
        const { where } = args;
          if (where?.tenantId === 'tenant-a') return [mockTipoPagoA];
          return [];
        });
    
        const result = await getTiposPagoAction();
    
        expect(result.success).toBe(true);
        expect(expectActionSuccess(result).data?.data).toHaveLength(1);
        expect(expectActionSuccess(result).data?.data[0].tipoId).toBe('tp-a');
    
        // Cambiar a tenant B
        vi.mocked(getCurrentUser).mockResolvedValue(tenantB_user);
        mockPrisma.tipoPago.findMany.mockImplementation(async (args: any) => {
        const { where } = args;
          if (where?.tenantId === 'tenant-b') return [mockTipoPagoB];
          return [];
        });
    
        const resultB = await getTiposPagoAction();
    
        expect(resultB.success).toBe(true);
        expect(expectActionSuccess(resultB).data?.data).toHaveLength(1);
        expect(expectActionSuccess(resultB).data?.data[0].tipoId).toBe('tp-b');
      });
    
      it('INTEGRATION: Tenant A no puede actualizar TipoPago de Tenant B', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(tenantA_user);
        mockPrisma.tipoPago.findFirst.mockImplementation(async (args: any) => {
        const { where } = args;
          if (where?.tipoId === 'tp-b' && where?.tenantId === 'tenant-a') return null;
          if (where?.tipoId === 'tp-b') return mockTipoPagoB;
          return mockTipoPagoA;
        });
    
        const result = await updateTipoPagoAction({ id: 'tp-b', nombre: 'Hackeado' });
    
        expect(result.success).toBe(false);
        expect(expectActionFailure(result).error?.code).toBe('PAYMENT_TYPE_NOT_FOUND');
      });
    
      it('INTEGRATION: Tenant A no puede eliminar TipoPago de Tenant B', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(tenantA_user);
        mockPrisma.tipoPago.findFirst.mockImplementation(async (args: any) => {
        const { where } = args;
          if (where?.tipoId === 'tp-b' && where?.tenantId === 'tenant-a') return null;
          if (where?.tipoId === 'tp-b') return mockTipoPagoB;
          return mockTipoPagoA;
        });
    
        const result = await deleteTipoPagoAction('tp-b');
    
        expect(result.success).toBe(false);
        expect(expectActionFailure(result).error?.code).toBe('PAYMENT_TYPE_NOT_FOUND');
      });
    
      it('INTEGRATION: Crear TipoPago con mismo nombre en ambos tenants es válido', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(tenantA_user);
        mockPrisma.tipoPago.findFirst.mockResolvedValue(null);
        mockPrisma.tipoPago.create.mockResolvedValue({ ...mockTipoPagoA, tipoId: 'tp-new', nombre: 'Efectivo' });
    
        const resultA = await createTipoPagoAction({ nombre: 'Efectivo', requiereCuenta: false });
        expect(resultA.success).toBe(true);
    
        vi.mocked(getCurrentUser).mockResolvedValue(tenantB_user);
        // tenant B tambien puede crear "Efectivo" porque el nombre no está en su tenant
        mockPrisma.tipoPago.findFirst.mockResolvedValue(null);
        mockPrisma.tipoPago.create.mockResolvedValue({ ...mockTipoPagoB, tipoId: 'tp-new-2', nombre: 'Efectivo' });
    
        const resultB = await createTipoPagoAction({ nombre: 'Efectivo', requiereCuenta: false });
        expect(resultB.success).toBe(true);
      });
    
      it('INTEGRATION: AvailableAccounts no muestra cuentas de otro tenant', async () => {
        mockPrisma.cuentaBancaria.findMany.mockImplementation(async (args: any) => {
        const { where } = args;
          if (where?.tenantId === 'tenant-a') return [mockCuentaA_full];
          if (where?.tenantId === 'tenant-b') return [mockCuentaB_full];
          return [];
        });
        mockPrisma.tipoPago.findMany.mockResolvedValue([]);
        mockPrisma.cuentaBancaria.groupBy.mockResolvedValue([
          { moneda: 'CUP', _count: { cuentaId: 1 } },
        ]);
    
        const resultA = await AccountingConfigReadService.getAvailableAccounts('tenant-a');
        expect(resultA.cuentas).toHaveLength(1);
        expect(resultA.cuentas[0].cuentaId).toBe('cb-a');
    
        const resultB = await AccountingConfigReadService.getAvailableAccounts('tenant-b');
        expect(resultB.cuentas).toHaveLength(1);
        expect(resultB.cuentas[0].cuentaId).toBe('cb-b');
      });
    });

describe('createTipoPagoAction — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(tenantA_user);
  });

  it('RED: debe crear con tenantId del usuario', async () => {
    const input = { nombre: 'Nuevo Tipo', requiereCuenta: false };
    const created = { ...mockTipoPagoA, tipoId: 'tp-new', nombre: 'Nuevo Tipo' };

    mockPrisma.tipoPago.findFirst.mockResolvedValue(null); // No hay duplicado
    mockPrisma.tipoPago.create.mockResolvedValue(created);

    const result = await createTipoPagoAction(input);

    expect(result.success).toBe(true);

    // ASSERT: el create debe incluir tenantId
    const createData = mockPrisma.tipoPago.create.mock.calls[0][0]?.data;
    expect(createData).toHaveProperty('tenantId');
    expect(createData.tenantId).toBe('tenant-a');
  });

  it('rechaza creación para un miembro dependiente', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...tenantA_user,
      role: 'regularUser',
      tenantRole: 'dependiente',
    });

    const result = await createTipoPagoAction({
      nombre: 'No autorizado',
      requiereCuenta: false,
    });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('FORBIDDEN');
    expect(mockPrisma.tipoPago.create).not.toHaveBeenCalled();
  });

  it('RED: debe validar nombre duplicado solo dentro del mismo tenant', async () => {
    const input = { nombre: 'Efectivo A', requiereCuenta: false };

    // Simular que "Efectivo A" existe en tenant-a → debe fallar
    mockPrisma.tipoPago.findFirst.mockImplementation(async (args: any = {}) => {
      const { where } = args;
      if (where?.nombre?.equals === 'Efectivo A' && where?.tenantId === 'tenant-a') {
        return mockTipoPagoA;
      }
      return null;
    });

    const result = await createTipoPagoAction(input);

    // Debe fallar por nombre duplicado DENTRO del mismo tenant
    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('PAYMENT_TYPE_NAME_EXISTS');
  });

  it('RED: debe permitir nombre duplicado si el nombre existe en OTRO tenant', async () => {
    const input = { nombre: 'Efectivo B', requiereCuenta: false };
    const created = { ...mockTipoPagoA, tipoId: 'tp-new', nombre: 'Efectivo B' };

    // Simular que "Efectivo B" existe en tenant-b pero NO en tenant-a
    mockPrisma.tipoPago.findFirst.mockImplementation(async (args: any = {}) => {
      const { where } = args;
      if (where?.nombre?.equals === 'Efectivo B' && where?.tenantId === 'tenant-a') {
        return null; // No existe en tenant-a
      }
      if (where?.nombre?.equals === 'Efectivo B') {
        return mockTipoPagoB; // Existe en tenant-b (irrelevante)
      }
      return null;
    });
    mockPrisma.tipoPago.create.mockResolvedValue(created);

    const result = await createTipoPagoAction(input);

    // Debe crear exitosamente porque el duplicado es de otro tenant
    expect(result.success).toBe(true);
  });

  it('RED: debe validar que cuentaDefecto pertenece al tenant', async () => {
    const input = {
      nombre: 'Transferencia',
      requiereCuenta: true,
      cuentaDefecto: 'cb-1',
    };

    const mockCuentaA = { cuentaId: 'cb-1', tenantId: 'tenant-a', nombreBanco: 'Banco A', isActive: true };

    // Simular que la cuenta existe y pertenece al tenant
    mockPrisma.tipoPago.findFirst.mockResolvedValue(null);
    mockPrisma.cuentaBancaria.findFirst.mockResolvedValue(mockCuentaA);
    mockPrisma.tipoPago.create.mockResolvedValue({ ...mockTipoPagoA, ...input, tipoId: 'tp-new', _count: { reconciliacionesVenta: 0, reconciliacionesServicio: 0, reconciliacionesGasto: 0 } });

    const result = await createTipoPagoAction(input);

    expect(result.success).toBe(true);
  });

  it('RED: debe fallar si cuentaDefecto es de OTRO tenant', async () => {
    const input = {
      nombre: 'Transferencia',
      requiereCuenta: true,
      cuentaDefecto: 'cb-other',
    };

    const mockCuentaB = { cuentaId: 'cb-other', tenantId: 'tenant-b', nombreBanco: 'Banco B', isActive: true };

        mockPrisma.tipoPago.findFirst.mockResolvedValue(null);
        // Simular que findFirst respeta filtro de tenantId
        mockPrisma.cuentaBancaria.findFirst.mockImplementation(async (args: any) => {
        const { where } = args;
          if (where?.cuentaId === 'cb-other' && where?.tenantId === 'tenant-a') return null;
          return mockCuentaB;
        });

    const result = await createTipoPagoAction(input);

    // La cuenta existe pero es de tenant-b → debe fallar
    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('DEFAULT_ACCOUNT_NOT_FOUND');
  });
});

describe('updateTipoPagoAction — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(tenantA_user);
  });

      it('RED: debe actualizar si pertenece al tenant', async () => {
        const input = { id: 'tp-a', nombre: 'Actualizado' };
    
        // findFirst se llama varias veces: existing (OK), duplicado (null)
        mockPrisma.tipoPago.findFirst.mockImplementation(async (args: any) => {
        const { where } = args;
          if (where?.nombre?.equals && where?.tipoId?.not) return null;
          if (where?.tipoId === 'tp-a' && where?.tenantId === 'tenant-a') {
            return { ...mockTipoPagoA, nombre: 'Actualizado' };
          }
          return mockTipoPagoA;
        });
        mockPrisma.tipoPago.updateMany.mockResolvedValue({ count: 1 });

    const result = await updateTipoPagoAction(input);

    expect(result.success).toBe(true);
    expect(expectActionSuccess(result).data?.data.nombre).toBe('Actualizado');
    expect(mockPrisma.tipoPago.updateMany).toHaveBeenCalledWith({
      where: { tipoId: 'tp-a', tenantId: 'tenant-a' },
      data: { nombre: 'Actualizado' },
    });
  });

  it('RED: debe fallar con NOT_FOUND si pertenece a otro tenant', async () => {
        const input = { id: 'tp-b', nombre: 'Hackeado' };
    
        // tp-b existe pero es de tenant-b; al buscar con tenantId=tenant-a no debe encontrarlo
        mockPrisma.tipoPago.findFirst.mockImplementation(async (args: any) => {
        const { where } = args;
          if (where?.tipoId === 'tp-b' && where?.tenantId === 'tenant-a') return null;
          if (where?.tipoId === 'tp-b') return mockTipoPagoB;
          return mockTipoPagoA;
        });
    
        const result = await updateTipoPagoAction(input);
    
        // Debe fallar porque tp-b no pertenece al tenant del usuario
        expect(result.success).toBe(false);
        expect(expectActionFailure(result).error?.code).toBe('PAYMENT_TYPE_NOT_FOUND');
      });
    
  it('RED: debe validar cuentaDefecto contra el tenant en update', async () => {
        const input = {
          id: 'tp-a',
          requiereCuenta: true,
          cuentaDefecto: 'cb-other',
        };
    
        const mockCuentaB = { cuentaId: 'cb-other', tenantId: 'tenant-b', nombreBanco: 'Banco B', isActive: true };
    
        mockPrisma.tipoPago.findFirst.mockResolvedValue(mockTipoPagoA);
        // cuenta existe pero es de tenant-b; al buscar con tenantId=tenant-a no la encuentra
        mockPrisma.cuentaBancaria.findFirst.mockImplementation(async (args: any) => {
        const { where } = args;
          if (where?.cuentaId === 'cb-other' && where?.tenantId === 'tenant-a') return null;
          return mockCuentaB;
        });

    const result = await updateTipoPagoAction(input);

    // La cuenta existe pero es de tenant-b → debe fallar
    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('DEFAULT_ACCOUNT_NOT_FOUND');
  });

  it('rechaza limpiar cuentaDefecto si el tipo todavía requiere cuenta', async () => {
    mockPrisma.tipoPago.findFirst.mockResolvedValue({
      ...mockTipoPagoA,
      requiereCuenta: true,
      cuentaDefecto: 'cb-a',
    });

    const result = await updateTipoPagoAction({
      id: 'tp-a',
      cuentaDefecto: null,
    });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('ACCOUNT_REQUIRED_BUT_NOT_PROVIDED');
    expect(mockPrisma.tipoPago.updateMany).not.toHaveBeenCalled();
  });
});

describe('deleteTipoPagoAction — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(tenantA_user);
  });

  it('RED: debe eliminar si pertenece al tenant', async () => {
    mockPrisma.tipoPago.findFirst.mockResolvedValue(mockTipoPagoA);
    mockPrisma.tipoPago.deleteMany.mockResolvedValue({ count: 1 });

    const result = await deleteTipoPagoAction('tp-a');

    expect(result.success).toBe(true);
    expect(expectActionSuccess(result).data?.success).toBe(true);
    expect(mockPrisma.tipoPago.deleteMany).toHaveBeenCalledWith({
      where: { tipoId: 'tp-a', tenantId: 'tenant-a' },
    });
  });

  it('RED: debe fallar con NOT_FOUND si pertenece a otro tenant', async () => {
        // tp-b existe pero es de tenant-b; al buscar con tenantId=tenant-a no debe encontrarlo
        mockPrisma.tipoPago.findFirst.mockImplementation(async (args: any) => {
        const { where } = args;
          if (where?.tipoId === 'tp-b' && where?.tenantId === 'tenant-a') return null;
          if (where?.tipoId === 'tp-b') return mockTipoPagoB;
          return mockTipoPagoA;
        });
    
        const result = await deleteTipoPagoAction('tp-b');
    
        // Debe fallar porque tp-b no pertenece al tenant del usuario
        expect(result.success).toBe(false);
        expect(expectActionFailure(result).error?.code).toBe('PAYMENT_TYPE_NOT_FOUND');
      });
});
