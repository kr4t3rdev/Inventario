import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { adminLicenciasGetById, adminLicenciasUpdate, adminLicenciasDelete } from '@/features/admin/api/handlers'

export const dynamic = 'force-dynamic'
export const GET = withAuthGet(adminLicenciasGetById)
export const PUT = withAuthPost(adminLicenciasUpdate)
export const DELETE = withAuthPost(adminLicenciasDelete)
