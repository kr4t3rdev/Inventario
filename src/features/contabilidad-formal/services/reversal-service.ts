import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { PeriodoContableService } from '@/lib/services/periodo-contable-service';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import {
  insertarAsientoConNumeracion,
  type ContextoPosting,
} from '@/features/contabilidad-formal/services/posting-engine';

/** Origen de negocio cuyo asiento formal se debe anular si existe. */
export interface FormalEntryOrigin {
  tipo: string;
  id: string;
}

/**
 * @description Anula asientos existentes mediante un asiento inverso inmutable.
 * Conserva las líneas y la evidencia FX originales, cambiando únicamente debe/haber.
 * La operación usa el período vigente, enlaza ambos asientos y debe ejecutarse
 * dentro de la misma transacción que revierte los efectos operativos.
 * @param {Prisma.TransactionClient} tx - Transacción de reversión del documento.
 * @param {ContextoPosting} contexto - Tenant y usuario que revierte el documento.
 * @param {FormalEntryOrigin[]} origenes - Orígenes de eventos generados por el documento.
 * @returns {Promise<string[]>} IDs de los asientos inversos creados o ya existentes.
 */
export async function reverseFormalEntries(
  tx: Prisma.TransactionClient,
  contexto: ContextoPosting,
  origenes: FormalEntryOrigin[],
): Promise<string[]> {
  const unicos = [...new Map(origenes.map((origen) => [
    `${origen.tipo}\u0000${origen.id}`,
    origen,
  ])).values()];
  if (unicos.length === 0) return [];

  const candidatos = await tx.asiento.findMany({
    where: {
      tenantId: contexto.tenantId,
      OR: unicos.map(({ tipo, id }) => ({ origenTipo: tipo, origenId: id })),
    },
    select: { asientoId: true },
    orderBy: [{ createdAt: 'asc' }, { asientoId: 'asc' }],
  });
  const reversos: string[] = [];

  for (const candidato of candidatos) {
    await tx.$queryRaw`
      SELECT 1 FROM "asientos"
      WHERE "asientoId" = ${candidato.asientoId}
        AND "tenantId" = ${contexto.tenantId}
      FOR UPDATE
    `;
    const original = await tx.asiento.findFirst({
      where: { asientoId: candidato.asientoId, tenantId: contexto.tenantId },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    });
    if (!original) continue;

    const reversoExistente = await tx.asiento.findUnique({
      where: {
        tenantId_origenTipo_origenId: {
          tenantId: contexto.tenantId,
          origenTipo: 'REVERSO_ASIENTO',
          origenId: original.asientoId,
        },
      },
      select: { asientoId: true, estado: true },
    });
    if (original.revertidoPorId) {
      if (original.estado !== 'ANULADO' ||
        reversoExistente?.asientoId !== original.revertidoPorId ||
        reversoExistente.estado !== 'CONTABILIZADO') {
        throw new ActionError(
          `El enlace de reversión del asiento ${original.asientoId} no es consistente`,
          'ASIENTO_REVERSO_INCONSISTENTE',
        );
      }
      reversos.push(reversoExistente.asientoId);
      continue;
    }
    if (reversoExistente && reversoExistente.estado !== 'CONTABILIZADO') {
      throw new ActionError(
        `El asiento inverso del asiento ${original.asientoId} no está contabilizado`,
        'ASIENTO_REVERSO_INCONSISTENTE',
      );
    }
    if (reversoExistente) {
      if (original.estado !== 'CONTABILIZADO') {
        throw new ActionError(
          `El asiento ${original.asientoId} tiene un reverso pero no está contabilizado`,
          'ASIENTO_REVERSO_INCONSISTENTE',
        );
      }
    } else if (original.estado !== 'CONTABILIZADO') {
      throw new ActionError(
        `El asiento ${original.asientoId} no se puede revertir desde su estado actual`,
        'ASIENTO_NO_REVERSIBLE',
      );
    }

    if (original.lineas.length < 2 || !asientoEstaCuadrado(original.lineas)) {
      throw new ActionError(
        `El asiento ${original.asientoId} está incompleto o descuadrado`,
        'ASIENTO_ORIGEN_INVALIDO',
      );
    }

    const fecha = new Date();
    const origenReverso = { tipo: 'REVERSO_ASIENTO', id: original.asientoId };
    const validacion = await PeriodoGuard.assertWritable(
      fecha,
      contexto.tenantId,
      'asiento',
      {
        actorId: contexto.userId,
        actorTipo: 'USUARIO',
        origen: origenReverso,
      },
    );
    if (!validacion.permitido) {
      throw new ActionError(
        validacion.error ?? 'El período contable está cerrado para la reversión',
        validacion.codigo ?? 'PERIODO_CERRADO',
      );
    }
    const resolucion = await PeriodoContableService.resolverPeriodoActivo(
      fecha,
      contexto.tenantId,
    );
    if (!resolucion.periodo) {
      throw new ActionError(
        'No existe un período contable abierto para la reversión',
        'PERIODO_NO_EXISTE',
      );
    }
    if (!resolucion.esWritable) {
      throw new ActionError(
        'El período contable está cerrado para la reversión',
        'PERIODO_CERRADO',
      );
    }

    const insertado = reversoExistente ?? await insertarAsientoConNumeracion(
      tx,
      contexto,
      {
        diarioId: original.diarioId,
        periodoId: resolucion.periodo.periodoId,
        fecha,
        descripcion: `Reversión del asiento ${original.numero}`,
        origenTipo: origenReverso.tipo,
        origenId: origenReverso.id,
        createdBy: contexto.userId,
        lineas: original.lineas.map((linea, index) => ({
          orden: index + 1,
          cuentaId: linea.cuentaId,
          debe: linea.haber,
          haber: linea.debe,
          monedaOriginal: linea.monedaOriginal,
          montoOriginal: linea.montoOriginal,
          tasaCambio: linea.tasaCambio,
          fxEvidenceFingerprint: linea.fxEvidenceFingerprint,
          referencia: linea.referencia,
        })),
      },
    );
    const actualizado = await tx.asiento.updateMany({
      where: {
        asientoId: original.asientoId,
        tenantId: contexto.tenantId,
        estado: 'CONTABILIZADO',
        revertidoPorId: null,
      },
      data: { estado: 'ANULADO', revertidoPorId: insertado.asientoId },
    });
    if (actualizado.count !== 1) {
      throw new ActionError(
        `El asiento ${original.asientoId} cambió durante la reversión`,
        'ASIENTO_REVERSO_CONFLICTO',
      );
    }
    reversos.push(insertado.asientoId);
  }

  return reversos;
}

/**
 * @description Verifica que los débitos y créditos del asiento coincidan.
 * @param {Array<{ debe: Prisma.Decimal; haber: Prisma.Decimal }>} lineas - Líneas persistidas.
 * @returns {boolean} Indica si el asiento tiene monto positivo y está cuadrado.
 */
function asientoEstaCuadrado(
  lineas: Array<{ debe: Prisma.Decimal; haber: Prisma.Decimal }>,
): boolean {
  const debe = lineas.reduce((total, linea) => total.plus(linea.debe), new Prisma.Decimal(0));
  const haber = lineas.reduce((total, linea) => total.plus(linea.haber), new Prisma.Decimal(0));
  return debe.gt(0) && debe.eq(haber);
}
