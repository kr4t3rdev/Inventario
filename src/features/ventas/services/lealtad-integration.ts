/**
 * @description Función directa (no server action) para acumular puntos de lealtad
 * después de una venta confirmada. Se llama desde VentaMutationService fuera
 * de la transacción principal para no bloquear el checkout.
 *
 * @module features/ventas/services/lealtad-integration
 */

import { prisma } from '@/lib/prisma';
import { crearIdempotenciaKey } from '@/features/lealtad/services/idempotency-service';

/**
 * @description Acumula puntos de lealtad por una compra confirmada.
 * Usa idempotencia para evitar duplicados si se llama múltiples veces.
 * @param {object} params - Parámetros de la compra.
 * @param {string} params.clienteId - ID del cliente.
 * @param {string} params.ventaId - ID de la venta.
 * @param {number} params.totalCompra - Total de la compra en centavos.
 * @param {string} params.tenantId - ID del tenant.
 * @returns {Promise<object>} Resultado con puntos acumulados.
 */
export async function acumularPuntosPorCompraVenta(params: {
  clienteId: string;
  ventaId: string;
  totalCompra: number;
  tenantId: string;
}): Promise<{ puntos: number; motivo: string }> {
  const { clienteId, ventaId, totalCompra, tenantId } = params;

  return await prisma.$transaction(async (tx) => {
    const programa = await tx.programaLealtad.findFirst({
      where: { tenantId, activo: true },
    });
    if (!programa) return { puntos: 0, motivo: 'Sin programa activo' };

    const idemKey = crearIdempotenciaKey('COMPRA', ventaId);
    const existente = await tx.historialPuntos.findFirst({
      where: { tenantId, idempotenciaKey: idemKey },
    });
    if (existente) return { puntos: existente.puntos, motivo: 'Ya procesado' };

    // Calcular puntos
    const puntosPorPeso = programa.puntosPorPeso || 1;
    const puntos = Math.floor(totalCompra * puntosPorPeso);
    if (puntos <= 0) return { puntos: 0, motivo: 'Sin puntos a acumular' };

    // Obtener o crear ClienteLealtad
    let clienteLealtad = await tx.clienteLealtad.findFirst({
      where: { tenantId, clienteId },
    });

    if (!clienteLealtad) {
      clienteLealtad = await tx.clienteLealtad.create({
        data: {
          tenantId,
          clienteId,
          programaId: programa.programaId,
          saldoPuntos: 0,
        },
      });
    }

    const nuevoSaldo = clienteLealtad.saldoPuntos + puntos;

    await tx.historialPuntos.create({
      data: {
        tenantId,
        clienteId,
        programaId: programa.programaId,
        puntos,
        tipo: 'COMPRA',
        referenciaId: ventaId,
        saldoAcumulado: nuevoSaldo,
        idempotenciaKey: idemKey,
      },
    });

    await tx.clienteLealtad.update({
      where: { clienteId },
      data: {
        saldoPuntos: nuevoSaldo,
        puntosGanados: { increment: puntos },
      },
    });

    // Actualizar campos denormalizados de Cliente
    await tx.cliente.update({
      where: { clienteId },
      data: {
        ultimaCompra: new Date(),
        totalComprado: { increment: totalCompra },
        cantidadCompras: { increment: 1 },
      },
    });

    return { puntos, motivo: 'OK' };
  });
}
