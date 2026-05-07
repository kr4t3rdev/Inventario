import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { getVentaServiciosHandler, createVentaServicioHandler } from '@/features/venta-servicios/api/handlers'

export const GET = withAuthGet(getVentaServiciosHandler)
export const POST = withAuthPost(createVentaServicioHandler)
