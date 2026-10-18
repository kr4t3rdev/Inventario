/**
 * @description Servicio de numeración de facturas (C-6/D7): resuelve la serie
 * de facturación del tenant (por defecto → primera → crea "FV"), incrementa el
 * consecutivo y compone el número. Única fuente de verdad para facturar
 * productos y servicios.
 */
import type { Prisma } from '@/generated/prisma';

type SerieTx = Pick<Prisma.TransactionClient, 'serieFacturacion'>;

export interface SerieYNumero {
  serieId: string;
  numeroConsecutivo: number;
  numeroFactura: string;
}

/**
 * @description Resuelve la serie del tenant y emite el siguiente número de
 * factura. Debe llamarse dentro de la transacción del caller (el incremento
 * del consecutivo participa de ella).
 * @param {SerieTx} tx - Cliente transaccional de Prisma.
 * @param {string} tenantId - Tenant del emisor.
 * @returns {Promise<SerieYNumero>} Serie usada, consecutivo y número compuesto.
 */
export async function resolverSerieYNumero(
  tx: SerieTx,
  tenantId: string,
): Promise<SerieYNumero> {
  let serie = await tx.serieFacturacion.findFirst({
    where: { tenantId, esPorDefecto: true },
  });
  if (!serie) {
    serie = await tx.serieFacturacion.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }
  if (!serie) {
    serie = await tx.serieFacturacion.create({
      data: {
        tenantId,
        prefijo: 'FV',
        descripcion: 'Facturas de Venta',
        consecutivo: 1,
        esPorDefecto: true,
      },
    });
  }
  const updatedSerie = await tx.serieFacturacion.update({
    where: { serieId: serie.serieId },
    data: { consecutivo: { increment: 1 } },
  });
  const numeroConsecutivo = updatedSerie.consecutivo - 1;
  const numeroFactura = `${serie.prefijo}-${String(numeroConsecutivo).padStart(6, '0')}`;
  return { serieId: serie.serieId, numeroConsecutivo, numeroFactura };
}
