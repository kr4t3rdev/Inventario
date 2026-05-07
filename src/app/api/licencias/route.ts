import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { listLicencias, createLicencia } from '@/features/licencias/api/handlers'

export const dynamic = 'force-dynamic'
export const GET = withAuthGet(listLicencias)
export const POST = withAuthPost(createLicencia)
