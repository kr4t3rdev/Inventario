import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { PRODUCTION_STATES } from '@/lib/constants/production';
import { convertToBase } from '@/lib/utils/unit-converter';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { buildEventoProduccionSalida } from '@/features/contabilidad-formal/lib/event-builders';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { getRequiredTenantAccountingPolicy } from '@/features/contabilidad/services/tenant-accounting-policy-service';

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
    const userId = user.userId;
    const tenantId = requireTenant(user);
    requireFeature(user, 'produccion', 'completar órdenes de producción');
    try {
      requirePermission(user, 'produccion.recetas.gestionar', 'completar órdenes de producción');
    } catch {
      return NextResponse.json({ error: 'No tienes permisos para completar órdenes de producción.' }, { status: 403 });
    }

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

      if (!orden || orden.tenantId !== tenantId) {
        return null;
      }

      if (String(orden.estado) !== PRODUCTION_STATES.EN_PROCESO) {
        throw new Error('La orden no está en proceso.');
      }

      const accountingPolicy = await getRequiredTenantAccountingPolicy(tenantId, tx);

      if (!orden.Receta.Producto) {
        throw new Error('Producto final no configurado para esta receta.');
      }

      const productoId = orden.Receta.productoId;
      if (!productoId) {
        throw new Error('Producto final no configurado para esta receta.');
      }

      const productoFinal = await tx.producto.findUnique({
        where: { id: productoId },
        select: { id: true, almacenId: true, stock: true },
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

      if (costoMateriales > 0) {
        if (typeof body.cuentaId !== 'string' || !body.cuentaId.trim()) {
          throw new Error('CUENTA_PRODUCCION_INVALIDA');
        }
        const tipoPagoId = body.tipoPagoId ?? 'efectivo';
        if (typeof tipoPagoId !== 'string' || !tipoPagoId.trim()) {
          throw new Error('TIPO_PAGO_PRODUCCION_INVALIDO');
        }
        const [cuenta, tipoPago] = await Promise.all([
          tx.cuentaBancaria.findFirst({
            where: {
              cuentaId: body.cuentaId,
              tenantId,
              isActive: true,
              moneda: accountingPolicy.functionalCurrencyCode,
            },
            select: { cuentaId: true },
          }),
          tx.tipoPago.findFirst({
            where: { tipoId: tipoPagoId, tenantId, isActive: true },
            select: { tipoId: true },
          }),
        ]);
        if (!cuenta) throw new Error('CUENTA_PRODUCCION_INVALIDA');
        if (!tipoPago) throw new Error('TIPO_PAGO_PRODUCCION_INVALIDO');
      }

      // 1. Incrementar stock del producto final
      const stockIncrementado = orden.cantidad * orden.Receta.rendimiento;
      await tx.producto.update({
        where: { id: productoId },
        data: {
          stock: { increment: stockIncrementado },
        },
      });

      // 1b. Sincronizar StockUbicacion para producto final
      if (productoFinal.almacenId) {
        await upsertStockUbicacion(tx, {
          productoId,
          tipoUbicacion: 'almacen',
          ubicacionId: productoFinal.almacenId,
          modo: 'increment',
          delta: stockIncrementado,
        });
      }

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
          tenantId: orden.tenantId,
          estadoAnterior: PRODUCTION_STATES.EN_PROCESO,
          estadoNuevo: PRODUCTION_STATES.COMPLETADA,
          observaciones: `Producción completada. Costo de materiales: ${costoMateriales}. Stock incrementado: ${orden.cantidad * orden.Receta.rendimiento}`,
          usuarioId: userId,
        },
      });

      // La reconciliación y el asiento deben confirmar o revertir junto con el stock.
      if (costoMateriales > 0) {
        const fecha = new Date();
        const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        await tx.reconciliacionGasto.create({
          data: {
            tenantId: orden.tenantId,
            tipoGasto: 'produccion',
            referenciaId: id,
            cuentaId: body.cuentaId,
            tipoPagoId: body.tipoPagoId ?? 'efectivo',
            monto: costoMateriales,
            moneda: accountingPolicy.functionalCurrencyCode,
            montoConvertido: costoMateriales,
            functionalCurrency: accountingPolicy.functionalCurrencyCode,
            descripcion: `Costo de producción - Orden completa (Cantidad: ${orden.cantidad})`,
            periodo,
            reconciliadoPor: userId,
            estado: 'PENDIENTE',
          },
        });
      }

      // Capa de contabilidad formal (CTA-1): salida de producción al costo de insumos.
      if (costoMateriales > 0) {
        await postEvento(
          tx,
          { tenantId: orden.tenantId, userId },
          buildEventoProduccionSalida({
            ordenId: id,
            costo: costoMateriales,
            monedaFuncional: accountingPolicy.functionalCurrencyCode,
            fecha: new Date(),
            descripcion: `Salida de producción ${orden_updated.ordenProduccionId}`,
          }),
        );
      }

      return { orden: orden_updated, costoMateriales };
    });

    if (!ordenActualizada) {
      return NextResponse.json({ error: 'Orden de producción no encontrada.' }, { status: 404 });
    }

    return NextResponse.json(ordenActualizada.orden);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'CUENTA_PRODUCCION_INVALIDA' ||
          error.message === 'TIPO_PAGO_PRODUCCION_INVALIDO') {
        return NextResponse.json({ error: 'Cuenta o tipo de pago no válido para esta empresa.' }, { status: 400 });
      }
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
