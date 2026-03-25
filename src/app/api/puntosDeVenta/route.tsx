import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const puntoDeVenta = await prisma.puntoDeVenta.findMany({
        orderBy: {
            createdAt: 'desc'
        },
        include: {
            listaPrecio: true
        }
    })
    return NextResponse.json(puntoDeVenta)
  } catch (error) {
    console.error("Error al obtener puntoDeVenta:", error)
    return NextResponse.json({ error: "Error al obtener puntoDeVenta" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, ubicacion, listaPrecioId } = body
    const puntoDeVenta = await prisma.puntoDeVenta.create({
            data: {
                nombre,
                ubicacion,
                listaPrecioId
            }
    })
    return NextResponse.json(puntoDeVenta)
  } catch (error) {
    console.error("Error al obtener transferencias:", error)
    return NextResponse.json({ error: "Error al obtener transferencias" }, { status: 500 })
  }
}