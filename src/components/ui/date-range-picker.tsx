"use client"
import { useState } from "react"
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, subMonths, subYears } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
// Define DateRange type since react-date-picker does not export it
export type DateRange = {
  from: Date | undefined
  to?: Date | undefined
}

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (date: DateRange | undefined) => void
  className?: string
}

const PRESET_RANGES = [
  {
    label: "Últimos 7 días",
    value: "last7days",
    getValue: () => ({
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      to: new Date()
    })
  },
  {
    label: "Últimos 30 días",
    value: "last30days",
    getValue: () => ({
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: new Date()
    })
  },
  {
    label: "Este mes",
    value: "thisMonth",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date())
    })
  },
  {
    label: "Mes anterior",
    value: "lastMonth",
    getValue: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1))
    })
  },
  {
    label: "Últimos 3 meses",
    value: "last3months",
    getValue: () => ({
      from: subMonths(new Date(), 3),
      to: new Date()
    })
  },
  {
    label: "Este año",
    value: "thisYear",
    getValue: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date())
    })
  },
  {
    label: "Año anterior",
    value: "lastYear",
    getValue: () => ({
      from: startOfYear(subYears(new Date(), 1)),
      to: endOfYear(subYears(new Date(), 1))
    })
  }
]

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [isOpen, setIsOpen] = useState(false)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i)

  const handlePresetSelect = (preset: typeof PRESET_RANGES[0]) => {
    const range = preset.getValue()
    onChange(range)
    setIsOpen(false)
  }

  const handleYearChange = (year: string) => {
    const yearNum = parseInt(year)
    setSelectedYear(yearNum)
    const yearStart = startOfYear(new Date(yearNum, 0, 1))
    const yearEnd = endOfYear(new Date(yearNum, 0, 1))
    onChange({ from: yearStart, to: yearEnd })
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn("w-[300px] justify-start text-left font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "dd/MM/yyyy")} - {format(value.to, "dd/MM/yyyy")}
                </>
              ) : (
                format(value.from, "dd/MM/yyyy")
              )
            ) : (
              <span>Selecciona un rango de fechas</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4 space-y-4">
            {/* Selector de año */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Año:</span>
              <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Rangos predefinidos */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Rangos rápidos</h4>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_RANGES.map((preset) => (
                  <Button
                    key={preset.value}
                    variant="ghost"
                    size="sm"
                    className="justify-start text-xs h-8"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Calendario */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Seleccionar fechas</h4>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={value?.from || new Date(selectedYear, 0, 1)}
                selected={value}
                onSelect={(date) => onChange(date)}
                numberOfMonths={2}
                required={false}
                locale={es}
              />
            </div>

            {/* Botones de acción */}
            <div className="flex justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange(undefined)}
              >
                Limpiar
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={!value?.from}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
