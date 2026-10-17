import type { Prisma, PrismaClient } from '@/generated/prisma';

interface ResultadoShadow {
  tenantId: string;
  tipoEvento: string;
  origenTipo: string;
  origenId: string;
  estado: 'SIMULADO' | 'ERROR_SHADOW' | 'OMITIDO';
  causa?: string;
  duracionMs: number;
}

/**
 * @description Persiste evidencia dentro del writer. No entrega ni emite contadores antes del commit.
 * @param {Prisma.TransactionClient} tx - Transacción del writer.
 * @param {ResultadoShadow} resultado - Resultado de la simulación.
 * @returns {Promise<void>} Evidencia atómica con la operación.
 */
export async function registrarResultadoShadow(
  tx: Prisma.TransactionClient,
  resultado: ResultadoShadow,
): Promise<void> {
  await tx.shadowPosteoOutbox.upsert({
    where: {
      tenantId_tipoEvento_origenTipo_origenId: {
        tenantId: resultado.tenantId,
        tipoEvento: resultado.tipoEvento,
        origenTipo: resultado.origenTipo,
        origenId: resultado.origenId,
      },
    },
    create: resultado,
    update: {},
  });
}

/**
 * @description Entrega evidencias confirmadas bajo lock y confirma el ACK solo tras entregar.
 * No se ejecuta desde postEvento ni desde la transacción del writer.
 * @param {PrismaClient} db - Cliente raíz para consumo después del commit.
 * @param {number} limite - Máximo de filas por lote.
 * @param {(item: EvidenciaShadow) => Promise<void>} entregar - Persistencia externa idempotente por id.
 * @param {string} [tenantId] - Limita el lote a un tenant cuando el consumidor lo requiere.
 * @returns {Promise<EvidenciaShadow[]>} Filas entregadas; sin callback no se hace ACK.
 */
export interface EvidenciaShadow {
  id: string;
  origenId: string;
  estado: string;
  tenantId: string;
  tipoEvento: string;
  causa: string | null;
  duracionMs: number;
}

export interface MetricaShadow {
  tipoEvento: string;
  estado: string;
  causa: string | null;
  cantidad: number;
  latenciaP95Ms: number;
}

/**
 * @description Consulta eventos confirmados directamente desde el outbox, incluso si fueron entregados.
 * Releer o reintentar el mismo origen no incrementa el conteo; no se requiere ACK para reportar.
 * @param {PrismaClient} db - Cliente de lectura.
 * @param {string} tenantId - Tenant autenticado por el caller; nunca se aceptan lecturas globales.
 * @returns {Promise<MetricaShadow[]>} Conteos y percentil por evento, resultado y causa.
 */
export async function consultarMetricasShadow(
  db: PrismaClient,
  tenantId: string,
): Promise<MetricaShadow[]> {
  if (!tenantId) throw new Error('Tenant requerido');
  return db.$queryRaw<MetricaShadow[]>`
    SELECT "tipoEvento", estado, causa, COUNT(*)::integer AS cantidad,
      percentile_disc(0.95) WITHIN GROUP (ORDER BY "duracionMs") AS "latenciaP95Ms"
    FROM shadow_posteo_outbox
    WHERE "tenantId" = ${tenantId}
    GROUP BY "tipoEvento", estado, causa
    ORDER BY "tipoEvento", estado, causa
  `;
}

export async function consumirResultadosShadow(
  db: PrismaClient,
  entregar: (item: EvidenciaShadow) => Promise<void>,
  limite = 100,
  tenantId: string,
): Promise<EvidenciaShadow[]> {
  if (!Number.isInteger(limite) || limite < 1 || limite > 1000) throw new Error('Límite inválido');
  if (!tenantId?.trim()) throw new Error('Tenant requerido');
  return db.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<EvidenciaShadow[]>`
      SELECT id, "origenId", estado, "tenantId", "tipoEvento", causa, "duracionMs"
      FROM shadow_posteo_outbox
      WHERE "entregadoAt" IS NULL AND "tenantId" = ${tenantId}
      ORDER BY "createdAt", id LIMIT ${limite} FOR UPDATE SKIP LOCKED
    `;
    for (const fila of filas) {
      await entregar(fila);
      await tx.shadowPosteoOutbox.update({
        where: { id: fila.id }, data: { entregadoAt: new Date() },
      });
    }
    return filas;
  });
}
