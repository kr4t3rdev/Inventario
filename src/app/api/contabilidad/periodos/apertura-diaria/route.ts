import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import {
  isPeriodoPersistenceUnavailableError,
  persistOpeningPeriod,
} from '@/lib/services/apertura-periodo-persistence-service';

interface PreviousPeriodSummaryLike {
  saldoCajaFinal?: number;
  saldoBancoFinal?: number;
  saldoCuentasCobrarFinal?: number;
  saldoCuentasPagarFinal?: number;
  saldoInventarioFinal?: number;
  saldoCapitalFinal?: number;
  saldoResultadoAcumFinal?: number;
}

/**
 * @description Convierte la carga JSON de resumen en una estructura utilizable para la apertura.
 * @param {unknown} resumenJson - Resumen persistido del snapshot previo.
 * @returns {PreviousPeriodSummaryLike | null} Resumen normalizado o null.
 */
function normalizePreviousSummary(
  resumenJson: unknown
): PreviousPeriodSummaryLike | null {
  if (!resumenJson || typeof resumenJson !== 'object') {
    return null;
  }

  return resumenJson as PreviousPeriodSummaryLike;
}

/**
 * @description Obtiene el último período diario previo con snapshot, si el runtime Prisma ya expone esos modelos.
 * @param {Date} referencia - Fecha para la que se abrirá el día.
 * @returns {Promise<{ periodoId: string; codigo: string; resumen: PreviousPeriodSummaryLike | null } | null>} Período previo utilizable.
 */
async function findPreviousDailyPeriod(referencia: Date): Promise<{
  periodoId: string;
  codigo: string;
  resumen: PreviousPeriodSummaryLike | null;
} | null> {
  const client = prisma as unknown as Record<string, unknown>;
  const periodoContable = client.periodoContable as
    | {
        findFirst?: (args: Record<string, unknown>) => Promise<{
          periodoId: string;
          codigo: string;
          snapshots?: Array<{ resumenJson?: unknown }>;
        } | null>;
      }
    | undefined;

  if (!periodoContable?.findFirst) {
    return null;
  }

  const previous = await periodoContable.findFirst({
    where: {
      tipo: 'DIARIO',
      fechaFin: { lt: referencia },
      estado: { in: ['CERRADO', 'APROBADO'] },
    },
    orderBy: [{ fechaFin: 'desc' }],
    select: {
      periodoId: true,
      codigo: true,
      snapshots: {
        take: 1,
        orderBy: { version: 'desc' },
        select: {
          resumenJson: true,
        },
      },
    },
  });

  if (!previous) {
    return null;
  }

  return {
    periodoId: previous.periodoId,
    codigo: previous.codigo,
    resumen: normalizePreviousSummary(previous.snapshots?.[0]?.resumenJson),
  };
}

/**
 * @description Calcula saldos vivos mínimos para inicializar una apertura diaria si no hay snapshot previo.
 * @returns {Promise<{ caja: number; bancos: number; cuentasPorCobrar: number; cuentasPorPagar: number; inventario: number; capital: number; resultadosAcumulados: number }>} Saldos vivos agregados.
 */
async function resolveLiveBalances(): Promise<{
  caja: number;
  bancos: number;
  cuentasPorCobrar: number;
  cuentasPorPagar: number;
  inventario: number;
  capital: number;
  resultadosAcumulados: number;
}> {
  const [cuentas, cuentasPorCobrar, cuentasPorPagar, productos, capitales] =
    await Promise.all([
      prisma.cuentaBancaria.findMany({
        where: { isActive: true },
        select: {
          saldo: true,
          tipoCuenta: true,
        },
      }),
      prisma.cuentaPorCobrar.findMany({
        select: {
          montoDeuda: true,
          montoPagado: true,
        },
      }),
      prisma.cuentaPorPagar.findMany({
        where: { deletedAt: null },
        select: {
          saldoPendiente: true,
        },
      }),
      prisma.producto.findMany({
        select: {
          stock: true,
          precioCosto: true,
        },
      }),
      prisma.inyeccionCapital.findMany({
        where: { tipo: 'CAPITAL_SOCIAL' },
        select: {
          montoRecibido: true,
        },
      }),
    ]);

  const caja = cuentas
    .filter((cuenta) => cuenta.tipoCuenta?.toLowerCase().includes('caja'))
    .reduce((sum, cuenta) => sum + Number(cuenta.saldo || 0), 0);

  const bancos = cuentas
    .filter((cuenta) => !cuenta.tipoCuenta?.toLowerCase().includes('caja'))
    .reduce((sum, cuenta) => sum + Number(cuenta.saldo || 0), 0);

  const totalCxC = cuentasPorCobrar.reduce(
    (sum, item) =>
      sum + Math.max(0, Number(item.montoDeuda || 0) - Number(item.montoPagado || 0)),
    0
  );

  const totalCxP = cuentasPorPagar.reduce(
    (sum, item) => sum + Math.max(0, Number(item.saldoPendiente || 0)),
    0
  );

  const inventario = productos.reduce(
    (sum, producto) =>
      sum + Number(producto.stock || 0) * Number(producto.precioCosto || 0),
    0
  );

  const capital = capitales.reduce(
    (sum, item) => sum + Number(item.montoRecibido || 0),
    0
  );

  return {
    caja,
    bancos,
    cuentasPorCobrar: totalCxC,
    cuentasPorPagar: totalCxP,
    inventario,
    capital,
    resultadosAcumulados: 0,
  };
}

/**
 * @description Abre el período diario contable y su apertura inicial.
 * @param {NextRequest} request - Request con fecha opcional y observaciones.
 * @returns {Promise<NextResponse>} Resultado de apertura persistida o reutilizada.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if ('status' in authResult) {
      return authResult as Response;
    }

    const user = authResult.user;
    const body = await request.json().catch(() => ({}));

    const fecha = body?.fecha ? new Date(body.fecha) : new Date();
    if (Number.isNaN(fecha.getTime())) {
      return NextResponse.json(
        { error: 'Fecha inválida', code: 'FECHA_INVALIDA' },
        { status: 400 }
      );
    }

    const previousPeriod = await findPreviousDailyPeriod(fecha);
    const liveBalances = await resolveLiveBalances();

    const result = await persistOpeningPeriod({
      tipoPeriodo: 'DIARIO',
      referencia: fecha,
      usuarioId: user.userId,
      previousPeriod,
      liveBalances,
      observaciones: body?.observaciones,
    });

    return NextResponse.json(
      {
        message: result.wasCreated
          ? 'Apertura diaria creada exitosamente'
          : 'La apertura diaria ya existía para esa fecha',
        periodo: result.periodo,
        apertura: result.apertura,
        seed: result.seed,
        wasCreated: result.wasCreated,
      },
      { status: result.wasCreated ? 201 : 200 }
    );
  } catch (error) {
    if (isPeriodoPersistenceUnavailableError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Error al abrir período diario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
