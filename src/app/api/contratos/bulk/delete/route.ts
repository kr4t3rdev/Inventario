import { bulkDeleteContratosHandler } from '@/features/contratos/api/handlers'
import { withAuth } from '@/lib/auth-middleware'

export const POST = withAuth((request) => bulkDeleteContratosHandler(request))
