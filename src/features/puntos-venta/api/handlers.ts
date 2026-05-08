import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateUser, type AuthenticatedUser } from "@/lib/auth-middleware"
import { requireTenant } from "@/lib/services/tenant-scope"

export async function createPuntoDeVentaHandler(req: NextRequest) {
  try {
    const authResult = await authenticateUser(req)
    if ('status' in authResult) return authResult as Response
    const user = authResult.user as AuthenticatedUser
    const tenantId = requireTenant(user)
    const body = await req.json()
    const { nombre, ubicacion, listaPrecioId } = body
    const puntoDeVenta = await prisma.puntoDeVenta.create({
      data: {
        nombre,
        ubicacion,
        listaPrecio: listaPrecioId ? { connect: { id: listaPrecioId } } : undefined,
        tenant: { connect: { tenantId } },
      },
    })
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
    const listaPrecioValue = listaPrecioId ?? null
    const puntoDeVenta = await prisma.puntoDeVenta.update({
      where: { pvId: id },
      data: {
        nombre,
        ubicacion,
        listaPrecio: listaPrecioValue === null
          ? { disconnect: true }
          : { connect: { id: listaPrecioValue } },
      },
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
