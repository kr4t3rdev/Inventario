import { getContratoFirmasHandler, createContratoFirmaHandler } from '@/features/contratos/api/handlers'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth((request, context) => getContratoFirmasHandler(request, context))

export const POST = withAuth((request, context) => createContratoFirmaHandler(request, context))
