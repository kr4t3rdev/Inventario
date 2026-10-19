import { getContratoArchivosHandler, createContratoArchivoHandler } from '@/features/contratos/api/handlers'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth((request, context) => getContratoArchivosHandler(request, context))

export const POST = withAuth((request, context) => createContratoArchivoHandler(request, context))
