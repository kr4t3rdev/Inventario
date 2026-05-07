import { withAuth } from '@/lib/auth-middleware'
import { getCompraServicioByIdHandler, updateCompraServicioHandler, deleteCompraServicioHandler } from '@/features/compras-servicios/api/handlers'

export const GET = withAuth(getCompraServicioByIdHandler)
export const PATCH = withAuth(updateCompraServicioHandler)
export const DELETE = withAuth(deleteCompraServicioHandler)
