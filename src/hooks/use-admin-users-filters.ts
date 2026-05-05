'use client'

import { useCallback, useMemo, useState } from 'react'

export interface AdminUsersFilters {
  search: string
  tenantId: string
  role: string
  isActive: string
  page: number
  limit: number
  sortBy: 'name' | 'email' | 'createdAt' | 'expiresAt'
  sortOrder: 'asc' | 'desc'
}

const DEFAULT_FILTERS: AdminUsersFilters = {
  search: '',
  tenantId: '',
  role: '',
  isActive: '',
  page: 1,
  limit: 25,
  sortBy: 'createdAt',
  sortOrder: 'desc',
}

export function useAdminUsersFilters(initial?: Partial<AdminUsersFilters>) {
  const [filters, setFilters] = useState<AdminUsersFilters>({
    ...DEFAULT_FILTERS,
    ...initial,
  })

  const setFilter = useCallback(<K extends keyof AdminUsersFilters>(
    key: K,
    value: AdminUsersFilters[K],
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key !== 'page' ? { page: 1 } : {}),
    }))
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const setSort = useCallback((
    sortBy: AdminUsersFilters['sortBy'],
    sortOrder: AdminUsersFilters['sortOrder'],
  ) => {
    setFilters((prev) => ({ ...prev, sortBy, sortOrder, page: 1 }))
  }, [])

  const toggleSort = useCallback((column: AdminUsersFilters['sortBy']) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  const queryParams = useMemo(() => ({
    search: filters.search || undefined,
    tenantId: filters.tenantId || undefined,
    role: filters.role || undefined,
    isActive: filters.isActive || undefined,
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }), [filters])

  return {
    filters,
    queryParams,
    setFilter,
    setPage,
    setSort,
    toggleSort,
    resetFilters,
  }
}
