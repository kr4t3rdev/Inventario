import { type NextRequest, NextResponse } from "next/server"
import { verify_token } from "@/lib/auth-utils"
import { verificarStockBajo } from "../../../../lib/notificaciones-utils"

export async function POST(request: NextRequest) {
  try {
    const user = await verify_token(request)
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const resultado = await verificarStockBajo()

    return NextResponse.json({
      success: true,
      mensaje: `Verificación completada. ${resultado.stockBajo} productos con stock bajo, ${resultado.sinStock} productos sin stock`,
      ...resultado,
    })
  } catch (error) {
    console.error("Error verificando stock:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
