import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verify_token } from "@/lib/auth-utils";
import { AuditLogService } from "@/lib/services/audit-log-service";

/**
 * Obtiene un cierre contable por ID
 * @param {NextRequest} request - Solicitud
 * @param {Object} params - Parámetros de la ruta
 * @returns {Promise<NextResponse>} Detalles del cierre
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { id } = params;

    const cierre = await prisma.cierreContable.findUnique({
      where: { cierreId: id },
    });

    if (!cierre) {
      return NextResponse.json(
        { error: "Cierre no encontrado" },
        { status: 404 }
      );
    } 

    return NextResponse.json(cierre);
  } catch (error) {
    console.error("Error al obtener cierre:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Actualiza un cierre contable
 * @param {NextRequest} request - Solicitud con datos actualizados
 * @param {Object} params - Parámetros de la ruta
 * @returns {Promise<NextResponse>} Cierre actualizado
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const user = await verify_token(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    const existingCierre = await prisma.cierreContable.findUnique({
      where: { cierreId: id }
    });

    if (!existingCierre) {
      return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });
    }

    const cierre = await prisma.cierreContable.update({
      where: { cierreId: id },
      data: body,
    });

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "UPDATE",
      entidad: "CIERRE_CONTABLE",
      entidadId: id,
      usuarioId: user.userId,
      detalles: {
        cambios: body,
        fechaInicioOriginal: existingCierre.fechaInicio,
        fechaFinOriginal: existingCierre.fechaFin,
        tipoOriginal: existingCierre.tipo
      }
    });

    return NextResponse.json(cierre);
  } catch (error) {
    console.error("Error al actualizar cierre:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Elimina un cierre contable
 * @param {NextRequest} request - Solicitud
 * @param {Object} params - Parámetros de la ruta
 * @returns {Promise<NextResponse>} Confirmación de eliminación
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const user = await verify_token(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = params;

    const existingCierre = await prisma.cierreContable.findUnique({
      where: { cierreId: id }
    });

    if (!existingCierre) {
      return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });
    }

    await prisma.cierreContable.delete({
      where: { cierreId: id },
    });

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "DELETE",
      entidad: "CIERRE_CONTABLE",
      entidadId: id,
      usuarioId: user.userId,
      detalles: {
        fechaInicio: existingCierre.fechaInicio,
        fechaFin: existingCierre.fechaFin,
        tipo: existingCierre.tipo,
        totalVentas: existingCierre.totalVentas,
        totalGastos: existingCierre.totalGastos,
        ganancias: existingCierre.ganancias,
        perdidas: existingCierre.perdidas
      }
    });

    return NextResponse.json({ message: "Cierre eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar cierre:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}