import prisma from '@/lib/prisma';

import { buildPeriodCode, TIPO_PERIODO } from '@/lib/services/periodo-contable-service';

interface PersistedPeriodoLike {
  periodoId: string;
  codigo: string;
  tipo: 'DIARIO' | 'MENSUAL' | 'ANUAL';
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
}

interface PersistedSnapshotLike {
  snapshotId: string;
  periodoId: string;
  version: number;
  resumenJson?: unknown;
}

interface DailyPersistenceModels {
  periodoContable: {
    findFirst: (args: Record<string, unknown>) => Promise<PersistedPeriodoLike | null>;
    update: (args: Record<string, unknown>) => Promise<PersistedPeriodoLike>;
  };
  snapshotPeriodo: {
    findFirst: (args: Record<string, unknown>) => Promise<PersistedSnapshotLike | null>;
    create: (args: Record<string, unknown>) => Promise<PersistedSnapshotLike>;
  };
}

export class CierreDiarioPersistenceUnavailableError extends Error {
  status: number;
  code: string;

  constructor() {
    super(
      'El runtime Prisma actual no expone PeriodoContable/SnapshotPeriodo. Ejecutá migrate/generate antes de persistir cierres diarios.'
    );
    this.name = 'CierreDiarioPersistenceUnavailableError';
    this.status = 503;
    this.code = 'CIERRE_DIARIO_PERSISTENCE_UNAVAILABLE';
  }
}

export class DailyPeriodNotFoundError extends Error {
  status: number;
  code: string;

  constructor(code: string) {
    super(`No existe un período diario abierto para ${code}.`);
    this.name = 'DailyPeriodNotFoundError';
    this.status = 404;
    this.code = 'PERIODO_DIARIO_NO_ENCONTRADO';
  }
}

export interface DailyCloseSummary {
  fecha: string;
  totalVentas: number;
  totalServicios: number;
  totalIngresos: number;
  totalGastosDE: number;
  totalGastosCompra: number;
  totalGastosSalarios: number;
  totalGastos: number;
  diferencia: number;
  ingresosCaja: number;
  egresosCaja: number;
  saldoCajaFinal: number;
  saldoBancoFinal: number;
  saldoCuentasCobrarFinal: number;
  saldoCuentasPagarFinal: number;
  saldoInventarioFinal: number;
  saldoCapitalFinal: number;
  saldoResultadoAcumFinal: number;
  ventasCount: number;
  serviciosCount: number;
  gastosCount: number;
}

export interface PersistDailyCloseParams {
  fecha: Date;
  usuarioId: string;
}

export interface PersistDailyCloseResult {
  periodo: PersistedPeriodoLike;
  snapshot: PersistedSnapshotLike;
  resumen: DailyCloseSummary;
  wasCreated: boolean;
}

function normalizeNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function resolvePersistenceModels(client: unknown): DailyPersistenceModels {
  const candidate = client as Record<string, unknown>;
  const periodoContable = candidate.periodoContable as DailyPersistenceModels['periodoContable'] | undefined;
  const snapshotPeriodo = candidate.snapshotPeriodo as DailyPersistenceModels['snapshotPeriodo'] | undefined;

  if (
    !periodoContable?.findFirst ||
    !periodoContable?.update ||
    !snapshotPeriodo?.findFirst ||
    !snapshotPeriodo?.create
  ) {
    throw new CierreDiarioPersistenceUnavailableError();
  }

  return {
    periodoContable,
    snapshotPeriodo,
  };
}

async function resolveDailySummary(fecha: Date): Promise<DailyCloseSummary> {
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
    .filter((cuenta) => cuenta.tipoCuenta?.toLowerCase().includes('caja'))
    .reduce((sum, cuenta) => sum + normalizeNumber(cuenta.saldo), 0);
  const bancos = cuentas
    .filter((cuenta) => !cuenta.tipoCuenta?.toLowerCase().includes('caja'))
    .reduce((sum, cuenta) => sum + normalizeNumber(cuenta.saldo), 0);

  const totalCxC = cuentasPorCobrar.reduce(
    (sum, item) =>
      sum + Math.max(0, normalizeNumber(item.montoDeuda) - normalizeNumber(item.montoPagado)),
    0
  );
  const totalCxP = cuentasPorPagar.reduce(
    (sum, item) => sum + Math.max(0, normalizeNumber(item.saldoPendiente)),
    0
  );
  const inventario = productos.reduce(
    (sum, producto) =>
      sum + normalizeNumber(producto.stock) * normalizeNumber(producto.precioCosto),
    0
  );
  const capital = capitales.reduce(
    (sum, capitalItem) => sum + normalizeNumber(capitalItem.montoRecibido),
    0
  );

  const ingresosCaja =
    normalizeNumber(ingresosCajaVentas._sum.montoConvertido) +
    normalizeNumber(ingresosCajaServicios._sum.montoConvertido);
  const egresosCajaTotal = normalizeNumber(egresosCaja._sum.montoConvertido);

  return {
    fecha: fechaInicio.toISOString().slice(0, 10),
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
  };
}

function buildInconsistencias(resumen: DailyCloseSummary): string[] {
  const inconsistencias: string[] = [];

  if (resumen.totalIngresos === 0 && resumen.totalGastos === 0) {
    inconsistencias.push('Sin movimientos operativos para el día.');
  }

  if (resumen.diferencia < 0) {
    inconsistencias.push('La operación del día cerró con diferencia negativa.');
  }

  if (resumen.ingresosCaja < resumen.egresosCaja) {
    inconsistencias.push('Los egresos de caja superan a los ingresos de caja.');
  }

  return inconsistencias;
}

export async function persistDailyClose(
  params: PersistDailyCloseParams
): Promise<PersistDailyCloseResult> {
  const txFactory = (prisma as Record<string, unknown>).$transaction as
    | ((callback: (tx: unknown) => Promise<PersistDailyCloseResult>) => Promise<PersistDailyCloseResult>)
    | undefined;

  if (!txFactory) {
    throw new CierreDiarioPersistenceUnavailableError();
  }

  const code = buildPeriodCode(TIPO_PERIODO.DIARIO, params.fecha);
  const resumen = await resolveDailySummary(params.fecha);
  const inconsistencias = buildInconsistencias(resumen);

  return txFactory(async (tx: unknown) => {
    const models = resolvePersistenceModels(tx);

    const periodo = await models.periodoContable.findFirst({
      where: { codigo: code, tipo: 'DIARIO' },
    });

    if (!periodo) {
      throw new DailyPeriodNotFoundError(code);
    }

    const existingSnapshot = await models.snapshotPeriodo.findFirst({
      where: { periodoId: periodo.periodoId },
      orderBy: { version: 'desc' },
    });

    if (existingSnapshot) {
      return {
        periodo,
        snapshot: existingSnapshot,
        resumen,
        wasCreated: false,
      };
    }

    const snapshot = await models.snapshotPeriodo.create({
      data: {
        periodoId: periodo.periodoId,
        version: 1,
        baseCajaJson: {
          ingresosCaja: resumen.ingresosCaja,
          egresosCaja: resumen.egresosCaja,
          saldoCajaFinal: resumen.saldoCajaFinal,
          saldoBancoFinal: resumen.saldoBancoFinal,
        },
        baseDevengoJson: {
          totalVentas: resumen.totalVentas,
          totalServicios: resumen.totalServicios,
          totalGastosDE: resumen.totalGastosDE,
          totalGastosCompra: resumen.totalGastosCompra,
          totalGastosSalarios: resumen.totalGastosSalarios,
          totalIngresos: resumen.totalIngresos,
          totalGastos: resumen.totalGastos,
          diferencia: resumen.diferencia,
        },
        inconsistenciasJson: inconsistencias,
        resumenJson: resumen,
      },
    });

    const periodoActualizado = await models.periodoContable.update({
      where: { periodoId: periodo.periodoId },
      data: {
        estado: 'CERRADO',
        fechaCierre: new Date(),
        cerradoPorId: params.usuarioId,
      },
    });

    return {
      periodo: periodoActualizado,
      snapshot,
      resumen,
      wasCreated: true,
    };
  });
}

export function isCierreDiarioPersistenceUnavailableError(
  error: unknown
): error is CierreDiarioPersistenceUnavailableError {
  return error instanceof CierreDiarioPersistenceUnavailableError;
}

export function isDailyPeriodNotFoundError(
  error: unknown
): error is DailyPeriodNotFoundError {
  return error instanceof DailyPeriodNotFoundError;
}
