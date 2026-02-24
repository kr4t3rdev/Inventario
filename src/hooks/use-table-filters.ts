import { useState, useMemo } from 'react'

export interface FilterConfig {
  search: string
  dateRange: {
    from: Date | null
    to: Date | null
  }
  currency: string
  status: string
  account: string
  paymentType: string
}

export interface FilterOptions {
  currencies: Array<{ value: string; label: string }>
  accounts: Array<{ value: string; label: string }>
  paymentTypes: Array<{ value: string; label: string }>
  statuses: Array<{ value: string; label: string }>
}

export function useTableFilters<T>(
  data: T[],
  filterFn: (item: T, filters: FilterConfig) => boolean
) {
  const [filters, setFilters] = useState<FilterConfig>({
    search: '',
    dateRange: { from: null, to: null },
    currency: '',
    status: '',
    account: '',
    paymentType: ''
  })

  const filteredData = useMemo(() => {
    return data.filter(item => filterFn(item, filters))
  }, [data, filters, filterFn])

  const updateFilter = <K extends keyof FilterConfig>(
    key: K,
    value: FilterConfig[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      dateRange: { from: null, to: null },
      currency: '',
      status: '',
      account: '',
      paymentType: ''
    })
  }

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.dateRange.from !== null ||
      filters.dateRange.to !== null ||
      filters.currency !== '' ||
      filters.status !== '' ||
      filters.account !== '' ||
      filters.paymentType !== ''
    )
  }, [filters])

  return {
    filters,
    filteredData,
    updateFilter,
    clearFilters,
    hasActiveFilters
  }
}