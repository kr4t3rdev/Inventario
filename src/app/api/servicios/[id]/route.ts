import { getServicioByIdHandler, updateServicioHandler, deleteServicioHandler } from '@/features/servicios/api/handlers'

export const GET = getServicioByIdHandler
export const PATCH = updateServicioHandler
export const DELETE = deleteServicioHandler
