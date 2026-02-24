import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet } from "@/lib/auth-middleware"

export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const cuentas = await prisma.cuentaBancaria.findMany({
      where: {
        isActive: true
      },
      select: {
        cuentaId: true,
        nombreBanco: true,
        numeroCuenta: true,
        moneda: true,
        tipoCuenta: true
      }
    })

    return NextResponse.json(cuentas)
  } catch (error) {
    console.error("Error al obtener cuentas bancarias:", error)
    return NextResponse.json(
      { error: "Error al obtener cuentas bancarias" },
      { status: 500 }
    )
  }
})
