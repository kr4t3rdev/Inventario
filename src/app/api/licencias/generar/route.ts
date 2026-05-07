import { withAuthPost } from '@/lib/auth-middleware'
import { generarLicencias } from '@/features/licencias/api/handlers'

export const dynamic = 'force-dynamic'
export const POST = withAuthPost(generarLicencias)
