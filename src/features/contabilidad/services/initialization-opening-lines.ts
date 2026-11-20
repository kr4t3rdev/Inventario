import { Prisma } from '@/generated/prisma';
import type { InitializationData } from './initialization-contract';
import type { ValuedOpeningAccount } from './initialization-valuation';

export type OpeningCounterpartRol = 'CAPITAL_SOCIAL' | 'DEUDAS_RECIBIDAS' | 'RESULTADOS_ACUMULADOS';

export type OpeningEntryLine = {
  index: number;
  numeroCuenta: string;
  lado: 'DEBE' | 'HABER';
  rolCuenta: 'BANCOS' | 'INVENTARIOS' | 'CXC_CLIENTES' | 'CXP_PROVEEDORES' | OpeningCounterpartRol;
  moneda: string;
  montoOriginal: string;
  tasaCambio: number | null;
  montoFuncional: string;
  fxEvidenceFingerprint: string | null;
};

/**
 * @description Fila de submayor ya valorada en moneda funcional, lista para
 * su pierna del asiento de apertura. La tasa llega como texto y se convierte
 * a número al construir la línea, como la valoración de cuentas.
 */
export type OpeningSubledgerRow = {
  referenciaFila: string;
  moneda: string;
  montoOriginal: string;
  tasaCambio: string | null;
  montoFuncional: string;
  fxEvidenceFingerprint: string | null;
};

export type OpeningEntryLines = {
  lines: OpeningEntryLine[];
  totalDebeFuncional: string;
  totalHaberFuncional: string;
  balanced: boolean;
  excludedAnticipoIndexes: number[];
};

/**
 * @description Construye las líneas del asiento de apertura desde las cuentas
 * valoradas: cada cuenta debita Bancos y acredita su contrapartida (capital,
 * deuda o resultados acumulados para saldos no documentados). El inventario
 * debita Inventarios contra Resultados acumulados. Cada fila de CxC debita
 * CxC contra Resultados acumulados y cada fila de CxP debita Resultados
 * acumulados contra CxP, una pierna por fila para conservar su evidencia FX.
 * Los anticipos quedan fuera: su asiento lo emite su propio flujo. El balance
 * se comprueba sobre los importes funcionales redondeados que se van a contabilizar.
 * Los índices agrupan las dos piernas de cada fila y no se reutilizan entre
 * bancos, inventario y submayor.
 */
export function buildOpeningEntryLines(input: {
  cuentas: InitializationData['cuentas'];
  valued: ValuedOpeningAccount[];
  monedaFuncional: string;
  initialInventoryTotalFuncional?: string;
  cuentasPorCobrar?: OpeningSubledgerRow[];
  cuentasPorPagar?: OpeningSubledgerRow[];
}): OpeningEntryLines {
  const lines: OpeningEntryLine[] = [];
  const excludedAnticipoIndexes: number[] = [];
  let totalDebe = new Prisma.Decimal(0);
  let totalHaber = new Prisma.Decimal(0);
  input.cuentas.forEach((cuenta, index) => {
    const v = input.valued[index];
    if (!v || v.numeroCuenta !== cuenta.numeroCuenta) {
      throw new Error('La valoración de la apertura no coincide con las cuentas');
    }
    if (Number(cuenta.saldoInicial) === 0) return;
    if (cuenta.origen?.tipo === 'ANTICIPO') {
      excludedAnticipoIndexes.push(index);
      return;
    }
    const counterpart: OpeningCounterpartRol =
      cuenta.origen?.tipo === 'CAPITAL_SOCIAL'
        ? 'CAPITAL_SOCIAL'
        : cuenta.origen?.tipo === 'PRESTAMO'
          ? 'DEUDAS_RECIBIDAS'
          : cuenta.origenNoDocumentado
            ? 'RESULTADOS_ACUMULADOS'
            : (() => {
              throw new Error(`La cuenta ${cuenta.numeroCuenta} no tiene contrapartida de apertura`);
            })();
    const montoFuncional = new Prisma.Decimal(v.montoFuncional).toString();
    lines.push({
      index,
      numeroCuenta: cuenta.numeroCuenta,
      lado: 'DEBE',
      rolCuenta: 'BANCOS',
      moneda: cuenta.moneda,
      montoOriginal: cuenta.saldoInicial,
      tasaCambio: v.tasaCambio,
      montoFuncional,
      fxEvidenceFingerprint: v.fxEvidenceFingerprint,
    });
    lines.push({
      index,
      numeroCuenta: cuenta.numeroCuenta,
      lado: 'HABER',
      rolCuenta: counterpart,
      moneda: cuenta.moneda,
      montoOriginal: cuenta.saldoInicial,
      tasaCambio: v.tasaCambio,
      montoFuncional,
      fxEvidenceFingerprint: v.fxEvidenceFingerprint,
    });
    totalDebe = totalDebe.add(new Prisma.Decimal(v.montoFuncional));
    totalHaber = totalHaber.add(new Prisma.Decimal(v.montoFuncional));
  });
  const inventoryTotal = new Prisma.Decimal(input.initialInventoryTotalFuncional ?? 0)
    .toDecimalPlaces(4);
  if (inventoryTotal.greaterThan(0)) {
    const inventoryIndex = input.cuentas.length;
    const amount = inventoryTotal.toString();
    lines.push({
      index: inventoryIndex,
      numeroCuenta: 'INVENTARIO_INICIAL',
      lado: 'DEBE',
      rolCuenta: 'INVENTARIOS',
      moneda: input.monedaFuncional,
      montoOriginal: amount,
      tasaCambio: null,
      montoFuncional: amount,
      fxEvidenceFingerprint: null,
    });
    lines.push({
      index: inventoryIndex,
      numeroCuenta: 'INVENTARIO_INICIAL',
      lado: 'HABER',
      rolCuenta: 'RESULTADOS_ACUMULADOS',
      moneda: input.monedaFuncional,
      montoOriginal: amount,
      tasaCambio: null,
      montoFuncional: amount,
      fxEvidenceFingerprint: null,
    });
    totalDebe = totalDebe.add(inventoryTotal);
    totalHaber = totalHaber.add(inventoryTotal);
  }
  let subledgerIndex = input.cuentas.length + 1;
  const subledgerSections = [
    { rows: input.cuentasPorCobrar ?? [], debitRol: 'CXC_CLIENTES' as const, creditRol: 'RESULTADOS_ACUMULADOS' as const },
    { rows: input.cuentasPorPagar ?? [], debitRol: 'RESULTADOS_ACUMULADOS' as const, creditRol: 'CXP_PROVEEDORES' as const },
  ];
  subledgerSections.forEach(({ rows, debitRol, creditRol }) => {
    rows.forEach((row) => {
      const index = subledgerIndex++;
      const montoFuncional = new Prisma.Decimal(row.montoFuncional).toDecimalPlaces(4).toString();
      const tasaCambio = row.tasaCambio === null ? null : Number(row.tasaCambio);
      lines.push({
        index,
        numeroCuenta: row.referenciaFila,
        lado: 'DEBE',
        rolCuenta: debitRol,
        moneda: row.moneda,
        montoOriginal: row.montoOriginal,
        tasaCambio,
        montoFuncional,
        fxEvidenceFingerprint: row.fxEvidenceFingerprint,
      });
      lines.push({
        index,
        numeroCuenta: row.referenciaFila,
        lado: 'HABER',
        rolCuenta: creditRol,
        moneda: row.moneda,
        montoOriginal: row.montoOriginal,
        tasaCambio,
        montoFuncional,
        fxEvidenceFingerprint: row.fxEvidenceFingerprint,
      });
      totalDebe = totalDebe.add(new Prisma.Decimal(montoFuncional));
      totalHaber = totalHaber.add(new Prisma.Decimal(montoFuncional));
    });
  });
  const totalDebeFuncional = totalDebe.toString();
  const totalHaberFuncional = totalHaber.toString();
  const balanced = totalDebe.equals(totalHaber);
  if (!balanced) {
    throw new Error('Las líneas de apertura no balancean en moneda funcional');
  }
  return { lines, totalDebeFuncional, totalHaberFuncional, balanced, excludedAnticipoIndexes };
}
