import prisma from '@/lib/prisma';

import { AuditLogService } from '@/lib/services/audit-log-service';
import {
  type CriterioContable,
  type EventoContableLineaSeed,
  type EventoContableSeed,
  type NaturalezaEvento,
  type OrigenTipo,
  ESTADO_EVENTO,
  generarEventoSeed,
  validarEventoSeed,
} from '@/lib/services/evento-contable-service';

interface PersistedEventoLike {
  eventoId: string;
  fechaOperacion: Date;
  fechaRegistro: Date;
  origenTipo: string;
  origenId: string;
  criterio: string;
  periodoDiarioId: string | null;
  periodoMensualId: string | null;
  periodoAnualId: string | null;
  moneda: string;
  monto: number;
  montoConvertido: number | null;
  naturaleza: string;
  estado: string;
  descripcion: string | null;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface PersistedLineaLike {
  lineaId: string;
  eventoId: string;
  cuenta: string;
  descripcion: string | null;
  debito: number;
  credito: number;
  moneda: string;
}

interface EventoPersistenceModels {
  eventoContable: {
    create: (args: Record<string, unknown>) => Promise<PersistedEventoLike>;
  };
}

export class EventoPersistenceUnavailableError extends Error {
  status: number;
  code: string;

  constructor() {
    super('El runtime Prisma actual no expone EventoContable. Ejecutá migrate/generate antes de persistir eventos.');
    this.name = 'EventoPersistenceUnavailableError';
    this.status = 503;
    this.code = 'EVENTO_PERSISTENCE_UNAVAILABLE';
  }
}

export class EventoValidationError extends Error {
  status: number;
  code: string;
  errors: string[];

  constructor(errors: string[]) {
    super(`Validación de evento contable fallida: ${errors.join('; ')}`);
    this.name = 'EventoValidationError';
    this.status = 400;
    this.code = 'EVENTO_VALIDATION_ERROR';
    this.errors = errors;
  }
}

export interface PersistEventoParams {
  seed: EventoContableSeed;
  lineas: EventoContableLineaSeed[];
  usuarioId: string;
}

export interface PersistEventoResult {
  evento: PersistedEventoLike;
  lineas: PersistedLineaLike[];
  wasCreated: boolean;
}

function resolvePersistenceModels(client: unknown): EventoPersistenceModels {
  const candidate = client as unknown as Record<string, unknown>;
  const eventoContable = candidate.eventoContable as EventoPersistenceModels['eventoContable'] | undefined;

  if (!eventoContable?.create) {
    throw new EventoPersistenceUnavailableError();
  }

  return { eventoContable };
}

/**
 * @description Persiste un evento contable con sus líneas de doble partida de manera transaccional.
 * @param {PersistEventoParams} params - Semilla del evento, líneas y usuario que registra.
 * @returns {Promise<PersistEventoResult>} Evento persistido con sus líneas.
 */
export async function persistEventoContable(params: PersistEventoParams): Promise<PersistEventoResult> {
  const txFactory = (prisma as unknown as Record<string, unknown>).$transaction as
    | ((callback: (tx: unknown) => Promise<PersistEventoResult>) => Promise<PersistEventoResult>)
    | undefined;

  if (!txFactory) {
    throw new EventoPersistenceUnavailableError();
  }

  const enrichedSeed = generarEventoSeed(params.seed);

  const validation = validarEventoSeed(enrichedSeed);
  if (!validation.ok) {
    throw new EventoValidationError(validation.errors);
  }

  if (params.lineas.length === 0) {
    throw new EventoValidationError(['Un evento contable necesita al menos una línea.']);
  }

  const totalDebito = params.lineas.reduce((sum, l) => sum + Number(l.debito), 0);
  const totalCredito = params.lineas.reduce((sum, l) => sum + Number(l.credito), 0);

  if (Math.abs(totalDebito - totalCredito) > 0.01) {
    throw new EventoValidationError([
      `El asiento no está balanceado. Débito: ${totalDebito}, Crédito: ${totalCredito}, Diferencia: ${Math.abs(totalDebito - totalCredito).toFixed(4)}.`,
    ]);
  }

  return txFactory(async (tx: unknown) => {
    const models = resolvePersistenceModels(tx);

    const evento = await models.eventoContable.create({
      data: {
        fechaOperacion: enrichedSeed.fechaOperacion,
        origenTipo: enrichedSeed.origenTipo,
        origenId: enrichedSeed.origenId,
        criterio: enrichedSeed.criterio,
        periodoDiarioId: enrichedSeed.periodoDiarioId ?? null,
        periodoMensualId: enrichedSeed.periodoMensualId ?? null,
        periodoAnualId: enrichedSeed.periodoAnualId ?? null,
        moneda: enrichedSeed.moneda ?? 'CUP',
        monto: enrichedSeed.monto,
        montoConvertido: enrichedSeed.montoConvertido ?? null,
        naturaleza: enrichedSeed.naturaleza,
        estado: ESTADO_EVENTO.CONFIRMADO,
        descripcion: enrichedSeed.descripcion ?? null,
        metadataJson: enrichedSeed.metadataJson ?? null,
        lineas: {
          create: params.lineas.map((lineaSeed, idx) => ({
            lineaId: `linea-${enrichedSeed.origenId}-${idx}`,
            cuenta: lineaSeed.cuenta,
            descripcion: lineaSeed.descripcion ?? null,
            debito: Number(lineaSeed.debito),
            credito: Number(lineaSeed.credito),
            moneda: lineaSeed.moneda ?? enrichedSeed.moneda ?? 'CUP',
          })),
        },
      } as Record<string, unknown>,
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'PERIODO_CONTABLE',
      entidadId: evento.eventoId,
      usuarioId: params.usuarioId,
      detalles: {
        accionEspecifica: 'EVENTO_CONTABLE',
        origenTipo: enrichedSeed.origenTipo,
        origenId: enrichedSeed.origenId,
        criterio: enrichedSeed.criterio,
        naturaleza: enrichedSeed.naturaleza,
        monto: enrichedSeed.monto,
        totalLineas: params.lineas.length,
        totalDebito,
        totalCredito,
      },
    });

    return {
      evento,
      lineas: params.lineas.map((lineaSeed, idx) => ({
        lineaId: `linea-${enrichedSeed.origenId}-${idx}`,
        eventoId: evento.eventoId,
        cuenta: lineaSeed.cuenta,
        descripcion: lineaSeed.descripcion ?? null,
        debito: Number(lineaSeed.debito),
        credito: Number(lineaSeed.credito),
        moneda: lineaSeed.moneda ?? enrichedSeed.moneda ?? 'CUP',
      })) as PersistedLineaLike[],
      wasCreated: true,
    };
  });
}

/**
 * @description Persiste múltiples eventos contables en lote, generando líneas de doble partida automáticamente.
 * @param {EventoContableSeed[]} seeds - Semillas de eventos a persistir.
 * @param {string} usuarioId - ID del usuario que registra.
 * @param {string} cuentaContraria - Cuenta contraria para generar las líneas de doble partida.
 * @returns {Promise<PersistEventoResult[]>} Eventos persistidos.
 */
export async function persistirEventosLote(
  seeds: EventoContableSeed[],
  usuarioId: string,
  cuentaContraria: string
): Promise<PersistEventoResult[]> {
  const { generarLineasDoblePartida } = await import('@/lib/services/evento-contable-service');

  const results: PersistEventoResult[] = [];

  for (const seed of seeds) {
    const enrichedSeed = generarEventoSeed(seed);
    const lineas = generarLineasDoblePartida(enrichedSeed, cuentaContraria);

    const result = await persistEventoContable({
      seed: enrichedSeed,
      lineas,
      usuarioId,
    });

    results.push(result);
  }

  return results;
}

export function isEventoPersistenceUnavailableError(
  error: unknown
): error is EventoPersistenceUnavailableError {
  return error instanceof EventoPersistenceUnavailableError;
}

export function isEventoValidationError(
  error: unknown
): error is EventoValidationError {
  return error instanceof EventoValidationError;
}