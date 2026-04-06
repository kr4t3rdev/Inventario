import { NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { migrateCuentasPorPagarBodySchema } from '@/lib/admin/schemas';
import { isAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

interface MigrationDetail {
  cuentaPorPagarId: string;
  numeroFactura: string;
  estado: 'OK' | 'ERROR';
  gastoCompraId?: string;
  error?: string;
}

/**
 * @description Endpoint para migrar cuentas por pagar antiguas y crear los GastoCompra faltantes.
 * Solo accesible para administradores.
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Resultado de la migración
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const payload = rawBody.trim().length > 0 ? JSON.parse(rawBody) : {};
    const bodyValidation = migrateCuentasPorPagarBodySchema.safeParse(payload);

    if (!bodyValidation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: bodyValidation.error.flatten() },
        { status: 400 },
      );
    }

    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as NextResponse
    const user = authResultUser.user

    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden ejecutar migraciones' },
        { status: 403 },
      );
    }

    const cuentasSinGasto = await prisma.cuentaPorPagar.findMany({
      where: {
        tipo: 'compra',
        gastoCompraId: null,
      },
      include: {
        proveedor: true,
      },
    });

    if (cuentasSinGasto.length === 0) {
      return NextResponse.json({
        message: 'No hay cuentas para migrar. Todo está actualizado.',
        procesadas: 0,
        errores: 0,
        detalles: [],
      });
    }

    const resultados: MigrationDetail[] = [];
    let procesadas = 0;
    let errores = 0;

    for (const cuenta of cuentasSinGasto) {
      try {
        const compraProducto = await prisma.compraProducto.findFirst({
          where: {
            cuentaPorPagarId: cuenta.cuentaPorPagarId,
          },
          include: {
            producto: true,
          },
        });

        if (!compraProducto) {
          resultados.push({
            cuentaPorPagarId: cuenta.cuentaPorPagarId,
            numeroFactura: cuenta.numeroFactura,
            estado: 'ERROR',
            error: 'No se encontró CompraProducto asociada',
          });
          errores++;
          continue;
        }

        const periodo = cuenta.createdAt
          ? `${cuenta.createdAt.getFullYear()}-${String(cuenta.createdAt.getMonth() + 1).padStart(2, '0')}`
          : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

        const gastoCompra = await prisma.$transaction(async (tx) => {
          const createdGasto = await tx.gastoCompra.create({
            data: {
              productoId: compraProducto.productoId,
              vendorId: cuenta.proveedorId || compraProducto.proveedorId,
              numeroFactura: cuenta.numeroFactura,
              cantidad: compraProducto.cantidad,
              precioUnitario: compraProducto.precioUnitario,
              total: Number(cuenta.montoDeuda),
              fechaCompra: cuenta.fechaEmision || cuenta.createdAt || new Date(),
              descripcion:
                compraProducto.descripcion ||
                `Compra - ${compraProducto.producto?.nombre || 'Producto'}`,
              periodo,
            },
          });

          await tx.cuentaPorPagar.update({
            where: {
              cuentaPorPagarId: cuenta.cuentaPorPagarId,
            },
            data: {
              gastoCompraId: createdGasto.gastoCompraId,
            },
          });

          await tx.compraProducto.update({
            where: {
              compraProductoId: compraProducto.compraProductoId,
            },
            data: {
              gastoCompraId: createdGasto.gastoCompraId,
            },
          });

          return createdGasto;
        });

        resultados.push({
          cuentaPorPagarId: cuenta.cuentaPorPagarId,
          numeroFactura: cuenta.numeroFactura,
          gastoCompraId: gastoCompra.gastoCompraId,
          estado: 'OK',
        });
        procesadas++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        console.error(`Error al procesar cuenta ${cuenta.cuentaPorPagarId}:`, error);
        resultados.push({
          cuentaPorPagarId: cuenta.cuentaPorPagarId,
          numeroFactura: cuenta.numeroFactura,
          estado: 'ERROR',
          error: message,
        });
        errores++;
      }
    }

    return NextResponse.json({
      message: `Migración completada. ${procesadas} cuentas procesadas, ${errores} errores.`,
      procesadas,
      errores,
      total: cuentasSinGasto.length,
      detalles: resultados,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en migración:', error);
    return NextResponse.json(
      {
        error: 'Error durante la migración',
        message,
      },
      { status: 500 },
    );
  }
}

/**
 * @description GET para verificar el estado de la migración (cuántas cuentas pendientes hay)
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Estado de la migración
 */
export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as NextResponse
    const user = authResultUser.user

    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden ver el estado de migraciones' },
        { status: 403 },
      );
    }

    const cuentasPendientes = await prisma.cuentaPorPagar.count({
      where: {
        tipo: 'compra',
        gastoCompraId: null,
      },
    });

    const cuentas = await prisma.cuentaPorPagar.findMany({
      where: {
        tipo: 'compra',
        gastoCompraId: null,
      },
      select: {
        cuentaPorPagarId: true,
        numeroFactura: true,
        proveedorNombre: true,
        montoDeuda: true,
        estado: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      pendientes: cuentasPendientes,
      cuentas: cuentas.map((cuenta) => ({
        ...cuenta,
        montoDeuda: Number(cuenta.montoDeuda),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error al obtener estado de migración:', error);
    return NextResponse.json(
      {
        error: 'Error al obtener estado',
        message,
      },
      { status: 500 },
    );
  }
}
