import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateVendorEan13 } from "@/lib/vendor-code-utils";

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

        const ean13Code = vendor.vendorCode ? generateVendorEan13(vendor.vendorCode) : null

        return NextResponse.json({
            ...vendor,
            ean13Code
        })
    } catch (error) {
        console.error('Error fetching vendor:', error)
        return NextResponse.json({error: 'Error al obtener proveedor'}, {status:500})        
    }
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json()
        const {nombre, direccion, telefono, contacto, cuentaCUP, cuentaUSD, logo, contrato, vendorCode} = body

        // Bloquear intentos de modificar vendorCode
        if (vendorCode) {
            return NextResponse.json(
                { error: 'El código del proveedor no puede ser modificado' },
                { status: 400 }
            )
        }

        const vendor = await prisma.vendor.update({
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
                // vendorCode omitido intencionalmente
            }
        })

        const ean13Code = vendor.vendorCode ? generateVendorEan13(vendor.vendorCode) : null

        return NextResponse.json({
            ...vendor,
            ean13Code
        })
    } catch (error) {
        console.error('Error updating vendor:', error)
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
        console.error('Error deleting vendor:', error)
        return NextResponse.json({error: 'Error al eliminar vendor'}, {status:500})        
    }
}

