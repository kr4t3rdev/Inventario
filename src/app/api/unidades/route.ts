import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest){
    try {
        const unidades = await prisma.unidad.findMany({
            include: {
                productos:true
            }
        })
        return NextResponse.json(unidades)
    } catch (error) {
        console.log('Error al obtener unidades:',error)
        return NextResponse.json({
            error: 'Failed to fetch units'
        },{
            status:500
        })
    }
}

export async function POST(request: NextRequest){
    try {
        const body = await request.json()
        const { nombre, simbolo} = body
        const unidad = await prisma.unidad.create({
            data: {
                nombre,
                simbolo
            }
        })
        return NextResponse.json(unidad)
    } catch (error) {
        console.log('Error al crear unidad:', error)
        return NextResponse.json({
            error: 'Failed to create unit'
        },{
            status:500
        })
    }

}