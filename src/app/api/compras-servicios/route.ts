import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { getComprasServiciosHandler, createCompraServicioHandler } from '@/features/compras-servicios/api/handlers'

export const GET = withAuthGet(getComprasServiciosHandler)
export const POST = withAuthPost(createCompraServicioHandler)
