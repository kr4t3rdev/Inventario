import { NextRequest, NextResponse } from "next/server"
import type { AuthenticatedUser } from "@/lib/auth-middleware"
import { invalidateDashboardStatsCache, getDashboardStatsData } from "@/features/dashboard/services/dashboard-stats-service"

export async function getDashboardStatsHandler(request: NextRequest, _context: any, user: AuthenticatedUser) {
  try {
    const tenantId = user.tenantId
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant no identificado", code: "TENANT_REQUIRED" },
        { status: 403 },
      )
    }

    const { searchParams } = new URL(request.url)
    const data = await getDashboardStatsData({
      tenantId,
      ubicacionId: searchParams.get("ubicacionId"),
      tipoUbicacion: searchParams.get("tipoUbicacion"),
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error al obtener estadísticas del dashboard:", error)
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
  }
}

export async function invalidateDashboardCacheHandler() {
  try {
    invalidateDashboardStatsCache()
    return NextResponse.json({ message: "Dashboard cache invalidated successfully" })
  } catch (error) {
    console.error("Error invalidating dashboard cache:", error)
    return NextResponse.json({ error: "Failed to invalidate cache" }, { status: 500 })
  }
}
