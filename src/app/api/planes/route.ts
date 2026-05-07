import { withAuthPost } from '@/lib/auth-middleware'
import { listPlanes, createPlan } from '@/features/planes/api/handlers'

export const dynamic = 'force-dynamic'
export { listPlanes as GET }
export const POST = withAuthPost(createPlan)
