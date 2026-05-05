import type { Usuario } from '@/app/models/model'

export interface UsuarioWithTenant extends Usuario {
  tenantId: string
  tenantSlug: string | null
  tenantName: string
  tenantRole: string
  membershipId: string
}

export interface GlobalUsersResponse {
  users: UsuarioWithTenant[]
  total: number
  page: number
  pages: number
  limit: number
}

export interface GlobalUsersQuery {
  tenantId?: string
  search?: string
  role?: string
  isActive?: boolean
  page?: number
  limit?: number
  sortBy?: 'name' | 'email' | 'createdAt' | 'expiresAt'
  sortOrder?: 'asc' | 'desc'
}
