import { getContratoAlertasHandler, createContratoAlertaHandler } from '@/features/contratos/api/handlers'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth((request, context) => getContratoAlertasHandler(request, context))

export const POST = withAuth((request, context) => createContratoAlertaHandler(request, context))
