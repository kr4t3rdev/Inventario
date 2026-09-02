import { classifyLegacyReconciliation } from '@/features/contabilidad/domain/reconciliation-policy';

/**
 * Registros crudos que alimentan la agregación de flujo de efectivo por moneda.
 */
export interface CashFlowRecords {
  reconciliacionesVentas: Array<Record<string, any>>;
  reconciliacionesServicios: Array<Record<string, any>>;
  reconciliacionesGastos: Array<Record<string, any>>;
  ajustesBancarios: Array<Record<string, any>>;
  inyeccionesCapital: Array<Record<string, any>>;
  pagosDeuda: Array<Record<string, any>>;
}

/**
 * Flags de capacidades del plan que controlan qué subconjuntos se agregan.
 */
export interface CashFlowFlags {
  includePrestamosCash: boolean;
  includeDeudasCash: boolean;
}

/**
 * Buckets de ingresos/egresos por moneda, espejo de la lógica canónica de reportes.
 */
export interface CashFlowBuckets {
  ingresosVentas: Record<string, number>;
  ingresosServicios: Record<string, number>;
  egresosGastos: Record<string, number>;
  ingresosAjustes: Record<string, number>;
  egresosAjustes: Record<string, number>;
  ingresosInyecciones: Record<string, number>;
  egresosPagosDeuda: Record<string, number>;
  ingresosPrestamosCash: Record<string, number>;
  egresosPrestamosCash: Record<string, number>;
  ingresosDeudasCash: Record<string, number>;
  egresosDeudasCash: Record<string, number>;
  clasificacionNoReconocida: number;
}

/**
 * Totales consolidados por moneda.
 */
export interface FlowTotals {
  totalIngresos: number;
  totalEgresos: number;
  saldoNeto: number;
}

/**
 * @description Agrega registros de reconciliación y operaciones en buckets por moneda.
 * Implementa la misma política de clasificación que el reporte de resumen canónico
 * para garantizar consistencia entre la ventana actual y la ventana anterior.
 * @param {CashFlowRecords} records - Registros crudos de la ventana a agregar.
 * @param {CashFlowFlags} flags - Capacidades del plan (préstamos y deudas cash).
 * @returns {CashFlowBuckets} Buckets por moneda con conteo de no reconocidas.
 */
export function aggregateCashFlow(
  records: CashFlowRecords,
  flags: CashFlowFlags,
): CashFlowBuckets {
  const buckets: CashFlowBuckets = {
    ingresosVentas: {},
    ingresosServicios: {},
    egresosGastos: {},
    ingresosAjustes: {},
    egresosAjustes: {},
    ingresosInyecciones: {},
    egresosPagosDeuda: {},
    ingresosPrestamosCash: {},
    egresosPrestamosCash: {},
    ingresosDeudasCash: {},
    egresosDeudasCash: {},
    clasificacionNoReconocida: 0,
  };

  const add = (bucket: Record<string, number>, moneda: string | null | undefined, monto: number) => {
    const key = moneda || 'CUP';
    bucket[key] = (bucket[key] || 0) + monto;
  };

  records.reconciliacionesVentas.forEach((r) => {
    const classification = classifyLegacyReconciliation({
      source: 'sale',
      kind: r.tipoReconciliacion,
    });
    if (classification.status === 'unclassified' || !classification.affectsCashFlow) {
      if (classification.status === 'unclassified') buckets.clasificacionNoReconocida += 1;
      return;
    }
    const monto = Number(r.monto);
    switch (classification.kind) {
      case 'SALE':
        add(buckets.ingresosVentas, r.moneda, monto);
        break;
      case 'CASH_LOAN_PAYMENT':
        if (flags.includePrestamosCash) add(buckets.ingresosPrestamosCash, r.moneda, monto);
        break;
      case 'CASH_LOAN_DISBURSEMENT':
        if (flags.includePrestamosCash) add(buckets.egresosPrestamosCash, r.moneda, monto);
        break;
      case 'CASH_DEBT_PAYMENT':
        if (flags.includeDeudasCash) add(buckets.egresosDeudasCash, r.moneda, monto);
        break;
      case 'CASH_DEBT_DISBURSEMENT':
        if (flags.includeDeudasCash) add(buckets.ingresosDeudasCash, r.moneda, monto);
        break;
      default:
        buckets.clasificacionNoReconocida += 1;
    }
  });

  records.reconciliacionesServicios.forEach((r) => {
    add(buckets.ingresosServicios, r.moneda, Number(r.monto));
  });

  records.reconciliacionesGastos.forEach((r) => {
    const classification = classifyLegacyReconciliation({
      source: 'expense',
      kind: r.tipoGasto,
      status: r.estado,
    });
    if (classification.status === 'unclassified') {
      buckets.clasificacionNoReconocida += 1;
      return;
    }
    if (!classification.affectsCashFlow) return;
    add(buckets.egresosGastos, r.moneda, Number(r.monto));
  });

  records.ajustesBancarios.forEach((r) => {
    if (r.tipo === 'ingreso') add(buckets.ingresosAjustes, r.moneda, Number(r.monto));
    else add(buckets.egresosAjustes, r.moneda, Number(r.monto));
  });

  records.inyeccionesCapital.forEach((r) => {
    add(buckets.ingresosInyecciones, r.moneda, Number(r.montoRecibido));
  });

  records.pagosDeuda.forEach((r) => {
    add(buckets.egresosPagosDeuda, r.cuentaBancaria?.moneda, Number(r.montoPagado));
  });

  return buckets;
}

/**
 * @description Consolida los buckets en totales por moneda.
 * @param {CashFlowBuckets} buckets - Buckets producidos por aggregateCashFlow.
 * @returns {Record<string, FlowTotals>} Totales por cada moneda presente en cualquier bucket.
 */
export function computeFlowTotals(buckets: CashFlowBuckets): Record<string, FlowTotals> {
  const monedas = new Set<string>();
  const bucketList: Array<Record<string, number>> = [
    buckets.ingresosVentas,
    buckets.ingresosServicios,
    buckets.egresosGastos,
    buckets.ingresosAjustes,
    buckets.egresosAjustes,
    buckets.ingresosInyecciones,
    buckets.egresosPagosDeuda,
    buckets.ingresosPrestamosCash,
    buckets.egresosPrestamosCash,
    buckets.ingresosDeudasCash,
    buckets.egresosDeudasCash,
  ];
  bucketList.forEach((bucket) => Object.keys(bucket).forEach((m) => monedas.add(m)));

  const totals: Record<string, FlowTotals> = {};
  monedas.forEach((moneda) => {
    const pick = (bucket: Record<string, number>) => bucket[moneda] || 0;
    const totalIngresos =
      pick(buckets.ingresosVentas) +
      pick(buckets.ingresosServicios) +
      pick(buckets.ingresosAjustes) +
      pick(buckets.ingresosInyecciones) +
      pick(buckets.ingresosPrestamosCash) +
      pick(buckets.ingresosDeudasCash);
    const totalEgresos =
      pick(buckets.egresosGastos) +
      pick(buckets.egresosAjustes) +
      pick(buckets.egresosPagosDeuda) +
      pick(buckets.egresosPrestamosCash) +
      pick(buckets.egresosDeudasCash);
    totals[moneda] = {
      totalIngresos,
      totalEgresos,
      saldoNeto: totalIngresos - totalEgresos,
    };
  });
  return totals;
}

const DAY_MS = 86_400_000;

function toUtcDay(fecha: string): number {
  return new Date(`${fecha.slice(0, 10)}T00:00:00.000Z`).getTime();
}

function toCivilDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * @description Deriva la ventana previa de igual duración a la ventana civil dada.
 * La ventana actual cubre [fechaInicio, fechaFin] inclusive en fechas civiles YYYY-MM-DD;
 * la previa termina el día anterior a fechaInicio y dura lo mismo.
 * @param {string} fechaInicio - Inicio civil de la ventana actual (inclusive).
 * @param {string} fechaFin - Fin civil de la ventana actual (inclusive).
 * @returns {{ fechaInicio: string; fechaFin: string }} Ventana previa en formato civil.
 */
export function computePreviousPeriodRange(
  fechaInicio: string,
  fechaFin: string,
): { fechaInicio: string; fechaFin: string } {
  const inicioMs = toUtcDay(fechaInicio);
  const finMs = toUtcDay(fechaFin);
  const lengthDays = Math.round((finMs - inicioMs) / DAY_MS) + 1;
  const prevFinMs = inicioMs - DAY_MS;
  const prevInicioMs = prevFinMs - (lengthDays - 1) * DAY_MS;
  return {
    fechaInicio: toCivilDate(prevInicioMs),
    fechaFin: toCivilDate(prevFinMs),
  };
}
