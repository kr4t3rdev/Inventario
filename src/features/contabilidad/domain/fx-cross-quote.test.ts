import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { resolveCrossQuote } from './fx-cross-quote';

const VIGENCIA = new Date('2026-01-01T00:00:00.000Z');
const AT = new Date('2026-10-05T12:00:00.000Z');

function fila(tasaId: string, tasa: string, fechaVigencia = VIGENCIA) {
  return { tasaId, tasa: new Prisma.Decimal(tasa), fechaVigencia };
}

function cliente(rows: Record<string, ReturnType<typeof fila> | null>) {
  const findFirst = vi.fn(async ({ where }: any) => {
    const key = `${where.monedaOrigenId}→${where.monedaDestino}`;
    const row = rows[key] ?? null;
    if (!row) return null;
    // El provider solo pide fechaVigencia <= boundaryAt.
    if (row.fechaVigencia > AT) return null;
    return row;
  });
  return { tasaCambio: { findFirst } };
}

describe('resolveCrossQuote (FX-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resuelve par directo del catálogo con pata funcional', async () => {
    const client = cliente({
      'EUR→GBP': fila('t-direct', '0.85'),
      'EUR→USD': fila('t-eur-usd', '1.1'),
    });
    const q = await resolveCrossQuote({ client, from: 'EUR', to: 'GBP', functionalCurrency: 'USD', at: AT });
    expect(q?.kind).toBe('DIRECT');
    expect(q?.rate.toString()).toBe('0.85');
    expect(q?.catalogRateIds).toEqual(['t-direct']);
    expect(q?.rateEffectiveAt).toEqual(VIGENCIA);
    expect(q?.functionalLeg?.rate.toString()).toBe('1.1');
    expect(q?.functionalLeg?.catalogRateId).toBe('t-eur-usd');
  });

  it('resuelve par inverso como 1/tasa con precisión completa', async () => {
    const client = cliente({
      'GBP→EUR': fila('t-inv', '1.1764705882352942'),
      'EUR→USD': fila('t-eur-usd', '1.1'),
    });
    const q = await resolveCrossQuote({ client, from: 'EUR', to: 'GBP', functionalCurrency: 'USD', at: AT });
    expect(q?.kind).toBe('INVERSE');
    expect(q?.catalogRateIds).toEqual(['t-inv']);
    // 1/1.1764705882352942 en Decimal exacto (20 dígitos significativos). La tasa
    // informada viene truncada, así que el inverso no es 0.85 redondo; se persiste
    // con precisión completa y el importe destino se redondea a 4 decimales aparte.
    expect(q?.rate.toString()).toBe('0.8499999999999999405');
  });

  it('triangula vía la funcional cuando no hay par directo ni inverso', async () => {
    const client = cliente({
      'EUR→USD': fila('t-eur-usd', '1.1'),
      'GBP→USD': fila('t-gbp-usd', '1.25', new Date('2026-02-01T00:00:00.000Z')),
    });
    const q = await resolveCrossQuote({ client, from: 'EUR', to: 'GBP', functionalCurrency: 'USD', at: AT });
    expect(q?.kind).toBe('TRIANGULATED');
    // 1.1 / 1.25 = 0.88 exacto.
    expect(q?.rate.toString()).toBe('0.88');
    expect(q?.catalogRateIds).toEqual(['t-eur-usd', 't-gbp-usd']);
    // La vigencia es el máximo de las dos patas.
    expect(q?.rateEffectiveAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    expect(q?.functionalLeg?.rate.toString()).toBe('1.1');
  });

  it('devuelve null sin cobertura de catálogo (fail closed)', async () => {
    const client = cliente({});
    const q = await resolveCrossQuote({ client, from: 'EUR', to: 'GBP', functionalCurrency: 'USD', at: AT });
    expect(q).toBeNull();
  });

  it('devuelve null si falta la pata destino para triangular', async () => {
    const client = cliente({
      'EUR→USD': fila('t-eur-usd', '1.1'),
    });
    const q = await resolveCrossQuote({ client, from: 'EUR', to: 'GBP', functionalCurrency: 'USD', at: AT });
    expect(q).toBeNull();
  });

  it('marca functionalLeg null si el par directo no tiene pata funcional', async () => {
    const client = cliente({
      'EUR→GBP': fila('t-direct', '0.85'),
    });
    const q = await resolveCrossQuote({ client, from: 'EUR', to: 'GBP', functionalCurrency: 'USD', at: AT });
    expect(q?.kind).toBe('DIRECT');
    expect(q?.functionalLeg).toBeNull();
  });

  it('devuelve null para misma moneda', async () => {
    const client = cliente({});
    const q = await resolveCrossQuote({ client, from: 'USD', to: 'USD', functionalCurrency: 'USD', at: AT });
    expect(q).toBeNull();
  });

  it('ignora tasas con vigencia posterior a la operación', async () => {
    const client = cliente({
      'EUR→GBP': fila('t-futura', '0.85', new Date('2027-01-01T00:00:00.000Z')),
    });
    const q = await resolveCrossQuote({ client, from: 'EUR', to: 'GBP', functionalCurrency: 'USD', at: AT });
    expect(q).toBeNull();
  });
});
