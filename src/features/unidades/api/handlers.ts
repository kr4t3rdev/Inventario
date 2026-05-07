import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function getUnidadesHandler() {
  try {
    const unidades = await prisma.unidad.findMany({ select: { unidadId: true, nombre: true, simbolo: true, createdAt: true, updatedAt: true } })
    return NextResponse.json(unidades)
  } catch (error) {
    console.log('Error al obtener unidades:', error)
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 })
  }
}

export async function createUnidadHandler(request: NextRequest) {
  try {
    const body = await request.json()
    const { nombre, simbolo } = body
    const unidad = await prisma.unidad.create({ data: { nombre, simbolo } })
    return NextResponse.json(unidad)
  } catch (error) {
    console.log('Error al crear unidad:', error)
    return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 })
  }
}

export async function getUnidadByIdHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const unidad = await prisma.unidad.findUnique({
      where: { unidadId: id },
      select: { unidadId: true, nombre: true, simbolo: true, createdAt: true, updatedAt: true },
    })
    if (!unidad) return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 })
    return NextResponse.json(unidad)
  } catch (error) {
    console.error("Error al obtener unidad:", error)
    return NextResponse.json({ error: "Error al obtener unidad" }, { status: 500 })
  }
}

export async function updateUnidadHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { nombre, simbolo } = body
    const unidad = await prisma.unidad.update({ where: { unidadId: id }, data: { nombre, simbolo } })
    return NextResponse.json(unidad)
  } catch (error) {
    console.error("Error al actualizar unidad:", error)
    return NextResponse.json({ error: "Error al actualizar unidad" }, { status: 500 })
  }
}

export async function deleteUnidadHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.unidad.delete({ where: { unidadId: id } })
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("Error al eliminar unidad:", error)
    return NextResponse.json({ error: "Error al eliminar unidad" }, { status: 500 })
  }
}
