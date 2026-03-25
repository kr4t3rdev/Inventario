import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest){
    try {
        const clientes = await prisma.cliente.findMany({
            include: {
                Venta:true,
                listaPrecio: true
            }
        })
        return NextResponse.json(clientes)
    } catch (error) {
        console.log('Error al obtener clientes:',error)
        return NextResponse.json({
            error: 'Failed to fetch clientes'
        },{
            status:500
        })
    }
}

export async function POST(request: NextRequest){
    try {
        const body = await request.json()
        const { nombre, numeroCuentaCUP, numeroCuentaUSD, numeroContrato, direccion, telefono, listaPrecioId } = body
        const clientes = await prisma.cliente.create({
            data: {
                nombre,
                direccion,
                telefono,
                numeroCuentaCUP,
                numeroCuentaUSD,
                numeroContrato,
                listaPrecioId,
            }
        })
        return NextResponse.json(clientes)
    } catch (error) {
        console.log('Error al crear clientes:', error)
        return NextResponse.json({
            error: 'Failed to create clientes'
        },{
            status:500
        })
    }

}
