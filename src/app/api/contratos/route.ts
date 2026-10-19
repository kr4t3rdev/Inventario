import { getContratosHandler, createContratoHandler } from '@/features/contratos/api/handlers'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth((request) => getContratosHandler(request))

export const POST = withAuth((request) => createContratoHandler(request))
