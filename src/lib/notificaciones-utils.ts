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
    // Si no se especifica userId, enviar a todos los usuarios activos del tenant
    if (!data.userId) {
      if (!data.tenantId) {
        throw new Error("tenantId is required when creating a broadcast notification")
      }

      const usuarios = await prisma.user.findMany({
        where: { isActive: true, tenantId: data.tenantId },
        select: { userId: true },
      })

      const notificaciones = await Promise.all(
        usuarios.map((usuario: { userId: string }) =>
          prisma.notification.create({
            data: {
              ...data,
              userId: usuario.userId,
            },
          }),
        ),
      )

      return notificaciones
    } else {
      const { userId, ...restData } = data
      const notificacion = await prisma.notification.create({
        data: {
          ...restData,
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
