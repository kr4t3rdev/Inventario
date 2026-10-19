/**
 * @description Registro de firmas de contratos con activación por la máquina de
 *              estados (CTF-3): una firma FIRMADA sobre un contrato APROBADO lo
 *              transiciona a ACTIVO de forma atómica; la fechaFirma siempre la
 *              asigna el servidor.
 * @module features/contratos/lib/firmas-contrato
 */
import type { EstadoContrato, TipoFirma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { assertTransicionValida } from './estado-contrato-machine';

export type EstadoFirma = 'PENDIENTE' | 'FIRMADA' | 'RECHAZADA';

export interface RegistrarFirmaInput {
  firmanteId: string;
  tipoFirma: TipoFirma;
  estado?: EstadoFirma;
  firmaDigital?: string | null;
  /** Ignorado: la fechaFirma de una firma FIRMADA la asigna el servidor. */
  fechaFirma?: string | null;
  comentarios?: string | null;
}

const FIRMA_INCLUDE = { firmante: { select: { userId: true, name: true, email: true } } } as const;

/**
 * @description Crea la firma del contrato y, si es FIRMADA sobre un contrato
 *              APROBADO, transiciona el contrato a ACTIVO vía la máquina de
 *              estados. B-2: el estado se RELEE dentro de la transacción y la
 *              transición es un claim condicional (updateMany con estado de
 *              origen); una anulación concurrente gana y la firma queda
 *              registrada sin transición — nunca se revive un estado terminal.
 *              Firmas no FIRMADAS no alteran el contrato; FIRMADAS sobre
 *              contratos no APROBADOS se registran sin transición (no es error).
 * @param {Pick<Contrato, 'contratoId' | 'estado'>} contrato - Contrato destino (del tenant).
 * @param {RegistrarFirmaInput} input - Datos de la firma validados por Zod.
 * @returns {Promise<{ firma: unknown; contratoActualizado: boolean }>} Firma creada e indicador de transición aplicada.
 * @throws {ActionError} TRANSICION_INVALIDA si la máquina no permite APROBADO→ACTIVO.
 */
export async function registrarFirmaYTransicionar(
  contrato: { contratoId: string; estado: EstadoContrato },
  input: RegistrarFirmaInput,
): Promise<{ firma: unknown; contratoActualizado: boolean }> {
  const estadoFirma: EstadoFirma = input.estado ?? 'PENDIENTE';
  const data = {
    contratoId: contrato.contratoId,
    firmanteId: input.firmanteId,
    tipoFirma: input.tipoFirma,
    estado: estadoFirma,
    firmaDigital: input.firmaDigital,
    fechaFirma: estadoFirma === 'FIRMADA' ? new Date() : null,
    comentarios: input.comentarios,
  };

  return prisma.$transaction(async (tx) => {
    // Estado vivo dentro de la transacción: la decisión no depende del
    // snapshot que leyó el handler antes de entrar.
    const actual = await tx.contrato.findFirst({
      where: { contratoId: contrato.contratoId },
      select: { estado: true },
    });

    if (estadoFirma === 'FIRMADA' && actual?.estado === 'APROBADO') {
      assertTransicionValida(actual.estado, 'ACTIVO');
      const claim = await tx.contrato.updateMany({
        where: { contratoId: contrato.contratoId, estado: 'APROBADO' },
        data: { estado: 'ACTIVO' },
      });
      const firma = await tx.contratoFirma.create({ data, include: FIRMA_INCLUDE });
      return { firma, contratoActualizado: claim.count > 0 };
    }

    const firma = await tx.contratoFirma.create({ data, include: FIRMA_INCLUDE });
    return { firma, contratoActualizado: false };
  });
}
