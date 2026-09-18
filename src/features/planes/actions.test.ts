import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    plan: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { getPlansPublicActionV2 } from './actions';

describe('getPlansPublicActionV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expone labels comerciales para los features de upload en la landing', async () => {
    vi.mocked(prisma.plan.findMany).mockResolvedValue([
      {
        planId: 'plan-pro',
        nombre: 'Profesional',
        descripcion: 'Plan pro',
        precio: 70,
        duracionDias: 30,
        maxUsuarios: 5,
        maxAlmacenes: 5,
        maxProductos: 5000,
        maxClientes: 0,
        maxPuntosVenta: 5,
        maxFacturasMes: 0,
        maxContratos: 50,
        incluyeBackups: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        features: {
          'upload-clientes-logo': true,
          'upload-vendors-logo': true,
          'upload-profile-avatar': true,
          'upload-deudas-cash-receipt': true,
        },
      },
    ] as any);

    const plans = await getPlansPublicActionV2();

    expect(plans).toHaveLength(1);
    expect(plans[0].featuresByCategory['Empresa y Configuración']).toEqual(
      expect.arrayContaining([
        'Logos de clientes',
        'Logos de proveedores',
        'Avatar de usuario',
        'Comprobantes de deudas cash',
      ]),
    );
  });

  it('muestra CxC y CxP dentro de la configuración financiera del Profesional', async () => {
    vi.mocked(prisma.plan.findMany).mockResolvedValue([
      {
        planId: 'plan-pro',
        nombre: 'Profesional',
        descripcion: 'Plan profesional',
        precio: 80,
        duracionDias: 30,
        maxUsuarios: 5,
        maxAlmacenes: 5,
        maxProductos: 5000,
        maxClientes: 0,
        maxPuntosVenta: 5,
        maxFacturasMes: 0,
        maxContratos: 50,
        incluyeBackups: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        features: { 'cuentas-cobrar': true, 'cuentas-pagar': true },
      },
    ] as any);

    const [plan] = await getPlansPublicActionV2();

    expect(plan.featuresByCategory.Financiero).toEqual(
      expect.arrayContaining(['Cuentas por cobrar', 'Cuentas por pagar']),
    );
  });
});
