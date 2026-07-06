'use server';

import { prisma } from '@/lib/prisma';
import { withAction } from '@/lib/server-actions';
import type { AuthenticatedUser from '@/lib/auth-middleware';

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
