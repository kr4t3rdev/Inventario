import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const cliente = await prisma.cliente.findUnique({
      where: { clienteId: id },
      include: { Venta: true },
    })

    if (!cliente) {
      return NextResponse.json({ error: "cliente no encontrado" }, { status: 404 })
    }

    return NextResponse.json(cliente)
  } catch (error) {
    console.error("Error al obtener cliente:", error)
    return NextResponse.json({ error: "Error al obtener cliente" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json()
    const { nombre, numeroCuentaCUP, numeroCuentaUSD, numeroContrato, direccion, telefono } = body

    const cliente = await prisma.cliente.update({
      where: { clienteId: id },
      data: {
        nombre,
        direccion,
        telefono,
        numeroCuentaCUP,
        numeroCuentaUSD,
        numeroContrato,
      },
    })

    return NextResponse.json(cliente)
  } catch (error) {
    console.error("Error al actualizar cliente:", error)
    return NextResponse.json({ error: "Error al actualizar cliente" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.cliente.delete({
      where: { clienteId: id },
    })

    return NextResponse.json({ success: true, id: id })
  } catch (error) {
    console.error("Error al eliminar cliente:", error)
    return NextResponse.json({ error: "Error al eliminar cliente" }, { status: 500 })
  }
}
