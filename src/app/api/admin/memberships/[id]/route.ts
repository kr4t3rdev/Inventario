import { withAuth } from '@/lib/auth-middleware'
import { membershipsUpdate } from '@/features/admin/api/handlers'

export const dynamic = 'force-dynamic'
export const PATCH = withAuth(membershipsUpdate)
