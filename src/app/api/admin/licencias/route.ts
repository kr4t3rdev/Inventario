import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { adminLicenciasGET, adminLicenciasPOST } from '@/features/admin/api/handlers'

export const dynamic = 'force-dynamic'
export const GET = withAuthGet(adminLicenciasGET)
export const POST = withAuthPost(adminLicenciasPOST)
