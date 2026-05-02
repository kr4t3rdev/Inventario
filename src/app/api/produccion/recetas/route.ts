import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware';
import { requireTenant } from '@/lib/services/tenant-scope';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { calculateCostoUnitarioReceta } from '@/lib/utils/produccion';

const createRecetaSchema = z.object({
  nombre: z.string().min(1).max(160),
  rendimiento: z.number().int().min(1).default(1),
  productoId: z.string().min(1, 'Producto final requerido'),
  instrucciones: z.string().max(4000).optional(),
  tiempoPrep: z.number().int().min(1).max(1440).optional(),
});

/**
 * @description Obtiene recetas de producción con filtro opcional por producto.
 * @param {NextRequest} request - Request HTTP con filtros opcionales.
 * @returns {Promise<NextResponse>} Recetas encontradas.
 */
export const GET = withAuthGet(async (request: NextRequest, _ctx: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.trim();
    const productoId = searchParams.get('productoId')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (search) {
      whereClause.nombre = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (productoId) {
      whereClause.productoId = productoId;
    }

    const [recetas, total] = await Promise.all([
      prisma.receta.findMany({
        where: whereClause,
        include: {
          Producto: {
            select: {
              id: true,
              nombre: true,
              precioCosto: true,
              stock: true,
            },
          },
          RecetaIngrediente: {
            include: {
              Producto: {
                select: {
                  id: true,
                  nombre: true,
                  precioCosto: true,
                  stock: true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.receta.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data: recetas,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error al obtener recetas de producción:', error);
    return NextResponse.json({ error: 'Error al obtener recetas de producción.' }, { status: 500 });
  }
});

/**
 * @description Crea una receta para producción de productos.
 * @param {NextRequest} request - Request HTTP con datos de receta.
 * @returns {Promise<NextResponse>} Receta creada.
 */
export const POST = withAuthPost(async (request: NextRequest, _ctx: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const payload = createRecetaSchema.parse(await request.json());

    if (!payload.productoId) {
      return NextResponse.json(
        { error: 'Debés configurar el producto final de salida para la receta.' },
        { status: 400 }
      );
    }

    // Obtener producto final para calcular costo
    const productoFinal = await prisma.producto.findUnique({
      where: { id: payload.productoId },
      select: { precioCosto: true },
    });
    const precioCostoProductoFinal = productoFinal?.precioCosto || 0;

    // Calcular costo unitario inicial (sin productos agregados aún)
    const costoUnitario = calculateCostoUnitarioReceta(
      precioCostoProductoFinal,
      [],
      payload.rendimiento
    );

    const receta = await prisma.receta.create({
      data: {
        recetaId: crypto.randomUUID(),
        tenantId,
        nombre: payload.nombre,
        rendimiento: payload.rendimiento,
        costoUnitario: costoUnitario,
        productoId: payload.productoId,
        instrucciones: payload.instrucciones,
        tiempoPrep: payload.tiempoPrep,
        updatedAt: new Date(),
      },
      include: {
        Producto: {
          select: {
            id: true,
            nombre: true,
            precioCosto: true,
          },
        },
        RecetaIngrediente: {
          include: {
            Producto: {
              select: {
                id: true,
                nombre: true,
                precioCosto: true,
                stock: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(receta, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const productoIssue = error.issues.find((issue) => issue.path.includes('productoId'));

      if (productoIssue) {
        return NextResponse.json(
          { error: 'Debés configurar el producto final de salida para la receta.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Datos inválidos para crear receta.', issues: error.issues },
        { status: 400 }
      );
    }

    console.error('Error al crear receta de producción:', error);
    return NextResponse.json({ error: 'Error al crear receta de producción.' }, { status: 500 });
  }
});
