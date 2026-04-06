import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateUser } from "@/lib/auth-middleware"

export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    
    return NextResponse.json(user)
  } catch (error) {
    console.error("Error verificando token:", error)
    return NextResponse.json({ error: "Token inválido" }, { status: 401 })
  }
}
