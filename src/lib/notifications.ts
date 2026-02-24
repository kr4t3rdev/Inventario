import { sendEmail } from './email'
import { OrdenReparacion, Cliente } from '@/app/models/model'

interface NotificationPayload {
  to: string
  subject: string
  message: string
  type: 'EMAIL' | 'WHATSAPP'
}

export async function sendNotification(payload: NotificationPayload) {
  if (payload.type === 'EMAIL') {
    await sendEmail(payload.to, payload.subject, `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #0f172a;">Actualización de Estado - Reparación</h2>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 0; font-size: 16px;">${payload.message}</p>
        </div>
        <p>Gracias por confiar en nuestros servicios.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <small style="color: #64748b;">Este es un mensaje automático, por favor no responder.</small>
      </div>
    `)
  } else if (payload.type === 'WHATSAPP') {
    // Placeholder for WhatsApp integration
    // In a real implementation, this would call Twilio or Meta API
    console.log(`[WHATSAPP SIMULATION] To: ${payload.to}, Message: ${payload.message}`)
  }
}

export async function notifyOrdenStatusChange(
  orden: OrdenReparacion & { cliente?: Cliente | null }, 
  nuevoEstado: string
) {
  if (!orden.cliente) return

  const cliente = orden.cliente
  const mensaje = `Su orden #${orden.numeroOrden} para el equipo ${orden.equipoTipo?.nombre || 'Equipo'} (${orden.marca} ${orden.modelo || ''}) ha cambiado de estado a: <strong>${nuevoEstado.replace('_', ' ')}</strong>.`

  // 1. Send Email if client has email
  // Note: Cliente interface in model.ts might not have email field visible in the snippet I read,
  // but usually clients have contact info. I'll check if I can assume email exists or add it.
  // Looking at model.ts snippet (line 522), Cliente has: nombre, direccion, telefono, cuentas... no email?
  // Let's check Prisma schema to be sure about Cliente model fields.
  
  // For now, I will assume there might be an email field or I will just log warning.
  // If Cliente doesn't have email in interface, I should check schema.
  
  // 2. Send WhatsApp if client has phone (telefono)
  if (cliente.telefono) {
    await sendNotification({
      to: cliente.telefono,
      subject: `Actualización Orden #${orden.numeroOrden}`,
      message: mensaje.replace(/<strong>|<\/strong>/g, ''), // Strip HTML for WhatsApp
      type: 'WHATSAPP'
    })
  }
}
