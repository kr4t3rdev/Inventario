import { getContratoAprobacionesHandler, createContratoAprobacionHandler } from '@/features/contratos/api/handlers'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth((request, context) => getContratoAprobacionesHandler(request, context))

export const POST = withAuth((request, context) => createContratoAprobacionHandler(request, context))
