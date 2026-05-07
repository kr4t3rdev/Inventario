import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function getPuntosDeVentaHandler() {
  try {
    const puntoDeVenta = await prisma.puntoDeVenta.findMany({
      orderBy: { createdAt: 'desc' },
      include: { listaPrecio: true },
    })
    return NextResponse.json(puntoDeVenta)
  } catch (error) {
    console.error("Error al obtener puntoDeVenta:", error)
    return NextResponse.json({ error: "Error al obtener puntoDeVenta" }, { status: 500 })
  }
}

export async function createPuntoDeVentaHandler(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, ubicacion, listaPrecioId } = body
    const puntoDeVenta = await prisma.puntoDeVenta.create({ data: { nombre, ubicacion, listaPrecioId } })
    return NextResponse.json(puntoDeVenta)
  } catch (error) {
    console.error("Error al crear punto de venta:", error)
    return NextResponse.json({ error: "Error al crear punto de venta" }, { status: 500 })
  }
}

export async function getPuntoDeVentaByIdHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const puntoDeVenta = await prisma.puntoDeVenta.findUnique({
      where: { pvId: id },
      include: { listaPrecio: true },
    })
    if (!puntoDeVenta) return NextResponse.json({ error: "Punto de venta no encontrado" }, { status: 404 })
    return NextResponse.json(puntoDeVenta)
  } catch (error) {
    console.error("Error al obtener punto de venta:", error)
    return NextResponse.json({ error: "Error al obtener punto de venta" }, { status: 500 })
  }
}

export async function updatePuntoDeVentaHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { nombre, ubicacion, listaPrecioId } = body
    const puntoDeVenta = await prisma.puntoDeVenta.update({
      where: { pvId: id },
      data: { nombre, ubicacion, listaPrecioId: listaPrecioId ?? null },
    })
    return NextResponse.json(puntoDeVenta)
  } catch (error) {
    console.error("Error al actualizar punto de venta:", error)
    return NextResponse.json({ error: "Error al actualizar punto de venta" }, { status: 500 })
  }
}

export async function deletePuntoDeVentaHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.puntoDeVenta.delete({ where: { pvId: id } })
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("Error al eliminar punto de venta:", error)
    return NextResponse.json({ error: "Error al eliminar punto de venta" }, { status: 500 })
  }
}
