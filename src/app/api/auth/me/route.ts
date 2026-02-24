import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verify_token } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  try {
    const user = await verify_token(request)
    
    if (!user) {
      return NextResponse.json({ error: "Token inválido o usuario no encontrado" }, { status: 401 })
    }
    
    return NextResponse.json(user)
  } catch (error) {
    console.error("Error verificando token:", error)
    return NextResponse.json({ error: "Token inválido" }, { status: 401 })
  }
}
