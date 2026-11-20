import { Prisma } from '@/generated/prisma';
import type { InitializationData } from './initialization-contract';
import type { ValuedOpeningAccount } from './initialization-valuation';

export type OpeningCounterpartRol = 'CAPITAL_SOCIAL' | 'DEUDAS_RECIBIDAS' | 'RESULTADOS_ACUMULADOS';

export type OpeningEntryLine = {
  index: number;
  numeroCuenta: string;
  lado: 'DEBE' | 'HABER';
  rolCuenta: 'BANCOS' | OpeningCounterpartRol;
  moneda: string;
  montoOriginal: string;
  tasaCambio: number | null;
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
 * deuda o resultados acumulados para saldos no documentados). Los anticipos
 * quedan fuera: su asiento lo emite su propio flujo. El balance se comprueba
 * sobre los importes funcionales redondeados que se van a contabilizar.
 */
export function buildOpeningEntryLines(input: {
  cuentas: InitializationData['cuentas'];
  valued: ValuedOpeningAccount[];
  monedaFuncional: string;
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
  const totalDebeFuncional = totalDebe.toString();
  const totalHaberFuncional = totalHaber.toString();
  const balanced = totalDebe.equals(totalHaber);
  if (!balanced) {
    throw new Error('Las líneas de apertura no balancean en moneda funcional');
  }
  return { lines, totalDebeFuncional, totalHaberFuncional, balanced, excludedAnticipoIndexes };
}
