import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost, type AuthenticatedUser } from "@/lib/auth-middleware"
import { requireTenant } from "@/lib/services/tenant-scope"

// GET: Listar órdenes
export const GET = withAuthGet(async (request: NextRequest, _ctx: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const searchParams = request.nextUrl.searchParams
    const estado = searchParams.get("estado")
    const search = searchParams.get("search")

    const whereClause: any = { tenantId };

    if (estado && estado !== "TODOS") {
      whereClause.estado = estado
    }

    if (search) {
      const orConditions: any[] = [
        { cliente: { nombre: { contains: search } } },
        { marca: { contains: search } },
        { numeroSerie: { contains: search } },
        {
          equipos: {
            some: {
              OR: [
                { marca: { contains: search } },
                { numeroSerie: { contains: search } },
                { equipoTipo: { nombre: { contains: search } } },
              ],
            },
          },
        },
      ]

      const searchAsNumber = parseInt(search)
      if (!isNaN(searchAsNumber)) {
        orConditions.push({ numeroOrden: { equals: searchAsNumber } })
      }

      whereClause.OR = orConditions
    }

    const ordenes = await prisma.ordenReparacion.findMany({
      where: whereClause,
      include: {
        cliente: {
          select: { nombre: true, telefono: true }
        },
        equipoTipo: {
          select: { nombre: true }
        },
        equipos: {
          include: {
            equipoTipo: { select: { nombre: true } },
          },
        },
        tecnico: {
          select: { nombre: true, apellido: true }
        }
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(ordenes)
  } catch (error) {
    console.error("Error al obtener órdenes:", error)
    return NextResponse.json({ error: "Error al obtener órdenes" }, { status: 500 })
  }
})

// POST: Crear nueva orden (Recepción)
export const POST = withAuthPost(async (request: NextRequest, context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const data = await request.json()

    const equiposInput = Array.isArray(data.equipos) ? data.equipos : []
    const equiposNormalized = equiposInput.length > 0
      ? equiposInput
      : [
          {
            equipoTipoId: data.equipoTipoId,
            marca: data.marca,
            modelo: data.modelo,
            numeroSerie: data.numeroSerie,
            contrasena: data.contrasena,
            accesorios: data.accesorios,
            problemaReportado: data.problemaReportado,
            fotos: data.fotos,
          },
        ]

    const primaryEquipo = equiposNormalized[0]

    // Validaciones básicas
    if (!data.clienteId || !primaryEquipo?.equipoTipoId) {
      return NextResponse.json({ error: "Cliente y Tipo de Equipo son requeridos" }, { status: 400 })
    }

    if (!primaryEquipo?.marca || !primaryEquipo?.problemaReportado) {
      return NextResponse.json({ error: "Marca y problema reportado son requeridos" }, { status: 400 })
    }

    // Obtener información del cliente y equipo para el recibo
    const [cliente, equipoTipo] = await Promise.all([
      prisma.cliente.findUnique({ where: { clienteId: data.clienteId } }),
      prisma.equipoReparacion.findUnique({ where: { id: primaryEquipo.equipoTipoId } })
    ])

    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    // Crear orden y recibo en una transacción
    const resultado = await prisma.$transaction(async (tx: any) => {
      // Crear la orden de reparación
      const nuevaOrden = await tx.ordenReparacion.create({
        data: {
          tenantId,
          clienteId: data.clienteId,
          equipoTipoId: primaryEquipo.equipoTipoId,
          marca: primaryEquipo.marca,
          modelo: primaryEquipo.modelo,
          numeroSerie: primaryEquipo.numeroSerie,
          contrasena: primaryEquipo.contrasena,
          accesorios: primaryEquipo.accesorios,
          problemaReportado: primaryEquipo.problemaReportado,
          prioridad: data.prioridad || "NORMAL",
          esGarantia: data.esGarantia || false,
          estado: "RECIBIDO",
          moneda: "USD",
          tecnicoId: data.tecnicoId,
          fotos: data.fotos || [],
          equipos: {
            create: equiposNormalized.map((equipo: any) => ({
              equipoTipoId: equipo.equipoTipoId,
              marca: equipo.marca,
              modelo: equipo.modelo,
              numeroSerie: equipo.numeroSerie,
              contrasena: equipo.contrasena,
              accesorios: equipo.accesorios,
              problemaReportado: equipo.problemaReportado,
              fotos: equipo.fotos ?? [],
            })),
          },
        },
      })

      // Crear el recibo de recepción
      const equipoInfo = `${equipoTipo?.nombre || 'Equipo'} ${primaryEquipo.marca}${primaryEquipo.modelo ? ` ${primaryEquipo.modelo}` : ''}`
      const fotosTotales = [
        ...(data.fotos || []),
        ...equiposNormalized.flatMap((e: any) => e.fotos || [])
      ]

      const recibo = await tx.reciboOrdenReparacion.create({
        data: {
          ordenId: nuevaOrden.id,
          clienteNombre: cliente.nombre,
          equipoInfo: equipoInfo,
          problema: primaryEquipo.problemaReportado,
          estadoInicial: "RECIBIDO",
          fotosIniciales: fotosTotales,
          observaciones: data.observaciones || null,
        },
      })

      return { orden: nuevaOrden, recibo }
    })

    return NextResponse.json({
      success: true,
      orden: resultado.orden,
      recibo: resultado.recibo,
      message: "Orden creada exitosamente. Recibo generado."
    })
  } catch (error) {
    console.error("Error al crear orden:", error)
    return NextResponse.json({ error: "Error al crear orden" }, { status: 500 })
  }
})
