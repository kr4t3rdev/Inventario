import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { getPlan, updatePlan, deletePlan } from '@/features/planes/api/handlers'

export const dynamic = 'force-dynamic'
export const GET = withAuthGet(getPlan)
export const PUT = withAuthPost(updatePlan)
export const DELETE = withAuthPost(deletePlan)
