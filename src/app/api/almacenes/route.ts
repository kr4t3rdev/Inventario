import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthGet, withAuthPost, type AuthenticatedUser } from "@/lib/auth-middleware";
import { requireTenant } from "@/lib/services/tenant-scope";

export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
    try {
        const tenantId = requireTenant(user);
        const almacenes = await prisma.almacen.findMany({
            where: { tenantId },
            select: {
                almacenId: true,
                nombre: true,
                createdAt: true,
                updatedAt: true,
            }
        })
        return NextResponse.json(almacenes)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch almacenes'
        console.log('Error al obtener almacenes:', message)
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
        const { nombre } = body
        const almacen = await prisma.almacen.create({
            data: {
                nombre,
                tenantId
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

})