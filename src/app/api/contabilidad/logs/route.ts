import { NextRequest, NextResponse } from "next/server";
import { AuditLogService } from "@/lib/services/audit-log-service";
import { authenticateUser } from "@/lib/auth-middleware";

/**
 * @description Endpoint para obtener los logs de auditoría de contabilidad
 * GET /api/contabilidad/logs
 */
export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    // Solo permitir acceso a administradores
    if (user.role !== 'admin') {
      return NextResponse.json({ error: "Prohibido: Se requiere rol de administrador", code: "FORBIDDEN" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entidad = searchParams.get("entidad") || undefined;
    const usuarioId = searchParams.get("usuarioId") || undefined;
    const accion = searchParams.get("accion") || undefined;
    const desde = searchParams.get("desde") ? new Date(searchParams.get("desde")!) : undefined;
    const hasta = searchParams.get("hasta") ? new Date(searchParams.get("hasta")!) : undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await AuditLogService.getLogs({
      entidad,
      usuarioId,
      accion,
      desde,
      hasta,
      limit,
      offset
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API_CONTABILIDAD_LOGS_GET]", error);
    return NextResponse.json(
      { error: "Error al obtener los logs de auditoría" },
      { status: 500 }
    );
  }
}
