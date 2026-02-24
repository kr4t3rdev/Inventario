import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const DefectacionSchema = z.object({
  defecto: z.string().min(1),
  costo: z.number().positive(),
})

export async function GET(request: NextRequest) {
  try {
    const defectaciones = await prisma.defectacionCatalogo.findMany({ orderBy: { defecto: 'asc' } })
    const payload = defectaciones.map((d: any) => ({ id: d.id, defecto: d.defecto, costo: d.costo }))
    return NextResponse.json({ defectaciones: payload })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al leer defectaciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const def = DefectacionSchema.parse(body)
    const created = await prisma.defectacionCatalogo.create({
      data: {
        defecto: def.defecto,
        costo: Math.round(def.costo)
      }
    })
    return NextResponse.json({ id: created.id, defecto: created.defecto, costo: created.costo })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al crear defecto' }, { status: 400 })
  }
}
