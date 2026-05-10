"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
DateRangePicker
  // @ts-expect-error
} from "./date-range-picker"

interface ExportDialogProps {
  tipoReporte: 'movimientos' | 'resumen' | 'transferencias' | 'exchange'
  cuentaId?: string
  onExport: (config: ExportConfig) => Promise<void>
}

interface ExportConfig {
  formato: 'csv' | 'pdf'
  fechaInicio?: string
  fechaFin?: string
  cuentaId?: string
  incluirDetalles: boolean
  incluirConversiones: boolean
  agruparPorMoneda: boolean
}

export function ExportDialog({ tipoReporte, cuentaId, onExport }: ExportDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [config, setConfig] = useState<ExportConfig>({
    formato: 'csv',
    cuentaId,
    incluirDetalles: true,
    incluirConversiones: true,
    agruparPorMoneda: false
  })

  const handleExport = async () => {
    try {
      setIsExporting(true)
      await onExport(config)
      setIsOpen(false)
      toast(`El reporte se ha exportado correctamente en formato ${config.formato.toUpperCase()}`)
    } catch (error) {
      toast("No se pudo exportar el reporte. Intente nuevamente.")
    } finally {
      setIsExporting(false)
    }
  }

  const handleDateRangeChange = (fechaInicio: string, fechaFin: string) => {
    setConfig(prev => ({
      ...prev,
      fechaInicio,
      fechaFin
    }))
  }

  const getTituloReporte = () => {
    const titulos = {
      movimientos: "Movimientos Bancarios",
      resumen: "Resumen Financiero",
      transferencias: "Transferencias Bancarias",
      exchange: "Reporte de Exchange"
    }
    return titulos[tipoReporte]
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar {getTituloReporte()}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Formato */}
          <div className="space-y-2">
            <Label>Formato de exportación</Label>
            <Select
              value={config.formato}
              onValueChange={(value: 'csv' | 'pdf') => 
                setConfig(prev => ({ ...prev, formato: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV (Excel)
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    PDF
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rango de fechas */}
          <div className="space-y-2">
            <Label>Período</Label>
            <DateRangePicker
              fechaInicio={config.fechaInicio}
              fechaFin={config.fechaFin}
              onChange={handleDateRangeChange}
            />
          </div>

          {/* Opciones específicas por tipo de reporte */}
          <div className="space-y-3">
            <Label>Opciones de exportación</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="incluir-detalles"
                checked={config.incluirDetalles}
                onCheckedChange={(checked) =>
                  setConfig(prev => ({ ...prev, incluirDetalles: !!checked }))
                }
              />
              <Label htmlFor="incluir-detalles" className="text-sm">
                Incluir detalles completos
              </Label>
            </div>

            {(tipoReporte === 'movimientos' || tipoReporte === 'resumen') && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="incluir-conversiones"
                  checked={config.incluirConversiones}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, incluirConversiones: !!checked }))
                  }
                />
                <Label htmlFor="incluir-conversiones" className="text-sm">
                  Incluir información de conversiones de moneda
                </Label>
              </div>
            )}

            {tipoReporte === 'resumen' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="agrupar-moneda"
                  checked={config.agruparPorMoneda}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, agruparPorMoneda: !!checked }))
                  }
                />
                <Label htmlFor="agrupar-moneda" className="text-sm">
                  Agrupar por moneda
                </Label>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar {config.formato.toUpperCase()}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isExporting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}