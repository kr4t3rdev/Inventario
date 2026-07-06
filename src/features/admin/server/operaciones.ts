'use server';

import { prisma } from '@/lib/prisma';
import { withAction } from '@/lib/server-actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export interface TenantMastersHealth {
  tenantId: string;
  nombre: string;
  slug: string | null;
  counts: {
    productos: number;
    categorias: number;
    unidades: number;
    proveedores: number;
    puntosDeVenta: number;
    listasPrecio: number;
  };
  planName: string | null;
}

export interface TenantSalesHealth {
  tenantId: string;
  nombre: string;
  slug: string | null;
  metrics: {
    ventasCount: number;
    ventasTotal: number;
    facturasCount: number;
    ofertasCount: number;
    serviciosCount: number;
  };
  planName: string | null;
}

export interface TenantPurchaseHealth {
  tenantId: string;
  nombre: string;
  slug: string | null;
  metrics: {
    comprasCount: number;
    comprasTotal: number;
    itemsCount: number;
    vendorActiveCount: number;
  };
  planName: string | null;
}

export interface TenantWastageHealth {
  tenantId: string;
  nombre: string;
  slug: string | null;
  metrics: {
    mermasCount: number;
    mermasTotalValue: number;
  };
  planName: string | null;
}

export interface TenantBillingHealth {
  tenantId: string;
  nombre: string;
  slug: string | null;
  metrics: {
    facturasCount: number;
    ventasCount: number;
    formalizationRate: number;
  };
  planName: string | null;
}

export interface TenantOffersServicesHealth {
  tenantId: string;
  nombre: string;
  slug: string | null;
  metrics: {
    ofertasCount: number;
    serviciosCount: number;
  };
  planName: string | null;
}

export interface TenantExpenseHealth {
  tenantId: string;
  nombre: string;
  slug: string | null;
  metrics: {
    gastosCount: number;
    gastosTotal: number;
  };
  planName: string | null;
}

export interface TenantAccountingHealth {
  tenantId: string;
  nombre: string;
  slug: string | null;
  metrics: {
    hasActivePeriod: boolean;
    currentPeriodStatus: string | null;
    lastClosedPeriod: string | null;
    totalPeriods: number;
  };
  planName: string | null;
}

export const getGlobalMastersHealthAction = withAction(async (_, user: AuthenticatedUser) => {
  const tenants = await prisma.tenant.findMany({
    select: {
      tenantId: true,
      nombre: true,
      slug: true,
      _count: {
        select: {
          productos: true,
          categorias: true,
          unidades: true,
          vendors: true,
          puntosDeVenta: true,
          listasPrecio: true,
        },
      },
      licencias: {
        select: {
          plan: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const healthData: TenantMastersHealth[] = tenants.map((t) => ({
    tenantId: t.tenantId,
    nombre: t.nombre,
    slug: t.slug,
    planName: t.licencias[0]?.plan?.nombre || 'Sin Plan',
    counts: {
      productos: t._count.productos,
      categorias: t._count.categorias,
      unidades: t._count.unidades,
      proveedores: t._count.vendors,
      puntosDeVenta: t._count.puntosDeVenta,
      listasPrecio: t._count.listasPrecio,
    },
  }));

  return { healthData };
});

export const getGlobalSalesHealthAction = withAction(async (_, user: AuthenticatedUser) => {
  const tenants = await prisma.tenant.findMany({
    select: {
      tenantId: true,
      nombre: true,
      slug: true,
      _count: {
        select: {
          ventas: true,
          facturas: true,
          ofertas: true,
          servicios: true,
        },
      },
      licencias: {
        select: {
          plan: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const salesHealth: TenantSalesHealth[] = await Promise.all(tenants.map(async (t) => {
    const aggregate = await prisma.venta.aggregate({
      where: { tenantId: t.tenantId },
      _sum: {
        total: true,
      },
    });

    return {
      tenantId: t.tenantId,
      nombre: t.nombre,
      slug: t.slug,
      planName: t.licencias[0]?.plan?.nombre || 'Sin Plan',
      metrics: {
        ventasCount: t._count.ventas,
        ventasTotal: Number(aggregate._sum.total || 0),
        facturasCount: t._count.facturas,
        ofertasCount: t._count.ofertas,
        serviciosCount: t._count.servicios,
      },
    };
  }));

  return { salesHealth };
});

export const getGlobalPurchaseHealthAction = withAction(async (_, user: AuthenticatedUser) => {
  const tenants = await prisma.tenant.findMany({
    select: {
      tenantId: true,
      nombre: true,
      slug: true,
      _count: {
        select: {
          comprasDocumento: true,
          comprasProducto: true,
          vendors: true,
        },
      },
      licencias: {
        select: {
          plan: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const purchaseHealth: TenantPurchaseHealth[] = await Promise.all(tenants.map(async (t) => {
    const aggregate = await prisma.compraProducto.aggregate({
      where: { tenantId: t.tenantId },
      _sum: {
        total: true,
      },
    });

    return {
      tenantId: t.tenantId,
      nombre: t.nombre,
      slug: t.slug,
      planName: t.licencias[0]?.plan?.nombre || 'Sin Plan',
      metrics: {
        comprasCount: t._count.comprasDocumento,
        comprasTotal: Number(aggregate._sum.total || 0),
        itemsCount: t._count.comprasProducto,
        vendorActiveCount: t._count.vendors,
      },
    };
  }));

  return { purchaseHealth };
});

export const getGlobalWastageHealthAction = withAction(async (_, user: AuthenticatedUser) => {
  const tenants = await prisma.tenant.findMany({
    select: {
      tenantId: true,
      nombre: true,
      slug: true,
      _count: {
        select: {
          mermas: true,
        },
      },
      licencias: {
        select: {
          plan: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const wastageHealth: TenantWastageHealth[] = await Promise.all(tenants.map(async (t) => {
    return {
      tenantId: t.tenantId,
      nombre: t.nombre,
      slug: t.slug,
      planName: t.licencias[0]?.plan?.nombre || 'Sin Plan',
      metrics: {
        mermasCount: t._count.mermas,
        mermasTotalValue: 0,
      },
    };
  }));

  return { wastageHealth };
});

export const getGlobalBillingHealthAction = withAction(async (_, user: AuthenticatedUser) => {
  const tenants = await prisma.tenant.findMany({
    select: {
      tenantId: true,
      nombre: true,
      slug: true,
      _count: {
        select: {
          facturas: true,
          ventas: true,
        },
      },
      licencias: {
        select: {
          plan: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const billingHealth: TenantBillingHealth[] = tenants.map((t) => {
    const rate = t._count.ventas > 0 
      ? (t._count.facturas / t._count.ventas) * 100 
      : 0;

    return {
      tenantId: t.tenantId,
      nombre: t.nombre,
      slug: t.slug,
      planName: t.licencias[0]?.plan?.nombre || 'Sin Plan',
      metrics: {
        facturasCount: t._count.facturas,
        ventasCount: t._count.ventas,
        formalizationRate: Math.round(rate),
      },
    };
  });

  return { billingHealth };
});

export const getGlobalOffersServicesHealthAction = withAction(async (_, user: AuthenticatedUser) => {
  const tenants = await prisma.tenant.findMany({
    select: {
      tenantId: true,
      nombre: true,
      slug: true,
      _count: {
        select: {
          ofertas: true,
          servicios: true,
        },
      },
      licencias: {
        select: {
          plan: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const healthData: TenantOffersServicesHealth[] = tenants.map((t) => ({
    tenantId: t.tenantId,
    nombre: t.nombre,
    slug: t.slug,
    planName: t.licencias[0]?.plan?.nombre || 'Sin Plan',
    metrics: {
      ofertasCount: t._count.ofertas,
      serviciosCount: t._count.servicios,
    },
  }));

  return { healthData };
});

export const getGlobalExpenseHealthAction = withAction(async (_, user: AuthenticatedUser) => {
  const tenants = await prisma.tenant.findMany({
    select: {
      tenantId: true,
      nombre: true,
      slug: true,
      _count: {
        select: {
          gastosDE: true,
        },
      },
      licencias: {
        select: {
          plan: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const expenseHealth: TenantExpenseHealth[] = await Promise.all(tenants.map(async (t) => {
    return {
      tenantId: t.tenantId,
      nombre: t.nombre,
      slug: t.slug,
      planName: t.licencias[0]?.plan?.nombre || 'Sin Plan',
      metrics: {
        gastosCount: t._count.gastosDE,
        gastosTotal: 0,
      },
    };
  }));

  return { expenseHealth };
});

export const getGlobalAccountingHealthAction = withAction(async (_, user: AuthenticatedUser) => {
  const tenants = await prisma.tenant.findMany({
    select: {
      tenantId: true,
      nombre: true,
      slug: true,
      _count: {
        select: {
          periodosContables: true,
        },
      },
      licencias: {
        select: {
          plan: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const accountingHealth: TenantAccountingHealth[] = await Promise.all(tenants.map(async (t) => {
    const activePeriod = await prisma.periodoContable.findFirst({
      where: { 
        tenantId: t.tenantId,
        estado: 'ABIERTO' 
      },
      select: { codigo: true, estado: true },
    });

    const lastClosed = await prisma.periodoContable.findFirst({
      where: { 
        tenantId: t.tenantId,
        estado: 'CERRADO'
      },
      orderBy: { fechaFin: 'desc' },
      select: { codigo: true },
    });

    return {
      tenantId: t.tenantId,
      nombre: t.nombre,
      slug: t.slug,
      planName: t.licencias[0]?.plan?.nombre || 'Sin Plan',
      metrics: {
        hasActivePeriod: !!activePeriod,
        currentPeriodStatus: activePeriod?.estado || null,
        lastClosedPeriod: lastClosed?.codigo || null,
        totalPeriods: t._count.periodosContables,
      },
    };
  }));

  return { accountingHealth };
});

export type MasterFeature = 'productos' | 'categorias' | 'unidades' | 'proveedores' | 'puntosDeVenta' | 'listasPrecio';

export const getTenantFeatureDataAction = withAction(async (params: { tenantId: string; feature: MasterFeature }, user: AuthenticatedUser) => {
  const { tenantId, feature } = params;

  switch (feature) {
    case 'productos':
      return { data: await prisma.producto.findMany({ where: { tenantId }, take: 100, orderBy: { createdAt: 'desc' } }) };
    case 'categorias':
      return { data: await prisma.categoria.findMany({ where: { tenantId }, take: 100, orderBy: { nombre: 'asc' } }) };
    case 'unidades':
      return { data: await prisma.unidad.findMany({ where: { tenantId }, take: 100, orderBy: { nombre: 'asc' } }) };
    case 'proveedores':
      return { data: await prisma.vendor.findMany({ where: { tenantId }, take: 100, orderBy: { nombre: 'asc' } }) };
    case 'puntosDeVenta':
      return { data: await prisma.puntoDeVenta.findMany({ where: { tenantId }, take: 100 }) };
    case 'listasPrecio':
      return { data: await prisma.listaPrecio.findMany({ where: { tenantId }, take: 100 }) };
    default:
      throw new Error('Feature no soportada');
  }
});
