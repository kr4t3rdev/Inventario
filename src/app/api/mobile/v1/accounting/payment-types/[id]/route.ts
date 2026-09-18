import { authenticateUser } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { errorResponse, successResponse } from '@/lib/api-response';
import { PUT as updatePaymentType } from '@/app/api/contabilidad/tipos-pago/[id]/route';
import { DELETE as deletePaymentType } from '@/app/api/contabilidad/tipos-pago/[id]/route';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return updatePaymentType(request as never, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return deletePaymentType(request as never, context);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { id } = await params;
    const tenantId = authResult.user.tenantId;
    if (!tenantId) return errorResponse('Contexto de tenant no disponible', 403, 'TENANT_REQUIRED');

    const tipoPago = await prisma.tipoPago.findFirst({
      where: { tipoId: id, tenantId },
      include: { _count: { select: { reconciliacionesVenta: true, reconciliacionesServicio: true, reconciliacionesGasto: true } } },
    });
    if (!tipoPago) return errorResponse('Tipo de pago no encontrado', 404, 'PAYMENT_TYPE_NOT_FOUND');

    const cuentaDefectoInfo = tipoPago.cuentaDefecto
      ? await prisma.cuentaBancaria.findFirst({
          where: { cuentaId: tipoPago.cuentaDefecto, tenantId },
          select: { cuentaId: true, nombreBanco: true, numeroCuenta: true, tipoCuenta: true, moneda: true, isActive: true },
        })
      : null;

    return successResponse({ ...tipoPago, cuentaDefectoInfo });
  } catch (error) {
    console.error('Error en mobile accounting payment type detail route:', error);
    return errorResponse('Error al obtener el tipo de pago', 500, 'FETCH_PAYMENT_TYPE_ERROR');
  }
}
