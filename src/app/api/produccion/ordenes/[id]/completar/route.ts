import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description Completa una orden de producción, incrementando el stock del producto terminado
 * y creando un registro en ReconciliacionGasto para contabilidad.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Orden completada.
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
            Producto: true,
            RecetaIngrediente: true,
          },
        },
      },
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de producción no encontrada.' }, { status: 404 });
    }

    if (String(orden.estado) !== 'EN_PROCESO') {
      return NextResponse.json({ error: 'La orden no está en proceso.' }, { status: 400 });
    }

    // Validar que el producto final existe en el catálogo
    if (!orden.Receta.Producto) {
      return NextResponse.json({
        error: 'Producto final no configurado para esta receta.'
      }, { status: 404 });
    }

    // Validar que el stock no excederá límites
    const productoFinal = await prisma.producto.findUnique({
      where: { id: orden.Receta.productoId },
    });

    if (!productoFinal) {
      return NextResponse.json({
        error: 'Producto final no encontrado en catálogo.'
      }, { status: 404 });
    }

    // Calcular costo de materiales
    let costoMateriales = 0;
    for (const ingrediente of orden.Receta.RecetaIngrediente) {
      const factorDesperdicio = 1 + (ingrediente.desperdicio ?? 0);
      const cantidadUsada = ingrediente.cantidad * factorDesperdicio * orden.cantidad;
      const producto = await prisma.producto.findUnique({
        where: { id: ingrediente.productoId },
      });
      if (producto) {
        costoMateriales += producto.precioCosto * cantidadUsada;
      }
    }

    const costoUnitario = orden.cantidad > 0 ? Math.round(costoMateriales / orden.cantidad) : 0;

    // Usar transacción para garantizar atomicity
    const ordenActualizada = await prisma.$transaction(async (tx) => {
      // 1. Incrementar stock del producto final
      const productoActualizado = await tx.producto.update({
        where: { id: orden.Receta.productoId },
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
          estado: 'COMPLETADA',
          costoMateriales,
          costoUnitario: costoUnitario || 0,
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
          estadoAnterior: 'EN_PROCESO',
          estadoNuevo: 'COMPLETADA',
          observaciones: `Producción completada. Costo de materiales: ${costoMateriales}. Stock incrementado: ${orden.cantidad * orden.Receta.rendimiento}`,
          usuarioId: userId,
        },
      });

      // 4. Registrar en contabilidad (ReconciliacionGasto) si hay costo
      if (costoMateriales > 0 && body.cuentaId) {
        const periodo = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        
        await tx.reconciliacionGasto.create({
          data: {
            tipoGasto: 'produccion',
            referenciaId: id,
            cuentaId: body.cuentaId,
            tipoPagoId: body.tipoPagoId || 'efectivo',
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

    return NextResponse.json(ordenActualizada);
  } catch (error) {
    console.error('Error al completar orden de producción:', error);
    return NextResponse.json({ error: 'Error al completar orden de producción.' }, { status: 500 });
  }
});
