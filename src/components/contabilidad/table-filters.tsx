'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DateRangePicker } from '@/components/contabilidad/date-range-picker'
import { Search, X, Filter } from 'lucide-react'
import { FilterConfig, FilterOptions } from '@/hooks/use-table-filters'

interface TableFiltersProps {
  filters: FilterConfig
  options: FilterOptions
  onFilterChange: <K extends keyof FilterConfig>(key: K, value: FilterConfig[K]) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function TableFilters({
  filters,
  options,
  onFilterChange,
  onClearFilters,
  hasActiveFilters
}: TableFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar transacciones..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Date Range */}
        <DateRangePicker
          fechaInicio={filters.dateRange.from?.toISOString().split('T')[0] || ''}
          fechaFin={filters.dateRange.to?.toISOString().split('T')[0] || ''}
          onChange={(fechaInicio, fechaFin) => {
            onFilterChange('dateRange', {
              from: fechaInicio ? new Date(fechaInicio) : null,
              to: fechaFin ? new Date(fechaFin) : null
            })
          }}
        />

        {/* Currency Filter */}
        <Select
          value={filters.currency}
          onValueChange={(value) => onFilterChange('currency', value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Moneda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las monedas</SelectItem>
            {options.currencies.map((currency) => (
              <SelectItem key={currency.value} value={currency.value}>
                {currency.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Account Filter */}
        <Select
          value={filters.account}
          onValueChange={(value) => onFilterChange('account', value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cuenta bancaria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuentas</SelectItem>
            {options.accounts.map((account) => (
              <SelectItem key={account.value} value={account.value}>
                {account.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Payment Type Filter */}
        <Select
          value={filters.paymentType}
          onValueChange={(value) => onFilterChange('paymentType', value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tipo de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {options.paymentTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status}
          onValueChange={(value) => onFilterChange('status', value)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {options.statuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="h-10"
          >
            <X className="h-4 w-4 mr-2" />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtros activos:</span>

          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Búsqueda: {filters.search}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange('search', '')}
              />
            </Badge>
          )}

          {filters.currency && (
            <Badge variant="secondary" className="gap-1">
              Moneda: {options.currencies.find(c => c.value === filters.currency)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange('currency', '')}
              />
            </Badge>
          )}

          {filters.account && (
            <Badge variant="secondary" className="gap-1">
              Cuenta: {options.accounts.find(a => a.value === filters.account)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange('account', '')}
              />
            </Badge>
          )}

          {filters.paymentType && (
            <Badge variant="secondary" className="gap-1">
              Tipo: {options.paymentTypes.find(t => t.value === filters.paymentType)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange('paymentType', '')}
              />
            </Badge>
          )}

          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Estado: {options.statuses.find(s => s.value === filters.status)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange('status', '')}
              />
            </Badge>
          )}

          {(filters.dateRange.from || filters.dateRange.to) && (
            <Badge variant="secondary" className="gap-1">
              Fecha: {filters.dateRange.from?.toLocaleDateString()} - {filters.dateRange.to?.toLocaleDateString()}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange('dateRange', { from: null, to: null })}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}