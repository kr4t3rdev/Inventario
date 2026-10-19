import { prisma } from "@/lib/prisma"
import { verificarStockBajo as verificarStockBajoDerivado } from "@/lib/verificar-stock"

interface NotificationData {
  title: string
  message: string
  link?: string
  type: "stock_bajo" | "sin_stock" | "transferencia" | "merma" | "venta"
  prioridad: "alta" | "media" | "baja"
  userId?: string
  tenantId?: string
}

export async function crearNotificacion(data: NotificationData) {
  try {
    // `tenantId` y `userId` son parámetros de enrutado, no campos del modelo
    // Notification: se separan para no enviarlos al create.
    const { userId, tenantId, ...camposNotificacion } = data

    // Si no se especifica userId, enviar a todos los usuarios activos del tenant
    if (!userId) {
      if (!tenantId) {
        throw new Error("tenantId is required when creating a broadcast notification")
      }

      // El modelo User no tiene escalar tenantId: la pertenencia al tenant
      // se resuelve por TenantMembership (membresía y usuario activos).
      const membresias = await prisma.tenantMembership.findMany({
        where: { tenantId, isActive: true, user: { isActive: true } },
        select: { userId: true },
      })

      const notificaciones = await Promise.all(
        membresias.map((membresia: { userId: string }) =>
          prisma.notification.create({
            data: {
              ...camposNotificacion,
              userId: membresia.userId,
            },
          }),
        ),
      )

      return notificaciones
    } else {
      const notificacion = await prisma.notification.create({
        data: {
          ...camposNotificacion,
          userId,
        },
      })

      return [notificacion]
    }
  } catch (error) {
    console.error("Error creando notificación:", error)
    throw error
  }
}

export async function verificarStockBajo() {
  const resultado = await verificarStockBajoDerivado()
  return {
    stockBajo: resultado.productosStockBajo,
    sinStock: resultado.productosSinStock,
  }
}

export async function notificarTransferencia(transferenciaId: string) {
  try {
    const transferencia = await prisma.transferencia.findUnique({
      where: { transferenciaId },
      include: {
        producto: true,
        origen: true,
        destino: true,
      },
    })

    if (!transferencia) return

    await crearNotificacion({
      title: "Nueva Transferencia",
      message: `Se transfirieron ${transferencia.cantidad} unidades de "${transferencia.producto?.nombre}" desde ${transferencia.origen?.nombre} hacia ${transferencia.destino?.nombre}`,
      link: "/busy/transferencias",
      type: "transferencia",
      prioridad: "baja",
      tenantId: transferencia.tenantId,
    })
  } catch (error) {
    console.error("Error notificando transferencia:", error)
    throw error
  }
}

export async function notificarMerma(mermaId: string) {
  try {
    const merma = await prisma.merma.findUnique({
      where: { mermaId },
      include: {
        producto: true,
      },
    })

    if (!merma) return

    const prioridad = merma.cantidad > 50 ? "alta" : merma.cantidad > 10 ? "media" : "baja"

    await crearNotificacion({
      title: "Nueva Merma Registrada",
      message: `Se registró una merma de ${merma.cantidad} unidades de "${merma.producto?.nombre}"${merma.motivo ? ` por: ${merma.motivo}` : ""}`,
      link: "/busy/mermas",
      type: "merma",
      prioridad,
      tenantId: merma.tenantId,
    })
  } catch (error) {
    console.error("Error notificando merma:", error)
    throw error
  }
}
