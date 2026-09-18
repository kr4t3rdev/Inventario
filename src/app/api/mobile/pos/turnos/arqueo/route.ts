import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { requireFeature } from '@/lib/services/tenant-scope';
import { realizarArqueoSchema } from '@/features/arqueo-caja/schemas';

export const dynamic = 'force-dynamic';

const UMBRAL_DIFERENCIA = 50000;

function calcularTotalCup(c: Record<string, number>): number {
  return (
    c.billetes1000Cup * 100000 +
    c.billetes500Cup * 50000 +
    c.billetes200Cup * 20000 +
    c.billetes100Cup * 10000 +
    c.billetes50Cup * 5000 +
    c.billetes20Cup * 2000 +
    c.billetes10Cup * 1000 +
    c.billetes5Cup * 500 +
    c.billetes1Cup * 100 +
    c.monedasCup
  );
}

function calcularTotalUsd(c: Record<string, number>): number {
  return (
    c.billetes100Usd * 10000 +
    c.billetes50Usd * 5000 +
    c.billetes20Usd * 2000 +
    c.billetes10Usd * 1000 +
    c.billetes5Usd * 500 +
    c.billetes1Usd * 100 +
    c.monedasUsd
  );
}

/**
 * @description Mobile cash-count (arqueo) endpoint. Mirrors realizarArqueoAction.
 * @param {Request} request - Incoming authenticated request with bill counts.
 * @returns {Promise<Response>} Created arqueo with computed differences.
 */
export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    requireFeature(authResult.user, 'turnos-pos', 'gestionar turnos POS');
    const parsed = realizarArqueoSchema.parse(await request.json());

    const turno = await prisma.turnoPuntoVenta.findFirst({
      where: { id: parsed.turnoId, tenantId },
      include: {
        ventas: {
          where: { deletedAt: null },
          select: {
            metodoPago: true,
            montoEfectivo: true,
            montoTarjeta: true,
            montoTransferencia: true,
            montoCredito: true,
          },
        },
      },
    });
    if (!turno) {
      return errorResponse('Turno no encontrado', 404, 'NOT_FOUND');
    }
    if (turno.estado !== 'ABIERTO') {
      return errorResponse('El turno ya está cerrado', 409, 'CONFLICT');
    }

    const totalEfectivoCup = calcularTotalCup(parsed as unknown as Record<string, number>);
    const totalEfectivoUsd = calcularTotalUsd(parsed as unknown as Record<string, number>);

    const esperadoEfectivoCup = turno.ventas
      .filter((v) => v.metodoPago === 'EFECTIVO' || v.metodoPago === 'MIXTO')
      .reduce((sum, v) => sum + (v.montoEfectivo ?? 0), 0);
    const esperadoEfectivoUsd = turno.fondoInicialUsd;
    const esperadoTarjeta = turno.ventas
      .filter((v) => v.metodoPago === 'TARJETA' || v.metodoPago === 'MIXTO')
      .reduce((sum, v) => sum + (v.montoTarjeta ?? 0), 0);
    const esperadoTransferencia = turno.ventas
      .filter((v) => v.metodoPago === 'TRANSFERENCIA')
      .reduce((sum, v) => sum + (v.montoTransferencia ?? 0), 0);
    const esperadoCredito = turno.ventas
      .filter((v) => v.metodoPago === 'CREDITO' || v.metodoPago === 'MIXTO')
      .reduce((sum, v) => sum + (v.montoCredito ?? 0), 0);

    const diferenciaCup = totalEfectivoCup - turno.fondoInicialCup - esperadoEfectivoCup;
    const diferenciaUsd = totalEfectivoUsd - esperadoEfectivoUsd;

    const result = await prisma.arqueoCaja.create({
      data: {
        turnoId: parsed.turnoId,
        tenantId,
        puntoDeVentaId: turno.puntoDeVentaId,
        billetes1000Cup: parsed.billetes1000Cup,
        billetes500Cup: parsed.billetes500Cup,
        billetes200Cup: parsed.billetes200Cup,
        billetes100Cup: parsed.billetes100Cup,
        billetes50Cup: parsed.billetes50Cup,
        billetes20Cup: parsed.billetes20Cup,
        billetes10Cup: parsed.billetes10Cup,
        billetes5Cup: parsed.billetes5Cup,
        billetes1Cup: parsed.billetes1Cup,
        monedasCup: parsed.monedasCup,
        billetes100Usd: parsed.billetes100Usd,
        billetes50Usd: parsed.billetes50Usd,
        billetes20Usd: parsed.billetes20Usd,
        billetes10Usd: parsed.billetes10Usd,
        billetes5Usd: parsed.billetes5Usd,
        billetes1Usd: parsed.billetes1Usd,
        monedasUsd: parsed.monedasUsd,
        totalEfectivoCup,
        totalEfectivoUsd,
        totalTarjeta: parsed.totalTarjeta,
        totalTransferencia: parsed.totalTransferencia,
        totalCredito: parsed.totalCredito,
        esperadoEfectivoCup,
        esperadoEfectivoUsd,
        esperadoTarjeta,
        esperadoTransferencia,
        esperadoCredito,
        diferenciaCup,
        diferenciaUsd,
        observaciones: parsed.observaciones ?? null,
      },
    });

    const advertencia =
      Math.abs(diferenciaCup) > UMBRAL_DIFERENCIA
        ? `Diferencia de ${(diferenciaCup / 100).toFixed(2)} CUP excede el umbral permitido`
        : undefined;

    return successResponse(
      {
        arqueo: {
          arqueoId: result.id,
          turnoId: result.turnoId,
          totalEfectivoCup: result.totalEfectivoCup,
          totalEfectivoUsd: result.totalEfectivoUsd,
          diferenciaCup: result.diferenciaCup,
          diferenciaUsd: result.diferenciaUsd,
          esperadoEfectivoCup: result.esperadoEfectivoCup,
          esperadoTarjeta: result.esperadoTarjeta,
          esperadoTransferencia: result.esperadoTransferencia,
          esperadoCredito: result.esperadoCredito,
          createdAt: result.createdAt.toISOString(),
        },
        diferencias: { cup: diferenciaCup, usd: diferenciaUsd },
        ...(advertencia ? { advertencia } : {}),
      },
      201,
    );
  } catch (error) {
    console.error('Error registrando arqueo (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}