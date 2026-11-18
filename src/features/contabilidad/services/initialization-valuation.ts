import { ActionError } from '@/lib/server-actions';
import { buildFunctionalValuation } from '@/features/contabilidad-formal/lib/functional-valuation';
import type { InitializationData } from './initialization-contract';

export interface ValuedOpeningAccount {
  index: number;
  numeroCuenta: string;
  nombreCuenta: string;
  moneda: string;
  saldoOriginal: string;
  tasaCambio: number | null;
  montoFuncional: number;
  fxEvidenceFingerprint: string | null;
  sameCurrency: boolean;
}

const EVIDENCE_SOURCE = 'INICIALIZACION_CONTABLE';

/**
 * @description Valora las cuentas de una apertura a la moneda funcional.
 * La tasa sale del mapa por moneda y, si la moneda no está en el mapa, de la
 * tasa declarada en el origen de la cuenta. Un saldo extranjero sin tasa
 * falla cerrado; un saldo cero no exige tasa ni genera evidencia FX.
 */
export function valueOpeningAccounts(
  input: Pick<InitializationData, 'fechaCorte' | 'monedaFuncional' | 'tasas' | 'cuentas'>,
): ValuedOpeningAccount[] {
  const [year, month, day] = input.fechaCorte.split('-').map(Number);
  const fechaOperacion = new Date(Date.UTC(year, month - 1, day));
  return input.cuentas.map((cuenta, index) => {
    const saldo = Number(cuenta.saldoInicial);
    if (saldo === 0) {
      return {
        index,
        numeroCuenta: cuenta.numeroCuenta,
        nombreCuenta: cuenta.nombreCuenta,
        moneda: cuenta.moneda,
        saldoOriginal: cuenta.saldoInicial,
        tasaCambio: null,
        montoFuncional: 0,
        fxEvidenceFingerprint: null,
        sameCurrency: cuenta.moneda === input.monedaFuncional,
      };
    }
    const rateFromMap = input.tasas?.[cuenta.moneda];
    const rate = rateFromMap !== undefined
      ? Number(rateFromMap)
      : cuenta.origen?.tasaCambio !== undefined
        ? Number(cuenta.origen.tasaCambio)
        : undefined;
    const valuation = buildFunctionalValuation({
      monto: saldo,
      moneda: cuenta.moneda,
      functionalCurrency: input.monedaFuncional,
      tasaCambio: rate,
      fechaOperacion,
      source: EVIDENCE_SOURCE,
    });
    if (valuation.montoConvertido === null && !valuation.sameCurrency) {
      throw new ActionError(
        `Indica la tasa de cambio de ${cuenta.moneda} a ${input.monedaFuncional}`,
        'TASA_CAMBIO_REQUERIDA',
      );
    }
    return {
      index,
      numeroCuenta: cuenta.numeroCuenta,
      nombreCuenta: cuenta.nombreCuenta,
      moneda: cuenta.moneda,
      saldoOriginal: cuenta.saldoInicial,
      tasaCambio: valuation.tasaCambio,
      montoFuncional: valuation.sameCurrency ? saldo : (valuation.montoConvertido ?? 0),
      fxEvidenceFingerprint: valuation.fxEvidenceFingerprint,
      sameCurrency: valuation.sameCurrency,
    };
  });
}
