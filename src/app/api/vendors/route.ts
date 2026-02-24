import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const vendors = await prisma.vendor.findMany({
            include:{
                productos:true,
                contratos:true
            }
        })
        return NextResponse.json(vendors)
    } catch (error) {
        console.log(error)
        return NextResponse.json({error: 'Error al obtener vendors'}, {status:500})
    }
}
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {nombre, direccion, telefono, contacto, cuentaCUP, cuentaUSD, logo, contrato} = body
        const vendor = await prisma.vendor.create({
            data: {
                nombre,
                direccion,
                telefono,
                contacto,
                cuentaCUP,
                cuentaUSD,
                logo,
                contrato
            }
        })
        return NextResponse.json(vendor)
    } catch (error) {
        console.log(error)
        return NextResponse.json({error: 'Error al crear vendors'}, {status:500})
    }
}