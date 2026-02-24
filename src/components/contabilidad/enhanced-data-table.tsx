'use client'

import { useState, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PaginationControls } from './pagination-controls'
import { TableFilters } from './table-filters'
import { KeyboardShortcutsHelp } from './keyboard-shortcuts-help'
import { usePagination } from '@/hooks/use-pagination'
import { useTableFilters, FilterOptions } from '@/hooks/use-table-filters'
import { useKeyboardShortcuts, contabilidadShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { Search, Download, RefreshCw } from 'lucide-react'

interface Column<T> {
  key: keyof T | string
  header: string
  cell: (item: T) => React.ReactNode
  sortable?: boolean
  filterable?: boolean
}

interface EnhancedDataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  title: string
  description?: string
  filterOptions: FilterOptions
  filterFn: (item: T, filters: any) => boolean
  onExport?: () => void
  onRefresh?: () => void
  loading?: boolean
  actions?: React.ReactNode
  emptyMessage?: string
}

export function EnhancedDataTable<T>({
  data,
  columns,
  title,
  description,
  filterOptions,
  filterFn,
  onExport,
  onRefresh,
  loading = false,
  actions,
  emptyMessage = 'No hay datos disponibles'
}: EnhancedDataTableProps<T>) {
  const [quickSearch, setQuickSearch] = useState('')
  
  // Apply quick search filter
  const quickFilteredData = useMemo(() => {
    if (!quickSearch) return data
    
    return data.filter(item => {
      return Object.values(item as any).some(value => 
        String(value).toLowerCase().includes(quickSearch.toLowerCase())
      )
    })
  }, [data, quickSearch])

  // Apply advanced filters
  const {
    filters,
    filteredData,
    updateFilter,
    clearFilters,
    hasActiveFilters
  } = useTableFilters(quickFilteredData, filterFn)

  // Apply pagination
  const {
    data: paginatedData,
    pagination,
    hasNextPage,
    hasPreviousPage,
    totalPages,
    setPage,
    setPageSize,
    nextPage,
    previousPage
  } = usePagination(filteredData, 20)

  // Keyboard shortcuts
  const shortcuts = [
    {
      ...contabilidadShortcuts.quickSearch,
      action: () => {
        const searchInput = document.querySelector('input[placeholder*="Búsqueda rápida"]') as HTMLInputElement
        searchInput?.focus()
      }
    },
    {
      ...contabilidadShortcuts.clearFilters,
      action: () => {
        setQuickSearch('')
        clearFilters()
      }
    },
    {
      ...contabilidadShortcuts.exportData,
      action: () => onExport?.()
    },
    {
      ...contabilidadShortcuts.nextPage,
      action: nextPage
    },
    {
      ...contabilidadShortcuts.previousPage,
      action: previousPage
    },
    {
      ...contabilidadShortcuts.firstPage,
      action: () => setPage(1)
    },
    {
      ...contabilidadShortcuts.lastPage,
      action: () => setPage(totalPages)
    }
  ]

  useKeyboardShortcuts(shortcuts)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <KeyboardShortcutsHelp shortcuts={shortcuts} />
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            )}
            {onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            )}
            {actions}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Búsqueda rápida..."
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {(quickSearch || hasActiveFilters) && (
            <Badge variant="secondary">
              {filteredData.length} de {data.length} resultados
            </Badge>
          )}
        </div>

        {/* Advanced Filters */}
        <TableFilters
          filters={filters}
          options={filterOptions}
          onFilterChange={updateFilter}
          onClearFilters={() => {
            setQuickSearch('')
            clearFilters()
          }}
          hasActiveFilters={hasActiveFilters || !!quickSearch}
        />

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column, index) => (
                  <TableHead key={index}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Cargando...
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, index) => (
                  <TableRow key={index}>
                    {columns.map((column, colIndex) => (
                      <TableCell key={colIndex}>
                        {column.cell(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filteredData.length > 0 && (
          <PaginationControls
            currentPage={pagination.page}
            totalPages={totalPages}
            pageSize={pagination.pageSize}
            total={filteredData.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
          />
        )}
      </CardContent>
    </Card>
  )
}