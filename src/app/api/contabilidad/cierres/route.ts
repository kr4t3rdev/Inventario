import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { crearCierreContable } from "@/lib/services/cierreContableService";
import { authenticateUser } from "@/lib/auth-middleware";
import { AuditLogService } from "@/lib/services/audit-log-service";

/**
 * Lista todos los cierres contables
 * @returns {Promise<NextResponse>} Lista de cierres
 */
export async function GET() {
  try {
    const cierres = await prisma.cierreContable.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(cierres);
  } catch (error) {
    console.error("Error al obtener cierres:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Crea un nuevo cierre contable con cálculos automáticos
 * @param {NextRequest} request - Solicitud con datos básicos del cierre
 * @returns {Promise<NextResponse>} Cierre creado
 */
export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json();
    const { tipo, fechaInicio, fechaFin, observaciones } = body;

    // Validaciones básicas
    if (!tipo || !fechaInicio || !fechaFin) {
      return NextResponse.json(
        { error: "Campos requeridos faltantes: tipo, fechaInicio, fechaFin" },
        { status: 400 }
      );
    }

    const cierre = await crearCierreContable(
      tipo,
      new Date(fechaInicio),
      new Date(fechaFin),
      user.userId,
      observaciones
    );

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "CREATE",
      entidad: "CIERRE_CONTABLE",
      entidadId: cierre.cierreId,
      usuarioId: user.userId,
      detalles: {
        tipo,
        fechaInicio,
        fechaFin,
        totalVentas: cierre.totalVentas,
        totalGastos: cierre.totalGastos,
        ganancias: cierre.ganancias
      }
    });

    return NextResponse.json(cierre, { status: 201 });
  } catch (error) {
    console.error("Error al crear cierre:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}