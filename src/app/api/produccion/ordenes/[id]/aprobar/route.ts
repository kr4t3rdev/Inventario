import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { PRODUCTION_STATES } from '@/lib/constants/production';
import { calcularCantidadRequeridaMaterial, validarDisponibilidadMateriales } from '@/lib/utils/produccion';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';

/**
 * @description Aprueba una orden de producción, reservando los materiales del inventario.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Orden aprobada.
 */
export const POST = withAuthPost(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const userId = body.userId || user?.userId || 'system';

    const ordenNormalizada = await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenProduccion.findUnique({
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
        return null;
      }

      if (String(orden.estado) !== PRODUCTION_STATES.PENDIENTE) {
        throw new Error('La orden ya no está en estado pendiente.');
      }

      const ingredientesConStock = [];
      for (const ingrediente of orden.Receta.RecetaIngrediente) {
        const producto = await tx.producto.findUnique({
          where: { id: ingrediente.productoId },
          select: { id: true, nombre: true, precioCosto: true, almacenId: true },
        });

        const stockEnAlmacen = producto?.almacenId
          ? await tx.stockUbicacion.findUnique({
              where: {
                productoId_tipoUbicacion_ubicacionId: {
                  productoId: ingrediente.productoId,
                  tipoUbicacion: 'almacen',
                  ubicacionId: producto.almacenId,
                },
              },
              select: {
                productoId: true,
                cantidad: true,
                cantidadReservada: true,
                cantidadDisponible: true,
              },
            })
          : null;

        ingredientesConStock.push({
          productoId: ingrediente.productoId,
          cantidad: ingrediente.cantidad,
          unidadSimbolo: ingrediente.unidadSimbolo ?? null,
          desperdicio: ingrediente.desperdicio ?? 0,
          almacenId: producto?.almacenId,
          producto: producto
            ? {
                nombre: producto.nombre,
                precioCosto: producto.precioCosto,
                stock: stockEnAlmacen?.cantidadDisponible ?? 0,
              }
            : undefined,
        });
      }

      const materialesFaltantes = validarDisponibilidadMateriales(ingredientesConStock, orden.cantidad);

      if (materialesFaltantes.length > 0) {
        throw new Error(JSON.stringify({
          error: 'Materiales insuficientes.',
          materialesFaltantes,
        }));
      }

      for (const ingrediente of ingredientesConStock) {
        const cantidadRequerida = calcularCantidadRequeridaMaterial(ingrediente, orden.cantidad);

        if (ingrediente.almacenId) {
          await upsertStockUbicacion(tx, {
            productoId: ingrediente.productoId,
            tipoUbicacion: 'almacen',
            ubicacionId: ingrediente.almacenId,
            modo: 'increment',
            delta: -cantidadRequerida,
          });
        }
      }

      const ordenActualizada = await tx.ordenProduccion.update({
        where: { ordenProduccionId: id },
        data: {
          estado: PRODUCTION_STATES.EN_PROCESO,
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

      await tx.ordenProduccionHistorial.create({
        data: {
          ordenProduccionId: id,
          tenantId: orden.tenantId,
          estadoAnterior: PRODUCTION_STATES.PENDIENTE,
          estadoNuevo: PRODUCTION_STATES.EN_PROCESO,
          observaciones: 'Orden aprobada - materiales reservados',
          usuarioId: userId,
        },
      });

      return {
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
    });

    if (!ordenNormalizada) {
      return NextResponse.json({ error: 'Orden de producción no encontrada.' }, { status: 404 });
    }

    return NextResponse.json(ordenNormalizada);
  } catch (error) {
    if (error instanceof Error && error.message === 'La orden ya no está en estado pendiente.') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error) {
      try {
        const parsed = JSON.parse(error.message) as { error: string; materialesFaltantes: unknown[] };
        if (parsed.error === 'Materiales insuficientes.') {
          return NextResponse.json(parsed, { status: 400 });
        }
      } catch {
        // No-op: fall through to generic error handler.
      }
    }

    console.error('Error al aprobar orden de producción:', error);
    return NextResponse.json({ error: 'Error al aprobar orden de producción.' }, { status: 500 });
  }
});
