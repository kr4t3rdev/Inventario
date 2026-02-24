import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const vendor = await prisma.vendor.findUnique({
            where:{
                vendorId: id
            },
            include:{
                productos:true,
                contratos:true
            }
        })

        if (!vendor) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

        return NextResponse.json(vendor)
    } catch (error) {
        console.log(error)
        return NextResponse.json({error: 'Error al obtener proveedor'}, {status:500})        
    }
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json()
        const {nombre, direccion, telefono, contacto, cuentaCUP, cuentaUSD, logo, contrato} = body
        const  vendor = await prisma.vendor.update({
            where:{
                vendorId:id
            },
            data:{
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
        return NextResponse.json({error: 'Error al actualizar vendor'}, {status:500})
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const {id} = await context.params
        await prisma.vendor.delete({
            where:{
                vendorId:id
            }
        })
        return NextResponse.json({success:true, id})
    } catch (error) {
        console.log(error)
        return NextResponse.json({error: 'Error al eliminar vendor'}, {status:500})        
    }
}
