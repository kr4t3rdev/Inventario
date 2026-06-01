import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTenant } from "@/lib/services/tenant-scope"
import type { AuthenticatedUser } from "@/lib/auth-middleware"

// ─── Empleados ─────────────────────────────────────────────────────────────────

export async function getEmpleadosHandler(_request: NextRequest, _context: any, user: AuthenticatedUser) {
  try {
    const tenantId = requireTenant(user);
    const empleados = await prisma.empleado.findMany({
      where: { tenantId },
      orderBy: { salarioBases: "desc" },
    })

    return NextResponse.json(empleados)
  } catch (error) {
    console.error("Error al obtener empleados:", error)
    return NextResponse.json({ error: "Error al obtener empleados" }, { status: 500 })
  }
}

export async function createEmpleadoHandler(request: NextRequest, context: any, user: any) {
  try {
    const tenantId = requireTenant(user);
    const data = await request.json()
    const {
      nombre,
      apellido,
      telefono,
      cargo,
      salarioBases,
      fechaContratacion,
      esTiempoCompleto = true,
      diasVacacionesAnuales = 15
    } = data

    const empleado = await prisma.empleado.create({
      data: {
        nombre,
        apellido,
        telefono,
        cargo,
        salarioBases,
        fechaContratacion: fechaContratacion ? new Date(fechaContratacion) : new Date(),
        esTiempoCompleto,
        diasVacacionesAnuales,
        tenant: { connect: { tenantId } }
      },
    })

    return NextResponse.json(empleado)
  } catch (error) {
    console.error("Error al crear empleado:", error)
    return NextResponse.json({ error: "Error al crear empleado" }, { status: 500 })
  }
}

export async function getEmpleadoByIdHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const empleado = await prisma.empleado.findUnique({
      where: { empleadoId: id },
      include: {
        ventas: {
          include: {
            producto: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    })

    if (!empleado) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 })
    }

    return NextResponse.json(empleado)
  } catch (error) {
    console.error("Error al obtener empleado:", error)
    return NextResponse.json({ error: "Error al obtener empleado" }, { status: 500 })
  }
}

export async function updateEmpleadoHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const {
      nombre,
      apellido,
      telefono,
      cargo,
      salarioBases,

    } = await request.json()

    const empleado = await prisma.empleado.update({
      where: { empleadoId: id },
      data: {
        nombre,
        apellido,
        telefono,
        cargo,
        salarioBases,

      },
    })

    return NextResponse.json(empleado)
  } catch (error) {
    console.error("Error al actualizar empleado:", error)
    return NextResponse.json({ error: "Error al actualizar empleado" }, { status: 500 })
  }
}

export async function deleteEmpleadoHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await prisma.empleado.delete({
      where: { empleadoId: id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar empleado:", error)
    return NextResponse.json({ error: "Error al eliminar empleado" }, { status: 500 })
  }
}

