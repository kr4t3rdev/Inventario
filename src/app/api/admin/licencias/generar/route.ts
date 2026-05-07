import { withAuthPost } from '@/lib/auth-middleware'
import { adminLicenciasGenerarPOST } from '@/features/admin/api/handlers'

export const dynamic = 'force-dynamic'
export const POST = withAuthPost(adminLicenciasGenerarPOST)
