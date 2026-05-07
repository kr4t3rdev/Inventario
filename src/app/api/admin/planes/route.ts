import { withAuthPost } from '@/lib/auth-middleware'
import { adminPlanesGET, adminPlanesPOST } from '@/features/admin/api/handlers'

export const dynamic = 'force-dynamic'
export { adminPlanesGET as GET }
export const POST = withAuthPost(adminPlanesPOST)
