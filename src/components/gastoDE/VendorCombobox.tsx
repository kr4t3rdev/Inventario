"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface VendorComboboxProps {
  value: string
  onChange: (value: string) => void
  vendors: Array<{ vendorId: string; nombre: string }>
  placeholder?: string
  error?: boolean
}

/**
 * @description Combobox searchable para selección de proveedores con filtro en tiempo real
 * @param {VendorComboboxProps} props - Props del componente
 * @returns Combobox con búsqueda
 */
export function VendorCombobox({ value, onChange, vendors, placeholder = "Seleccionar proveedor", error }: VendorComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(
    () => vendors.filter((v) => v.nombre.toLowerCase().includes(search.toLowerCase())),
    [vendors, search]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            error && "border-destructive"
          )}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <div className="flex items-center border-b px-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Buscar proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 border-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
        </div>
        <div className="max-h-50 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No se encontraron proveedores
            </div>
          ) : (
            filtered.map((vendor) => (
              <div
                key={vendor.vendorId}
                className={cn(
                  "flex cursor-pointer items-center justify-between px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                  value === vendor.nombre && "bg-accent text-accent-foreground"
                )}
                onClick={() => {
                  onChange(vendor.nombre)
                  setSearch("")
                  setOpen(false)
                }}
              >
                <span>{vendor.nombre}</span>
                {value === vendor.nombre && <Check className="mr-2 h-4 w-4" />}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
