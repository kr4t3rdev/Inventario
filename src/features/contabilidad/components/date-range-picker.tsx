"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "lucide-react"
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns"

interface DateRangePickerProps {
  fechaInicio?: string
  fechaFin?: string
  onChange: (fechaInicio: string, fechaFin: string) => void
}

export function DateRangePicker({ fechaInicio, fechaFin, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempFechaInicio, setTempFechaInicio] = useState(fechaInicio || "")
  const [tempFechaFin, setTempFechaFin] = useState(fechaFin || "")

  const presets = [
    {
      label: "Hoy",
      value: "today",
      getRange: () => {
        const today = new Date()
        return {
          inicio: format(today, "yyyy-MM-dd"),
          fin: format(today, "yyyy-MM-dd")
        }
      }
    },
    {
      label: "Últimos 7 días",
      value: "last7days",
      getRange: () => {
        const today = new Date()
        const start = subDays(today, 6)
        return {
          inicio: format(start, "yyyy-MM-dd"),
          fin: format(today, "yyyy-MM-dd")
        }
      }
    },
    {
      label: "Últimos 30 días",
      value: "last30days",
      getRange: () => {
        const today = new Date()
        const start = subDays(today, 29)
        return {
          inicio: format(start, "yyyy-MM-dd"),
          fin: format(today, "yyyy-MM-dd")
        }
      }
    },
    {
      label: "Este mes",
      value: "thisMonth",
      getRange: () => {
        const today = new Date()
        return {
          inicio: format(startOfMonth(today), "yyyy-MM-dd"),
          fin: format(endOfMonth(today), "yyyy-MM-dd")
        }
      }
    },
    {
      label: "Mes anterior",
      value: "lastMonth",
      getRange: () => {
        const lastMonth = subMonths(new Date(), 1)
        return {
          inicio: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
          fin: format(endOfMonth(lastMonth), "yyyy-MM-dd")
        }
      }
    },
    {
      label: "Este año",
      value: "thisYear",
      getRange: () => {
        const today = new Date()
        return {
          inicio: format(startOfYear(today), "yyyy-MM-dd"),
          fin: format(endOfYear(today), "yyyy-MM-dd")
        }
      }
    }
  ]

  const handlePresetSelect = (presetValue: string) => {
    const preset = presets.find(p => p.value === presetValue)
    if (preset) {
      const range = preset.getRange()
      setTempFechaInicio(range.inicio)
      setTempFechaFin(range.fin)
      onChange(range.inicio, range.fin)
      setIsOpen(false)
    }
  }

  const handleApply = () => {
    if (tempFechaInicio && tempFechaFin) {
      onChange(tempFechaInicio, tempFechaFin)
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    setTempFechaInicio("")
    setTempFechaFin("")
    onChange("", "")
    setIsOpen(false)
  }

  const getDisplayText = () => {
    if (!fechaInicio || !fechaFin) {
      return "Seleccionar período"
    }

    try {
      const inicio = new Date(fechaInicio)
      const fin = new Date(fechaFin)
      
      if (fechaInicio === fechaFin) {
        return format(inicio, "dd MMM yyyy")
      }
      
      return `${format(inicio, "dd MMM")} - ${format(fin, "dd MMM yyyy")}`
    } catch {
      return "Seleccionar período"
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start text-left font-normal">
          <Calendar className="mr-2 h-4 w-4" />
          {getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Períodos predefinidos</Label>
            <Select onValueChange={handlePresetSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Período personalizado</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="fecha-inicio" className="text-xs">Fecha inicio</Label>
                <Input
                  id="fecha-inicio"
                  type="date"
                  value={tempFechaInicio}
                  onChange={(e) => setTempFechaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fecha-fin" className="text-xs">Fecha fin</Label>
                <Input
                  id="fecha-fin"
                  type="date"
                  value={tempFechaFin}
                  onChange={(e) => setTempFechaFin(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleApply} disabled={!tempFechaInicio || !tempFechaFin}>
              Aplicar
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear}>
              Limpiar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}