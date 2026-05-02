import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth, withAuthGet, type AuthenticatedUser } from "@/lib/auth-middleware"
import { requireTenant, assertTenantAccess } from "@/lib/services/tenant-scope"

export const GET = withAuthGet(async (req: NextRequest, context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const { id } = await context.params
    const cliente = await prisma.cliente.findUnique({
      where: { clienteId: id },
      include: { 
        Venta: true,
      },
    })

    if (!cliente) {
      return NextResponse.json({ error: "cliente no encontrado" }, { status: 404 })
    }

    assertTenantAccess(cliente.tenantId, tenantId, 'Cliente')

    return NextResponse.json(cliente)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al obtener cliente"
    console.error("Error al obtener cliente:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const PATCH = withAuth(async (request: NextRequest, context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const { id } = await context.params;
    const body = await request.json()
    const { nombre, numeroCuentaCUP, numeroCuentaUSD, numeroContrato, direccion, telefono } = body

    const existing = await prisma.cliente.findUnique({ where: { clienteId: id }, select: { tenantId: true } })
    assertTenantAccess(existing?.tenantId, tenantId, 'Cliente')

    const cliente = await prisma.cliente.update({
      where: { clienteId: id },
      data: {
        nombre,
        direccion,
        telefono,
        numeroCuentaCUP,
        numeroCuentaUSD,
        numeroContrato,
      },
    })

    return NextResponse.json(cliente)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar cliente"
    console.error("Error al actualizar cliente:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withAuth(async (request: NextRequest, context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const { id } = await context.params;

    const existing = await prisma.cliente.findUnique({ where: { clienteId: id }, select: { tenantId: true } })
    assertTenantAccess(existing?.tenantId, tenantId, 'Cliente')

    await prisma.cliente.delete({
      where: { clienteId: id },
    })

    return NextResponse.json({ success: true, id: id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar cliente"
    console.error("Error al eliminar cliente:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
