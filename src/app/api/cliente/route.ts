import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthGet, withAuthPost, type AuthenticatedUser } from "@/lib/auth-middleware";
import { requireTenant } from "@/lib/services/tenant-scope";

export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
    try {
        const tenantId = requireTenant(user);
        const clientes = await prisma.cliente.findMany({
            where: { tenantId },
            include: {
                Venta: true
            }
        })
        return NextResponse.json(clientes)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch clientes'
        console.log('Error al obtener clientes:', message)
        return NextResponse.json({
            error: message
        },{
            status:500
        })
    }
})

export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
    try {
        const tenantId = requireTenant(user);
        const body = await request.json()
        const { nombre, numeroCuentaCUP, numeroCuentaUSD, numeroContrato, direccion, telefono } = body
        const clientes = await prisma.cliente.create({
            data: {
                nombre,
                direccion,
                telefono,
                numeroCuentaCUP,
                numeroCuentaUSD,
                numeroContrato,
                tenantId
            }
        })
        return NextResponse.json(clientes)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create clientes'
        console.log('Error al crear clientes:', message)
        return NextResponse.json({
            error: message
        },{
            status:500
        })
    }

})
