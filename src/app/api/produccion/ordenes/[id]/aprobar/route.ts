import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { convertToBase } from '@/lib/utils/unit-converter';

/**
 * @description Aprueba una orden de producción, reservando los materiales del inventario.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Orden aprobada.
 */
export const POST = withAuthPost(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const userId = body.userId || 'system';

    // Obtener la orden con sus ingredientes
    const orden = await prisma.ordenProduccion.findUnique({
      where: { ordenProduccionId: id },
      include: {
        Receta: {
          include: {
            RecetaIngrediente: true,
          },
        },
      },
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de producción no encontrada.' }, { status: 404 });
    }

    if (String(orden.estado) !== 'PENDIENTE') {
      return NextResponse.json({ error: 'La orden ya no está en estado pendiente.' }, { status: 400 });
    }

    // Verificar disponibilidad de materiales
    const materialesFaltantes = [];
    for (const ingrediente of orden.Receta.RecetaIngrediente) {
      const factorDesperdicio = 1 + (ingrediente.desperdicio ?? 0);
      const cantidadBase = convertToBase(ingrediente.cantidad, ingrediente.unidadSimbolo);
      const cantidadRequerida = Math.ceil((cantidadBase * factorDesperdicio * orden.cantidad) - 1e-9);
      const producto = await prisma.producto.findUnique({
        where: { id: ingrediente.productoId },
      });

      if (!producto || producto.stock < cantidadRequerida) {
        materialesFaltantes.push({
          productoId: ingrediente.productoId,
          productoNombre: producto?.nombre || 'Desconocido',
          requerido: cantidadRequerida,
          disponible: producto?.stock || 0,
        });
      }
    }

    if (materialesFaltantes.length > 0) {
      return NextResponse.json({
        error: 'Materiales insuficientes.',
        materialesFaltantes,
      }, { status: 400 });
    }

    // Reservar materiales (decrementar stock)
    for (const ingrediente of orden.Receta.RecetaIngrediente) {
      const factorDesperdicio = 1 + (ingrediente.desperdicio ?? 0);
      const cantidadBase = convertToBase(ingrediente.cantidad, ingrediente.unidadSimbolo);
      const cantidadRequerida = Math.ceil((cantidadBase * factorDesperdicio * orden.cantidad) - 1e-9);
      
      await prisma.producto.update({
        where: { id: ingrediente.productoId },
        data: {
          stock: {
            decrement: cantidadRequerida,
          },
        },
      });
    }

    // Actualizar estado de la orden
    const ordenActualizada = await prisma.ordenProduccion.update({
      where: { ordenProduccionId: id },
      data: {
        estado: 'EN_PROCESO',
      },
      include: {
        Receta: {
          include: {
            Producto: {
              select: {
                id: true,
                nombre: true,
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
        },
      },
    });

    // Crear historial de estado
    await prisma.ordenProduccionHistorial.create({
      data: {
        ordenProduccionId: id,
        estadoAnterior: 'PENDIENTE',
        estadoNuevo: 'EN_PROCESO',
        observaciones: 'Orden aprobada - materiales reservados',
        usuarioId: userId,
      },
    });

    const ordenNormalizada = {
      ...ordenActualizada,
      receta: ordenActualizada.Receta
        ? {
            ...ordenActualizada.Receta,
            producto: ordenActualizada.Receta.Producto,
            ingredientes: ordenActualizada.Receta.RecetaIngrediente.map((ing) => ({
              ...ing,
              producto: ing.Producto,
            })),
          }
        : null,
    };

    return NextResponse.json(ordenNormalizada);
  } catch (error) {
    console.error('Error al aprobar orden de producción:', error);
    return NextResponse.json({ error: 'Error al aprobar orden de producción.' }, { status: 500 });
  }
});
