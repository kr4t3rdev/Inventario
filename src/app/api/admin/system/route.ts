import { withAuthGet } from '@/lib/auth-middleware'
import { systemGET } from '@/features/admin/api/handlers'

export const dynamic = 'force-dynamic'
export const GET = withAuthGet(systemGET)
