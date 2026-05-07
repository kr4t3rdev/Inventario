import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { getLicencia, updateLicencia, deleteLicencia } from '@/features/licencias/api/handlers'

export const dynamic = 'force-dynamic'
export const GET = withAuthGet(getLicencia)
export const PUT = withAuthPost(updateLicencia)
export const DELETE = withAuthPost(deleteLicencia)
