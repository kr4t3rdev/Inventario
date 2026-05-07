import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { adminPlanesGetById, adminPlanesUpdate, adminPlanesDelete } from '@/features/admin/api/handlers'

export const dynamic = 'force-dynamic'
export const GET = withAuthGet(adminPlanesGetById)
export const PUT = withAuthPost(adminPlanesUpdate)
export const DELETE = withAuthPost(adminPlanesDelete)
