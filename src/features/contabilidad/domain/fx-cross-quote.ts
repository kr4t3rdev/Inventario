import { Prisma } from '@/generated/prisma';
import { PrismaExchangeRateProvider } from '../services/exchange-rate-provider';

/** Estrategia con la que se resolvió la cotización cruzada. */
export type CrossQuoteKind = 'DIRECT' | 'INVERSE' | 'TRIANGULATED';

/** Pata from → moneda funcional del catálogo, para la valoración contable. */
export interface CrossQuoteFunctionalLeg {
  rate: Prisma.Decimal;
  catalogRateId: string;
  rateEffectiveAt: Date;
}

/** Cotización cruzada resuelta desde el catálogo de tasas. */
export interface CrossQuoteResolution {
  /** Tasa from → to con precisión Decimal completa (sin redondeo). */
  rate: Prisma.Decimal;
  kind: CrossQuoteKind;
  /** Ids de catálogo que respaldan la cotización (1 directo/inverso, 2 triangulado). */
  catalogRateIds: string[];
  /** Vigencia de la cotización (máximo de las patas en triangulación). */
  rateEffectiveAt: Date;
  /** Pata from → funcional para la valoración contable; null si el catálogo no la tiene. */
  functionalLeg: CrossQuoteFunctionalLeg | null;
}

export interface ResolveCrossQuoteInput {
  /** Cliente transaccional (o prisma) para la búsqueda histórica. */
  client: unknown;
  from: string;
  to: string;
  functionalCurrency: string;
  /** Fecha de la operación: la tasa debe tener fechaVigencia <= at. */
  at: Date;
}

function toLeg(row: { tasa: Prisma.Decimal; tasaId: string; fechaVigencia: Date }): CrossQuoteFunctionalLeg {
  return { rate: row.tasa, catalogRateId: row.tasaId, rateEffectiveAt: row.fechaVigencia };
}

/**
 * @description Resuelve una cotización cruzada A→B desde el catálogo `TasaCambio`.
 * Orden determinista: par directo → par inverso (1/tasa) → triangulación vía la
 * moneda funcional (tasa(A→F)/tasa(B→F)). La búsqueda es histórica: solo tasas con
 * fechaVigencia <= fecha de la operación. Nunca inventa una tasa: sin cobertura
 * devuelve null para fallar cerrado.
 * @param {ResolveCrossQuoteInput} input - Par, funcional, fecha y cliente de búsqueda.
 * @returns {Promise<CrossQuoteResolution | null>} Cotización resuelta o null.
 */
export async function resolveCrossQuote(
  input: ResolveCrossQuoteInput,
): Promise<CrossQuoteResolution | null> {
  const from = input.from.trim().toUpperCase();
  const to = input.to.trim().toUpperCase();
  const functional = input.functionalCurrency.trim().toUpperCase();
  if (!from || !to || !functional || from === to) return null;

  const provider = new PrismaExchangeRateProvider();
  const client = input.client as Parameters<PrismaExchangeRateProvider['getRateAsOfExact']>[0]['client'];

  // 1. Par directo A→B.
  const direct = await provider.getRateAsOfExact({
    sourceCurrency: from,
    targetCurrency: to,
    boundaryAt: input.at,
    client,
  });
  // 2. Par inverso B→A (se usa 1/tasa con precisión completa).
  const inverse = direct
    ? null
    : await provider.getRateAsOfExact({
        sourceCurrency: to,
        targetCurrency: from,
        boundaryAt: input.at,
        client,
      });
  // 3. Pata A→F: obligatoria para la valoración contable del asiento.
  const functionalLegRow = await provider.getRateAsOfExact({
    sourceCurrency: from,
    targetCurrency: functional,
    boundaryAt: input.at,
    client,
  });

  if (direct) {
    return {
      rate: direct.tasa,
      kind: 'DIRECT',
      catalogRateIds: [direct.tasaId],
      rateEffectiveAt: direct.fechaVigencia,
      functionalLeg: functionalLegRow ? toLeg(functionalLegRow) : null,
    };
  }
  if (inverse) {
    return {
      rate: new Prisma.Decimal(1).div(inverse.tasa),
      kind: 'INVERSE',
      catalogRateIds: [inverse.tasaId],
      rateEffectiveAt: inverse.fechaVigencia,
      functionalLeg: functionalLegRow ? toLeg(functionalLegRow) : null,
    };
  }
  // 4. Triangulación vía la moneda funcional: tasa(A→B) = tasa(A→F) / tasa(B→F).
  const destLegRow = await provider.getRateAsOfExact({
    sourceCurrency: to,
    targetCurrency: functional,
    boundaryAt: input.at,
    client,
  });
  if (functionalLegRow && destLegRow) {
    return {
      rate: functionalLegRow.tasa.div(destLegRow.tasa),
      kind: 'TRIANGULATED',
      catalogRateIds: [functionalLegRow.tasaId, destLegRow.tasaId],
      rateEffectiveAt: new Date(
        Math.max(
          functionalLegRow.fechaVigencia.getTime(),
          destLegRow.fechaVigencia.getTime(),
        ),
      ),
      functionalLeg: toLeg(functionalLegRow),
    };
  }
  return null;
}
