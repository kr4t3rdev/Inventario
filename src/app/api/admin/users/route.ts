import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { usersGET, usersPOST } from '@/features/admin/api/handlers'

export const dynamic = 'force-dynamic'
export const GET = withAuthGet(usersGET)
export const POST = withAuthPost(usersPOST)
