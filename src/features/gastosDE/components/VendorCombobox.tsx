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

const LISTBOX_ID = 'vendor-combobox-listbox'

/**
 * @description Combobox accesible para seleccionar un proveedor.
 * Expone listbox ARIA con navegación por teclado (flechitas, Enter, Escape)
 * y resaltado de la opción activa mediante aria-activedescendant.
 *
 * @param {VendorComboboxProps} props - Props del componente
 * @returns {JSX.Element} Combobox de proveedores
 */
export function VendorCombobox({ value, onChange, vendors, placeholder = "Seleccionar proveedor", error }: VendorComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const searchRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(
    () => vendors.filter((v) => v.nombre.toLowerCase().includes(search.toLowerCase())),
    [vendors, search]
  )

  // Reset del índice activo al cambiar la lista o abrir el popover
  React.useEffect(() => {
    if (open && filtered.length > 0 && activeIndex === -1) setActiveIndex(0)
    if (open && filtered.length === 0) setActiveIndex(-1)
  }, [open, filtered.length, activeIndex])

  React.useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  // value es el vendorId (FK); el nombre visible se resuelve desde la lista.
  const selectVendor = (vendor: { vendorId: string; nombre: string }) => {
    onChange(vendor.vendorId)
    setSearch("")
    setOpen(false)
    setActiveIndex(-1)
  }

  const selectedVendor = vendors.find((v) => v.vendorId === value)

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length === 0) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((i) => (i + 1) % filtered.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(filtered.length - 1)
        break
      case 'Enter':
        event.preventDefault()
        if (activeIndex >= 0 && filtered[activeIndex]) selectVendor(filtered[activeIndex])
        break
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        break
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={LISTBOX_ID}
          aria-haspopup="listbox"
          aria-label={placeholder}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", error && "border-destructive")}
        >
          {selectedVendor?.nombre || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent id={LISTBOX_ID} className="w-(--radix-popover-trigger-width) p-0" align="start">
        <div className="flex items-center border-b px-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={searchRef}
            placeholder="Buscar proveedor..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveIndex(-1) }}
            onKeyDown={handleSearchKeyDown}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${LISTBOX_ID}-options`}
            aria-activedescendant={activeIndex >= 0 ? `${LISTBOX_ID}-option-${activeIndex}` : undefined}
            aria-label="Buscar proveedor"
            className="h-9 border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div
          id={`${LISTBOX_ID}-options`}
          role="listbox"
          aria-label="Proveedores disponibles"
          className="max-h-50 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No se encontraron proveedores</div>
          ) : (
            filtered.map((vendor, index) => {
              const isSelected = value === vendor.vendorId
              const isActive = index === activeIndex
              return (
                <div
                  key={vendor.vendorId}
                  id={`${LISTBOX_ID}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex cursor-pointer items-center justify-between px-4 py-2 text-sm outline-none",
                    isActive && "bg-accent text-accent-foreground",
                    isSelected && !isActive && "bg-accent/60 text-accent-foreground"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectVendor(vendor)}
                >
                  <span>{vendor.nombre}</span>
                  {isSelected && <Check className="mr-2 h-4 w-4" />}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
