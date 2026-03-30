"use client"

import React, { useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface AnticiposFiltersProps {
  onFilterChange: (filters: AnticipoFilters) => void
  initialFilters?: AnticipoFilters
}

export interface AnticipoFilters {
  tipo?: "PAGO" | "COBRO"
  estado?: "RESERVADO" | "EJECUTADO" | "ANULADO"
  clienteId?: string
  proveedorId?: string
  moneda?: string
}

/**
 * @description Componente de filtros para la tabla de anticipos
 * @param {AnticiposFiltersProps} props - Props del componente
 * @returns {JSX.Element} Filtros de anticipos
 */
export function AnticiposFilters({ onFilterChange, initialFilters }: AnticiposFiltersProps) {
  const [filters, setFilters] = useState<AnticipoFilters>(initialFilters || {})

  const handleFilterChange = (key: keyof AnticipoFilters, value: string) => {
    const newFilters = {
      ...filters,
      [key]: value === "all" ? undefined : value,
    }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleClearFilters = () => {
    setFilters({})
    onFilterChange({})
  }

  const hasFilters = Object.values(filters).some((v) => v !== undefined)

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select
          value={filters.tipo || "all"}
          onValueChange={(value) => handleFilterChange("tipo", value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PAGO">Pago</SelectItem>
            <SelectItem value="COBRO">Cobro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Estado</Label>
        <Select
          value={filters.estado || "all"}
          onValueChange={(value) => handleFilterChange("estado", value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="RESERVADO">Reservado</SelectItem>
            <SelectItem value="EJECUTADO">Ejecutado</SelectItem>
            <SelectItem value="ANULADO">Anulado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Moneda</Label>
        <Select
          value={filters.moneda || "all"}
          onValueChange={(value) => handleFilterChange("moneda", value)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="CUP">CUP</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="MLC">MLC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClearFilters}>
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
