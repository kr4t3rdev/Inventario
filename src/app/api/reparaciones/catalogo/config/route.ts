import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, withAuthGet } from '@/lib/auth-middleware';

const DEFAULT_CURRENCY = 'USD';
const VALID_CLASSIFICATION_MODES = ['estructura_usuario'] as const;
const DEFAULT_MONEDA = {
  codigo: 'USD',
  nombre: 'Dolar Americano',
  simbolo: 'USD',
  esPrincipal: false,
  isActive: true,
};

function isValidClassificationMode(
  modoClasificacion: unknown
): modoClasificacion is (typeof VALID_CLASSIFICATION_MODES)[number] {
  return (
    typeof modoClasificacion === 'string' &&
    VALID_CLASSIFICATION_MODES.includes(
      modoClasificacion as (typeof VALID_CLASSIFICATION_MODES)[number]
    )
  );
}

export const GET = withAuthGet(async () => {
  try {
    await prisma.moneda.upsert({
      where: { codigo: DEFAULT_CURRENCY },
      update: {},
      create: DEFAULT_MONEDA,
    });

    await prisma.catalogoReparacionConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, monedaId: DEFAULT_CURRENCY },
    });

    const config = await prisma.catalogoReparacionConfig.findUnique({
      where: { id: 1 },
      include: { moneda: true },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error al obtener config de catálogo reparaciones:', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
});

export const PUT = withAuth(async (request: Request, _context: any, user: any) => {
  try {
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const body = await request.json();
    const monedaId = (body?.monedaId || '').toUpperCase();
    const modoClasificacion = body?.modoClasificacion;

    if (!monedaId) {
      return NextResponse.json({ error: 'monedaId es requerido' }, { status: 400 });
    }

    if (
      modoClasificacion !== undefined &&
      !isValidClassificationMode(modoClasificacion)
    ) {
      return NextResponse.json(
        { error: 'modoClasificacion inválido' },
        { status: 400 }
      );
    }

    const moneda = await prisma.moneda.findUnique({ where: { codigo: monedaId } });
    if (!moneda) {
      return NextResponse.json({ error: 'Moneda no encontrada' }, { status: 404 });
    }

    const config = await prisma.catalogoReparacionConfig.upsert({
      where: { id: 1 },
      update: { monedaId },
      create: { id: 1, monedaId },
    });

    return NextResponse.json(
      modoClasificacion !== undefined
        ? { ...config, modoClasificacion }
        : config
    );
  } catch (error) {
    console.error('Error al actualizar config de catálogo reparaciones:', error);
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
});
