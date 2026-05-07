import { withAuthPost } from '@/lib/auth-middleware'
import { adminLicenciasInitPOST } from '@/features/admin/api/handlers'

export const dynamic = 'force-dynamic'
export const POST = withAuthPost(adminLicenciasInitPOST)
