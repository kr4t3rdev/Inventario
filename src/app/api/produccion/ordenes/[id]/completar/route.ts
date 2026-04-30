import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { PRODUCTION_STATES } from '@/lib/constants/production';
import { convertToBase } from '@/lib/utils/unit-converter';

/**
 * @description Completa una orden de producción, incrementando el stock del producto terminado
 * y creando un registro en ReconciliacionGasto para contabilidad.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Orden completada.
 */
export const POST = withAuthPost(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const userId = body.userId || user?.userId || 'system';

    const ordenActualizada = await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenProduccion.findUnique({
        where: { ordenProduccionId: id },
        include: {
          Receta: {
            include: {
              Producto: true,
              RecetaIngrediente: true,
            },
          },
        },
      });

      if (!orden) {
        return null;
      }

      if (String(orden.estado) !== PRODUCTION_STATES.EN_PROCESO) {
        throw new Error('La orden no está en proceso.');
      }

      if (!orden.Receta.Producto) {
        throw new Error('Producto final no configurado para esta receta.');
      }

      const productoId = orden.Receta.productoId;
      if (!productoId) {
        throw new Error('Producto final no configurado para esta receta.');
      }

      const productoFinal = await tx.producto.findUnique({
        where: { id: productoId },
      });

      if (!productoFinal) {
        throw new Error('Producto final no encontrado en catálogo.');
      }

      let costoMateriales = 0;
      for (const ingrediente of orden.Receta.RecetaIngrediente) {
        const factorDesperdicio = 1 + (ingrediente.desperdicio ?? 0);
        const cantidadBase = convertToBase(ingrediente.cantidad, ingrediente.unidadSimbolo);
        const cantidadUsada = cantidadBase * factorDesperdicio * orden.cantidad;
        const producto = await tx.producto.findUnique({
          where: { id: ingrediente.productoId },
        });
        if (producto) {
          costoMateriales += producto.precioCosto * cantidadUsada;
        }
      }

      // 1. Incrementar stock del producto final
      await tx.producto.update({
        where: { id: productoId },
        data: {
          stock: {
            increment: orden.cantidad * orden.Receta.rendimiento,
          },
        },
      });

      // 2. Actualizar estado de la orden con los costos
      const orden_updated = await tx.ordenProduccion.update({
        where: { ordenProduccionId: id },
        data: {
          estado: PRODUCTION_STATES.COMPLETADA,
          costoMateriales,
          updatedAt: new Date(),
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

      // 3. Crear historial de estado
      await tx.ordenProduccionHistorial.create({
        data: {
          ordenProduccionId: id,
          estadoAnterior: PRODUCTION_STATES.EN_PROCESO,
          estadoNuevo: PRODUCTION_STATES.COMPLETADA,
          observaciones: `Producción completada. Costo de materiales: ${costoMateriales}. Stock incrementado: ${orden.cantidad * orden.Receta.rendimiento}`,
          usuarioId: userId,
        },
      });

      // 4. Registrar en contabilidad (ReconciliacionGasto) si hay costo
      if (costoMateriales > 0) {
        const periodo = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        
        await tx.reconciliacionGasto.create({
          data: {
            tipoGasto: 'produccion',
            referenciaId: id,
            cuentaId: body.cuentaId,
            tipoPagoId: body.tipoPagoId,
            monto: costoMateriales,
            moneda: 'CUP',
            descripcion: `Costo de producción - Orden: ${orden.Receta.nombre} (Cantidad: ${orden.cantidad})`,
            periodo,
            reconciliadoPor: userId,
            estado: 'PENDIENTE',
          },
        });
      }

      return orden_updated;
    });

    if (!ordenActualizada) {
      return NextResponse.json({ error: 'Orden de producción no encontrada.' }, { status: 404 });
    }

    return NextResponse.json(ordenActualizada);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'La orden no está en proceso.') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (
        error.message === 'Producto final no configurado para esta receta.' ||
        error.message === 'Producto final no encontrado en catálogo.'
      ) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    console.error('Error al completar orden de producción:', error);
    return NextResponse.json({ error: 'Error al completar orden de producción.' }, { status: 500 });
  }
});
