'use server';

import { randomUUID } from 'crypto';

import { revalidatePath } from 'next/cache';

import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { withAction, ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { requireFeature } from '@/lib/services/tenant-scope';

import { CurrencyConversionService } from '@/lib/services/currency-conversion-service';

import {
  exchangeRateProvider,
} from './services/exchange-rate-provider';
import { ExchangeRateReadService } from './services/exchange-rate-read-service';
import { ExchangeServiceError } from './services/exchange-types';

const exchangeReadService = new ExchangeRateReadService(exchangeRateProvider);

function requireMultiCurrency(user: AuthenticatedUser, action: string): void {
  requireFeature(user, 'multi-moneda', action);
}

function mapExchangeError(error: unknown): never {
  if (error instanceof ExchangeServiceError) {
    throw new ActionError(error.message, error.code);
  }

  throw error instanceof Error ? error : new Error('Error de exchange');
}

export const getMonedasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  return exchangeReadService.getMonedas();
});

export const getTasasActualesAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  return exchangeReadService.getCurrentRates();
});

export const convertMoneyAction = withAction(
  async (
    input: { monto: number; monedaOrigen: string; monedaDestino: string; referenciaId?: string },
    user: AuthenticatedUser,
  ) => {
    requireMultiCurrency(user, 'usar exchange');

    try {
      const quote = await CurrencyConversionService.quoteConversion(input, exchangeRateProvider);
      const referenciaId = input.referenciaId ?? `exchange:${randomUUID()}`;

      await prisma.$transaction(async (tx) => {
        await tx.transaccionMoneda.create({
          data: {
            tenantId: user.tenantId,
            tipoTransaccion: 'exchange',
            referenciaId,
            monedaId: quote.monedaOrigen,
            montoOriginal: quote.montoOriginal,
            tasaCambio: quote.tasaAplicada,
            montoConvertido: quote.montoConvertido,
          },
        });

        await AuditLogService.logStrict(
          {
            accion: 'CREATE',
            entidad: 'ESCENARIO_EXCHANGE',
            entidadId: referenciaId,
            usuarioId: user.userId,
            detalles: {
              monedaOrigen: quote.monedaOrigen,
              monedaDestino: quote.monedaDestino,
              ruta: quote.ruta,
              tasaAplicada: quote.tasaAplicada,
              montoOriginal: quote.montoOriginal,
              montoConvertido: quote.montoConvertido,
            },
          },
          tx,
        );
      });

      revalidatePath('/busy/contabilidad/exchange');

      return {
        ...quote,
        montoConvertido: quote.montoConvertido,
        tasaUsada: quote.tasaAplicada,
        referenciaId,
      };
    } catch (error) {
      mapExchangeError(error);
    }
  },
);

export const createMonedaAction = withAction(
  async (
    input: { codigo: string; nombre: string; simbolo: string; esPrincipal?: boolean },
    user: AuthenticatedUser,
  ) => {
    requireMultiCurrency(user, 'gestionar monedas');
    const existing = await prisma.moneda.findUnique({ where: { codigo: input.codigo.toUpperCase() } });
    if (existing) {
      throw new ActionError('Ya existe una moneda con ese código', 'DUPLICATE');
    }

    const moneda = await prisma.$transaction(async (tx) => {
      if (input.esPrincipal) {
        await tx.moneda.updateMany({ where: { esPrincipal: true }, data: { esPrincipal: false } });
      }

      const creada = await tx.moneda.create({
        data: {
          codigo: input.codigo.toUpperCase(),
          nombre: input.nombre,
          simbolo: input.simbolo,
          esPrincipal: input.esPrincipal ?? false,
          isActive: true,
        },
      });

      await AuditLogService.logStrict(
        {
          accion: 'CREATE',
          entidad: 'MONEDA',
          entidadId: creada.codigo,
          usuarioId: user.userId,
          detalles: { codigo: creada.codigo, nombre: creada.nombre, simbolo: creada.simbolo },
        },
        tx,
      );

      return creada;
    });

    revalidatePath('/busy/contabilidad/exchange');
    return moneda;
  },
);

export const updateMonedaAction = withAction(
  async (
    input: { codigo: string; nombre?: string; simbolo?: string; esPrincipal?: boolean; isActive?: boolean },
    user: AuthenticatedUser,
  ) => {
    requireMultiCurrency(user, 'gestionar monedas');
    const { codigo, ...data } = input;
    const existing = await prisma.moneda.findUnique({ where: { codigo } });
    if (!existing) {
      throw new ActionError('Moneda no encontrada', 'NOT_FOUND');
    }

    const moneda = await prisma.$transaction(async (tx) => {
      if (data.esPrincipal) {
        await tx.moneda.updateMany({
          where: { codigo: { not: codigo }, esPrincipal: true },
          data: { esPrincipal: false },
        });
      }

      const actualizada = await tx.moneda.update({ where: { codigo }, data });

      await AuditLogService.logStrict(
        {
          accion: 'UPDATE',
          entidad: 'MONEDA',
          entidadId: codigo,
          usuarioId: user.userId,
          detalles: { cambios: data },
        },
        tx,
      );

      return actualizada;
    });

    revalidatePath('/busy/contabilidad/exchange');
    return moneda;
  },
);

/**
 * @description Registra una tasa contra la moneda principal usando el contrato compartido de exchange.
 * @param {{ monedaOrigenId: string; monedaDestino: string; tasa: number }} input - Datos de la tasa.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Resultado de la creación o una ActionError tipada.
 */
export const updateTasaCambioAction = withAction(
  async (
    input: { monedaOrigenId: string; monedaDestino: string; tasa: number },
    user: AuthenticatedUser,
  ) => {
    requireMultiCurrency(user, 'gestionar tasas de cambio');

    const monedaOrigen = await exchangeRateProvider.getCurrency(input.monedaOrigenId);
    if (!monedaOrigen) {
      throw new ActionError('Moneda origen no encontrada', 'SOURCE_CURRENCY_NOT_FOUND');
    }

    if (!monedaOrigen.isActive) {
      throw new ActionError('La moneda origen no está activa', 'SOURCE_CURRENCY_INACTIVE');
    }

    const monedaDestino = await exchangeRateProvider.getCurrency(input.monedaDestino);
    if (!monedaDestino) {
      throw new ActionError('Moneda destino no encontrada', 'TARGET_CURRENCY_NOT_FOUND');
    }

    if (!monedaDestino.isActive) {
      throw new ActionError('La moneda destino no está activa', 'TARGET_CURRENCY_INACTIVE');
    }

    const tasaExistente = await exchangeRateProvider.getLatestRate(input.monedaOrigenId, input.monedaDestino);

    if (tasaExistente && tasaExistente.tasa === input.tasa) {
      return tasaExistente;
    }

    const nueva = await prisma.$transaction(async (tx) => {
      const creada = await exchangeRateProvider.createRate(
        {
          monedaOrigenId: input.monedaOrigenId,
          monedaDestino: input.monedaDestino,
          tasa: input.tasa,
        },
        tx,
      );

      await AuditLogService.logStrict(
        {
          accion: 'CREATE',
          entidad: 'TASA_CAMBIO',
          entidadId: creada.tasaId,
          usuarioId: user.userId,
          detalles: {
            monedaOrigenId: input.monedaOrigenId,
            monedaDestino: input.monedaDestino,
            tasa: input.tasa,
          },
        },
        tx,
      );

      return creada;
    });

    revalidatePath('/busy/contabilidad/exchange');
    return nueva;
  },
);

export const getHistorialTasasAction = withAction(
  async (
    params: {
      monedaOrigen?: string;
      fechaDesde?: string;
      fechaHasta?: string;
      busqueda?: string;
      pagina?: number;
      limite?: number;
    } = {},
    user: AuthenticatedUser,
  ) => {
    requireMultiCurrency(user, 'consultar historial de tasas de cambio');

    return exchangeReadService.getHistorialTasas({
      monedaOrigen: params.monedaOrigen,
      fechaDesde: params.fechaDesde,
      fechaHasta: params.fechaHasta,
      busqueda: params.busqueda,
      pagina: params.pagina,
      limite: params.limite,
    });
  },
);
