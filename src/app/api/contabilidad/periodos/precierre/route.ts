import { NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { TIPO_PERIODO, buildPeriodCode } from '@/lib/services/periodo-contable-service';

interface PeriodoLike {
  periodoId: string;
  codigo: string;
  tipo: 'DIARIO' | 'MENSUAL' | 'ANUAL';
  estado: string;
}

function normalizeNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * @description Calcula un precierre diario: el resumen del día sin persistir snapshot ni cerrar el período.
 * @param {NextRequest} request - Request HTTP.
 * @returns {Promise<NextResponse>} Resumen pre-cierre o error.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if ('status' in authResult) {
      return authResult as Response;
    }

    const { searchParams } = request.nextUrl;
    const fechaParam = searchParams.get('fecha');
    const fecha = fechaParam ? new Date(fechaParam) : new Date();

    if (Number.isNaN(fecha.getTime())) {
      return NextResponse.json(
        { error: 'Fecha inválida', code: 'FECHA_INVALIDA' },
        { status: 400 }
      );
    }

    const client = prisma as unknown as Record<string, unknown>;
    const periodoContable = client.periodoContable as
      | { findFirst: (args: Record<string, unknown>) => Promise<PeriodoLike | null> }
      | undefined;

    if (!periodoContable?.findFirst) {
      return NextResponse.json(
        { error: 'El runtime Prisma actual no expone PeriodoContable. Ejecutá migrate/generate.', code: 'PERIODO_UNAVAILABLE' },
        { status: 503 }
      );
    }

    const code = buildPeriodCode(TIPO_PERIODO.DIARIO, fecha);
    const periodo = await periodoContable.findFirst({
      where: { codigo: code, tipo: 'DIARIO' },
    });

    const fechaInicio = new Date(fecha);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = new Date(fecha);
    fechaFin.setHours(23, 59, 59, 999);

    const [
      ventasAgg,
      serviciosAgg,
      gastosDeAgg,
      comprasAgg,
      salariosAgg,
      ingresosCajaVentas,
      ingresosCajaServicios,
      egresosCaja,
      cuentas,
      cuentasPorCobrar,
      cuentasPorPagar,
      productos,
      capitales,
    ] = await Promise.all([
      prisma.venta.aggregate({
        _sum: { total: true },
        _count: { ventaId: true },
        where: { createdAt: { gte: fechaInicio, lte: fechaFin } },
      }),
      prisma.ventaServicios.aggregate({
        _sum: { total: true },
        _count: { ventaServicioId: true },
        where: { createdAt: { gte: fechaInicio, lte: fechaFin } },
      }),
      prisma.gastosDE.aggregate({
        _sum: { monto: true },
        _count: { gastosDEId: true },
        where: { createdAt: { gte: fechaInicio, lte: fechaFin } },
      }),
      prisma.gastoCompra.aggregate({
        _sum: { total: true },
        _count: { gastoCompraId: true },
        where: { createdAt: { gte: fechaInicio, lte: fechaFin } },
      }),
      prisma.pagosalario.aggregate({
        _sum: { salario: true, bonificaciones: true, deducciones: true },
        _count: { pgId: true },
        where: { createdAt: { gte: fechaInicio, lte: fechaFin } },
      }),
      prisma.reconciliacionVenta.aggregate({
        _sum: { montoConvertido: true },
        where: { fechaReconciliacion: { gte: fechaInicio, lte: fechaFin } },
      }),
      prisma.reconciliacionServicio.aggregate({
        _sum: { montoConvertido: true },
        where: { fechaReconciliacion: { gte: fechaInicio, lte: fechaFin } },
      }),
      prisma.reconciliacionGasto.aggregate({
        _sum: { montoConvertido: true },
        where: { fechaReconciliacion: { gte: fechaInicio, lte: fechaFin } },
      }),
      prisma.cuentaBancaria.findMany({
        where: { isActive: true },
        select: { saldo: true, tipoCuenta: true },
      }),
      prisma.cuentaPorCobrar.findMany({
        select: { montoDeuda: true, montoPagado: true },
      }),
      prisma.cuentaPorPagar.findMany({
        where: { deletedAt: null },
        select: { saldoPendiente: true },
      }),
      prisma.producto.findMany({
        select: { stock: true, precioCosto: true },
      }),
      prisma.inyeccionCapital.findMany({
        where: { tipo: 'CAPITAL_SOCIAL' },
        select: { montoRecibido: true },
      }),
    ]);

    const totalVentas = normalizeNumber(ventasAgg._sum.total);
    const totalServicios = normalizeNumber(serviciosAgg._sum.total);
    const totalGastosDE = normalizeNumber(gastosDeAgg._sum.monto);
    const totalGastosCompra = normalizeNumber(comprasAgg._sum.total);
    const totalGastosSalarios =
      normalizeNumber(salariosAgg._sum.salario) +
      normalizeNumber(salariosAgg._sum.bonificaciones) -
      normalizeNumber(salariosAgg._sum.deducciones);

    const totalIngresos = totalVentas + totalServicios;
    const totalGastos = totalGastosDE + totalGastosCompra + totalGastosSalarios;
    const diferencia = totalIngresos - totalGastos;

    const caja = cuentas
      .filter((c) => c.tipoCuenta?.toLowerCase().includes('caja'))
      .reduce((s, c) => s + normalizeNumber(c.saldo), 0);
    const bancos = cuentas
      .filter((c) => !c.tipoCuenta?.toLowerCase().includes('caja'))
      .reduce((s, c) => s + normalizeNumber(c.saldo), 0);

    const totalCxC = cuentasPorCobrar.reduce(
      (s, i) => s + Math.max(0, normalizeNumber(i.montoDeuda) - normalizeNumber(i.montoPagado)),
      0
    );
    const totalCxP = cuentasPorPagar.reduce(
      (s, i) => s + Math.max(0, normalizeNumber(i.saldoPendiente)),
      0
    );
    const inventario = productos.reduce(
      (s, p) => s + normalizeNumber(p.stock) * normalizeNumber(p.precioCosto),
      0
    );
    const capital = capitales.reduce(
      (s, c) => s + normalizeNumber(c.montoRecibido),
      0
    );

    const ingresosCaja =
      normalizeNumber(ingresosCajaVentas._sum.montoConvertido) +
      normalizeNumber(ingresosCajaServicios._sum.montoConvertido);
    const egresosCajaTotal = normalizeNumber(egresosCaja._sum.montoConvertido);

    const inconsistencias: string[] = [];
    if (totalIngresos === 0 && totalGastos === 0) {
      inconsistencias.push('Sin movimientos operativos para el día.');
    }
    if (diferencia < 0) {
      inconsistencias.push('La operación del día cerró con diferencia negativa.');
    }
    if (ingresosCaja < egresosCajaTotal) {
      inconsistencias.push('Los egresos de caja superan a los ingresos de caja.');
    }

    const resumen = {
      fecha: fechaInicio.toISOString().slice(0, 10),
      codigoPeriodo: code,
      existePeriodo: !!periodo,
      estadoPeriodo: periodo?.estado ?? 'NO_CREADO',
      totalVentas,
      totalServicios,
      totalIngresos,
      totalGastosDE,
      totalGastosCompra,
      totalGastosSalarios,
      totalGastos,
      diferencia,
      ingresosCaja,
      egresosCaja: egresosCajaTotal,
      saldoCajaFinal: caja,
      saldoBancoFinal: bancos,
      saldoCuentasCobrarFinal: totalCxC,
      saldoCuentasPagarFinal: totalCxP,
      saldoInventarioFinal: inventario,
      saldoCapitalFinal: capital,
      saldoResultadoAcumFinal: diferencia,
      ventasCount: normalizeNumber(ventasAgg._count.ventaId),
      serviciosCount: normalizeNumber(serviciosAgg._count.ventaServicioId),
      gastosCount:
        normalizeNumber(gastosDeAgg._count.gastosDEId) +
        normalizeNumber(comprasAgg._count.gastoCompraId) +
        normalizeNumber(salariosAgg._count.pgId),
      inconsistencias,
      puedeCerrar: periodo
        ? periodo.estado === 'ABIERTO' || periodo.estado === 'REABIERTO'
        : false,
    };

    return NextResponse.json(resumen, { status: 200 });
  } catch (error) {
    console.error('Error al calcular precierre:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}