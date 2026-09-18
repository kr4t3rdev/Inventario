import type { Prisma, PrismaClient } from '@/generated/prisma';

import { prisma as defaultPrisma } from '@/lib/prisma';

import type {
  ExchangeCurrentRatesResult,
  ExchangeCurrencyRecord,
  ExchangeRateHistoryFilters,
  ExchangeRateHistoryResult,
  ExchangeRateRecord,
  ExchangeRateProvider,
} from './exchange-types';

function toIso(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function toCurrencyRecord(row: {
  codigo: string;
  nombre: string;
  simbolo: string;
  esPrincipal: boolean;
  isActive: boolean;
}): ExchangeCurrencyRecord {
  return {
    codigo: row.codigo,
    nombre: row.nombre,
    simbolo: row.simbolo,
    esPrincipal: row.esPrincipal,
    isActive: row.isActive,
  };
}

function toRateRecord(row: {
  tasaId: string;
  monedaOrigenId: string;
  monedaDestino: string;
  tasa: number | string | { toNumber?: () => number };
  fechaVigencia: Date | string;
  createdAt?: Date | string;
}): ExchangeRateRecord {
  const rateValue =
    typeof row.tasa === 'number'
      ? row.tasa
      : typeof row.tasa === 'string'
        ? Number(row.tasa)
        : row.tasa.toNumber?.() ?? Number(row.tasa);

  return {
    tasaId: row.tasaId,
    monedaOrigenId: row.monedaOrigenId,
    monedaDestino: row.monedaDestino,
    tasa: rateValue,
    fechaVigencia: toIso(row.fechaVigencia),
    createdAt: row.createdAt ? toIso(row.createdAt) : undefined,
  };
}

export class PrismaExchangeRateProvider implements ExchangeRateProvider {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async getCurrency(codigo: string): Promise<ExchangeCurrencyRecord | null> {
    const moneda = await this.db.moneda.findUnique({ where: { codigo } });
    return moneda ? toCurrencyRecord(moneda) : null;
  }

  async getPrincipalCurrency(client?: Prisma.TransactionClient): Promise<ExchangeCurrencyRecord | null> {
    const db = client ?? this.db;
    await this.ensureDefaultCurrencies(db);

    let moneda = await db.moneda.findFirst({ where: { esPrincipal: true } });

    if (!moneda) {
      moneda = await db.moneda.upsert({
        where: { codigo: 'CUP' },
        update: { esPrincipal: true, isActive: true },
        create: {
          codigo: 'CUP',
          nombre: 'Peso Cubano',
          simbolo: '₱',
          esPrincipal: true,
          isActive: true,
        },
      });
    }

    return moneda ? toCurrencyRecord(moneda) : null;
  }

  /**
   * @description Selecciona de forma determinista la tasa vigente más reciente sin exceder
   * el límite temporal indicado (orden fechaVigencia DESC, createdAt DESC, tasaId DESC).
   * @param {object} params - Moneda origen/destino y límite temporal de elegibilidad.
   * @returns {Promise<{tasaId: string; tasa: number; fechaVigencia: Date} | null>} Tasa elegible o null.
   */
  async getRateAsOf(params: {
    sourceCurrency: string;
    targetCurrency?: string;
    boundaryAt: Date;
    client?: Prisma.TransactionClient;
  }): Promise<{ tasaId: string; tasa: number; fechaVigencia: Date } | null> {
    const source = params.sourceCurrency?.trim().toUpperCase();
    if (!source) return null;
    const target = params.targetCurrency?.trim().toUpperCase() || 'CUP';
    const db = params.client ?? defaultPrisma;

    const rate = await db.tasaCambio.findFirst({
      where: {
        monedaOrigenId: source,
        monedaDestino: target,
        fechaVigencia: { lte: params.boundaryAt },
      },
      orderBy: [{ fechaVigencia: 'desc' }, { createdAt: 'desc' }, { tasaId: 'desc' }],
      take: 1,
      select: { tasaId: true, tasa: true, fechaVigencia: true },
    });
    if (!rate) return null;
    return { tasaId: rate.tasaId, tasa: Number(rate.tasa), fechaVigencia: rate.fechaVigencia };
  }

  async listCurrencies(): Promise<ExchangeCurrencyRecord[]> {
    // Asegurar que existan las monedas por defecto
    await this.ensureDefaultCurrencies();

    const monedas = await this.db.moneda.findMany({
      orderBy: [{ esPrincipal: 'desc' }, { codigo: 'asc' }],
    });

    return monedas.map(toCurrencyRecord);
  }

  /**
   * @description Crea las monedas por defecto si no existen (CUP como principal, USD como secundaria).
   */
  private async ensureDefaultCurrencies(
    db: PrismaClient | Prisma.TransactionClient = this.db,
  ): Promise<void> {
    try {
      // Crear CUP (moneda principal) si no existe
      await db.moneda.upsert({
        where: { codigo: 'CUP' },
        update: {},
        create: {
          codigo: 'CUP',
          nombre: 'Peso Cubano',
          simbolo: '₱',
          esPrincipal: true,
          isActive: true,
        },
      });

      // Crear USD (moneda secundaria común) si no existe
      await db.moneda.upsert({
        where: { codigo: 'USD' },
        update: {},
        create: {
          codigo: 'USD',
          nombre: 'Dólar Estadounidense',
          simbolo: '$',
          esPrincipal: false,
          isActive: true,
        },
      });
    } catch (error) {
      // Si falla, no bloquear la operación - solo loguear
      console.error('Error al crear monedas por defecto:', error);
    }
  }

  async getLatestRate(
    monedaOrigenId: string,
    monedaDestino: string,
  ): Promise<ExchangeRateRecord | null> {
    const tasa = await this.db.tasaCambio.findFirst({
      where: { monedaOrigenId, monedaDestino },
      orderBy: [{ fechaVigencia: 'desc' }, { createdAt: 'desc' }, { tasaId: 'desc' }],
    });

    return tasa ? toRateRecord(tasa) : null;
  }

  async getCurrentRates(): Promise<ExchangeCurrentRatesResult> {
    await this.ensureDefaultCurrencies();

    const [monedas, tasas] = await Promise.all([
      this.db.moneda.findMany({ orderBy: [{ esPrincipal: 'desc' }, { codigo: 'asc' }] }),
      this.db.tasaCambio.findMany({
        orderBy: [{ fechaVigencia: 'desc' }, { createdAt: 'desc' }, { tasaId: 'desc' }],
        distinct: ['monedaOrigenId'],
      }),
    ]);

    const monedaPrincipal = monedas.find((moneda) => moneda.esPrincipal) ?? monedas[0] ?? null;

    return {
      monedaPrincipal: monedaPrincipal ? toCurrencyRecord(monedaPrincipal) : null,
      tasas: tasas.map((tasa) => ({
        ...toRateRecord(tasa),
        ruta: 'direct',
        effectiveAt: toIso(tasa.fechaVigencia),
      })),
    };
  }

  async getRateHistory(
    filters: ExchangeRateHistoryFilters = {},
  ): Promise<ExchangeRateHistoryResult> {
    const page = filters.pagina ?? 1;
    const limit = filters.limite ?? 20;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (filters.monedaOrigen) {
      where.monedaOrigenId = filters.monedaOrigen;
    }

    if (filters.fechaDesde || filters.fechaHasta) {
      where.fechaVigencia = {};
      if (filters.fechaDesde) {
        (where.fechaVigencia as Record<string, unknown>).gte = new Date(filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        (where.fechaVigencia as Record<string, unknown>).lte = new Date(filters.fechaHasta);
      }
    }

    const [tasas, total] = await Promise.all([
      this.db.tasaCambio.findMany({
        where,
        orderBy: [{ fechaVigencia: 'desc' }, { createdAt: 'desc' }, { tasaId: 'desc' }],
        skip,
        take: limit,
      }),
      this.db.tasaCambio.count({ where }),
    ]);

    const mapped = tasas.map((tasa) => {
      const row = toRateRecord(tasa);
      return {
        ...row,
        creadoPor: (tasa as { creadoPor?: string | null }).creadoPor ?? null,
        provenance:
          (tasa as { creadoPor?: string | null; creador?: string | null }).creadoPor ??
          (tasa as { creador?: string | null }).creador ??
          null,
      };
    });

    return {
      tasas: mapped,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createRate(input: {
    monedaOrigenId: string;
    monedaDestino: string;
    tasa: number;
  }): Promise<ExchangeRateRecord> {
    const tasa = await this.db.tasaCambio.create({
      data: {
        monedaOrigenId: input.monedaOrigenId,
        monedaDestino: input.monedaDestino,
        tasa: input.tasa,
        fechaVigencia: new Date(),
      },
    });

    return toRateRecord(tasa);
  }
}

export const exchangeRateProvider = new PrismaExchangeRateProvider();
