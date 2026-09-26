import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write';

export const dynamic = 'force-dynamic';

interface GastoDERecord {
  gastosDEId: string;
  tenantId: string;
  conceptoId: string | null;
  concepto?: { nombre: string } | null;
  monto: number;
  descripcion: string | null;
  numeroFactura: string | null;
  isPagado: string | null;
  periodo: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @description Maps a GastosDE row to the mobile Gasto contract.
 * @param {GastoDERecord} gasto - Raw expense row with concepto included.
 * @returns {Record<string, unknown>} Mobile-shaped expense payload.
 */
export function mapGasto(gasto: GastoDERecord) {
  return {
    gastoId: gasto.gastosDEId,
    conceptoId: gasto.conceptoId ?? '',
    conceptoNombre: gasto.concepto?.nombre ?? undefined,
    monto: gasto.monto,
    descripcion: gasto.descripcion ?? undefined,
    fecha: gasto.createdAt.toISOString(),
    comprobante: gasto.numeroFactura ?? undefined,
    estado: gasto.isPagado === 'PAGADO' ? ('APROBADO' as const) : ('REGISTRADO' as const),
    createdAt: gasto.createdAt.toISOString(),
    updatedAt: gasto.updatedAt.toISOString(),
  };
}

/**
 * @description Mobile expenses list endpoint backed by GastosDE.
 * @param {Request} request - Incoming authenticated request; supports ?conceptoId= and ?fecha=.
 * @returns {Promise<Response>} Mapped expense list response.
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const { searchParams } = new URL(request.url);
    const where: Record<string, unknown> = { tenantId };
    const conceptoId = searchParams.get('conceptoId');
    if (conceptoId) where.conceptoId = conceptoId;
    const fecha = searchParams.get('fecha');
    if (fecha) {
      const start = new Date(fecha);
      if (!Number.isNaN(start.getTime())) {
        where.createdAt = { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
      }
    }

    const rows = await prisma.gastosDE.findMany({
      where,
      include: { concepto: true },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse({ items: rows.map(mapGasto) });
  } catch (error) {
    console.error('Error en mobile expenses route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Creates a GastoDE from the mobile payload.
 * @param {Request} request - Incoming authenticated request with {conceptoId,monto,descripcion,fecha,comprobante}.
 * @returns {Promise<Response>} Created mapped expense.
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
    const body = (await request.json()) as {
      conceptoId?: string;
      monto?: number;
      descripcion?: string;
      fecha?: string;
      comprobante?: string;
    };
    if (!body.conceptoId || typeof body.monto !== 'number' || !Number.isFinite(body.monto) || !body.fecha) {
      return errorResponse('Datos inválidos', 400, 'VALIDATION_ERROR');
    }
    const fechaDate = new Date(body.fecha);
    if (Number.isNaN(fechaDate.getTime())) {
      return errorResponse('Fecha inválida', 400, 'VALIDATION_ERROR');
    }

    // Enforcement server del período contable cerrado (patrón de las rutas
    // contables legacy); el bloqueo client-side es solo UX.
    const validacion = await validarEscrituraPeriodo({
      fecha: fechaDate,
      tenantId,
      tipoOperacion: 'devengo',
      actor: authResult.user.userId,
    });
    if (!validacion.permitido) {
      return errorResponse(
        validacion.error?.message ?? 'Período no permite escrituras contables',
        400,
        validacion.error?.code ?? 'PERIODO_ERROR',
      );
    }

    const periodo = `${fechaDate.getUTCFullYear()}-${String(fechaDate.getUTCMonth() + 1).padStart(2, '0')}`;

    const created = (await prisma.gastosDE.create({
      data: {
        tenantId,
        conceptoId: body.conceptoId,
        proveedor: 'Registro móvil',
        monto: Math.round(body.monto),
        descripcion: body.descripcion ?? body.conceptoId,
        numeroFactura: body.comprobante ?? null,
        periodo,
      },
    })) as unknown as GastoDERecord;
    return successResponse(mapGasto(created), 201);
  } catch (error) {
    console.error('Error creando gasto (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
