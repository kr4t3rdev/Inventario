import { getContratoByIdHandler, updateContratoHandler, deleteContratoHandler } from '@/features/contratos/api/handlers'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth((request, context) => getContratoByIdHandler(request, context))

export const PUT = withAuth((request, context) => updateContratoHandler(request, context))

export const DELETE = withAuth((request, context) => deleteContratoHandler(request, context))
