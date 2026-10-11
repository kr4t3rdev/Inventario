import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile unit update/delete endpoint using Bearer <redacted>
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) {
    return authResult as Response;
  }

  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse("Tenant no identificado", 403, "TENANT_REQUIRED");
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, simbolo } = body;

    const existing = await prisma.unidad.findFirst({
      where: { unidadId: id, tenantId },
    });
    if (!existing) {
      return errorResponse("Unidad no encontrada", 404, "NOT_FOUND");
    }

    const unit = await prisma.unidad.update({
      where: { unidadId: id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(simbolo !== undefined && { simbolo: simbolo?.trim() || null }),
      },
      select: { unidadId: true, nombre: true, simbolo: true },
    });

    return successResponse({ unit });
  } catch (error) {
    console.error("Error en mobile units update route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) {
    return authResult as Response;
  }

  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse("Tenant no identificado", 403, "TENANT_REQUIRED");
  }

  try {
    const { id } = await params;

    const existing = await prisma.unidad.findFirst({
      where: { unidadId: id, tenantId },
    });
    if (!existing) {
      return errorResponse("Unidad no encontrada", 404, "NOT_FOUND");
    }

    await prisma.unidad.delete({ where: { unidadId: id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("Error en mobile units delete route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
