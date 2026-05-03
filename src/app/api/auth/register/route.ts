import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { normalizeUserRole } from "@/lib/auth/roles"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: "El usuario ya existe" }, { status: 409 })
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 12)

    // Crear usuario
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: normalizeUserRole('user')!,
        isActive: false,
      },
    })

    return NextResponse.json({
      message: "Su solicitud está siendo revisada por el administrador",
      success: true,
    })
  } catch (error) {
    console.error("Error en registro:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
