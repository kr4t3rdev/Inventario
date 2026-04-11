import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest){
    try {
        const almacenes = await prisma.almacen.findMany({
            select: {
                almacenId: true,
                nombre: true,
                createdAt: true,
                updatedAt: true,
            }
        })
        return NextResponse.json(almacenes)
    } catch (error) {
        console.log('Error al obtener almacenes:',error)
        return NextResponse.json({
            error: 'Failed to fetch almacenes'
        },{
            status:500
        })
    }
}

export async function POST(request: NextRequest){
    try {
        const body = await request.json()
        const { nombre } = body
        const almacen = await prisma.almacen.create({
            data: {
                nombre
            }
        })
        return NextResponse.json(almacen)
    } catch (error) {
        console.log('Error al crear almacen:', error)
        return NextResponse.json({
            error: 'Failed to create almacenes'
        },{
            status:500
        })
    }

}