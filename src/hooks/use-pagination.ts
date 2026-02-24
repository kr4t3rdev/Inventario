import { useState, useMemo } from 'react'

export interface PaginationConfig {
  page: number
  pageSize: number
  total: number
}

export interface PaginationResult<T> {
  data: T[]
  pagination: PaginationConfig
  hasNextPage: boolean
  hasPreviousPage: boolean
  totalPages: number
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  nextPage: () => void
  previousPage: () => void
}

export function usePagination<T>(
  data: T[],
  initialPageSize: number = 10
): PaginationResult<T> {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    return data.slice(startIndex, endIndex)
  }, [data, page, pageSize])

  const totalPages = Math.ceil(data.length / pageSize)
  const hasNextPage = page < totalPages
  const hasPreviousPage = page > 1

  const nextPage = () => {
    if (hasNextPage) {
      setPage(page + 1)
    }
  }

  const previousPage = () => {
    if (hasPreviousPage) {
      setPage(page - 1)
    }
  }

  const handleSetPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  const handleSetPageSize = (newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1) // Reset to first page when changing page size
  }

  return {
    data: paginatedData,
    pagination: {
      page,
      pageSize,
      total: data.length
    },
    hasNextPage,
    hasPreviousPage,
    totalPages,
    setPage: handleSetPage,
    setPageSize: handleSetPageSize,
    nextPage,
    previousPage
  }
}