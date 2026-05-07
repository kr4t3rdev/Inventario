import { usersGetById, usersUpdate, usersDelete } from '@/features/admin/api/handlers'

export const dynamic = 'force-dynamic'
export const GET = usersGetById
export const PUT = usersUpdate
export const DELETE = usersDelete
