"use client"

import { useState, useEffect, useRef } from "react"
import { LazyMotion, m as motion } from "framer-motion"
import { CalendarIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { format, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { getNextSerieNumberAction } from "@/features/configuracion/actions"

interface FacturaParams {
  tipoTarjeta: string
  fechaVencimiento?: Date
  seriePrefijo: string
  cuentaBancariaId: string
  fechaVencimientoOption: string
}

interface ReparacionInvoiceDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  facturaParams: FacturaParams
  setFacturaParams: (params: FacturaParams) => void
  exchangeRate: number | null
  setExchangeRate: (v: number | null) => void
  selectedCuentaMoneda: string
  setSelectedCuentaMoneda: (v: string) => void
  cuentasBancarias: any[]
  nextSerie: any
  isFacturing: boolean
  confirmFacturar: () => void
  customTasa: React.MutableRefObject<number>
}

export function ReparacionInvoiceDialog({
  open,
  onOpenChange,
  facturaParams,
  setFacturaParams,
  exchangeRate,
  setExchangeRate,
  selectedCuentaMoneda,
  setSelectedCuentaMoneda,
  cuentasBancarias,
  nextSerie,
  isFacturing,
  confirmFacturar,
  customTasa,
}: ReparacionInvoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generar Factura de Servicio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Serie */}
          <div className="space-y-2">
            <Label>Serie de Facturación</Label>
            <div className="flex gap-2">
              <Input
                value={facturaParams.seriePrefijo}
                onChange={(e) => setFacturaParams({ ...facturaParams, seriePrefijo: e.target.value })}
                className="w-24"
                placeholder="Prefijo"
              />
              <div className="flex items-center px-3 border rounded-md bg-muted text-muted-foreground flex-1">
                Próximo: {nextSerie?.preview || "Calculando..."}
              </div>
            </div>
          </div>

          {/* Moneda / Cuenta Bancaria */}
          <div className="space-y-2">
            <Label>Moneda / Cuenta Bancaria</Label>
            <Select
              value={facturaParams.cuentaBancariaId}
              onValueChange={(val) => {
                const cuenta = cuentasBancarias.find((c: any) => c.cuentaId === val)
                const moneda = cuenta?.moneda || "USD"
                setSelectedCuentaMoneda(moneda)
                setFacturaParams({ ...facturaParams, cuentaBancariaId: val })

                // Si es CUP, cargar tasa de cambio automáticamente
                if (moneda === "CUP" && !exchangeRate) {
                  const loadExchangeRate = async () => {
                    try {
                      const token = ''
                      const res = await fetch('/api/exchange?from=USD&to=CUP', {
                        headers: { Authorization: `Bearer ${token}` },
                      })
                      if (res.ok) {
                        const data = await res.json()
                        const rate = Number(data?.rate) || 1
                        setExchangeRate(rate)
                        customTasa.current = rate
                      }
                    } catch {
                      // Si falla, usar 1 como default
                      customTasa.current = 1
                    }
                  }
                  loadExchangeRate()
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione cuenta..." />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(cuentasBancarias) && cuentasBancarias.length > 0 ? cuentasBancarias.map((cuenta: any) => (
                  <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                    {cuenta.moneda} - {cuenta.nombreBanco} ({cuenta.numeroCuenta})
                  </SelectItem>
                )) : null}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha de Vencimiento Options */}
          <div className="space-y-3">
            <Label>Términos de Pago</Label>
            <RadioGroup
              value={facturaParams.fechaVencimientoOption}
              onValueChange={(val) => setFacturaParams({ ...facturaParams, fechaVencimientoOption: val })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="CONCRETA" id="r1" />
                <Label htmlFor="r1">Fecha Concreta (Cuentas por Cobrar)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PLAZO_30" id="r2" />
                <Label htmlFor="r2">Plazo 30 días (Cuentas por Cobrar)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="CONTRA_ENTREGA" id="r3" />
                <Label htmlFor="r3">Contra Entrega (Reconciliación de Ventas)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Date Picker if not Contra Entrega */}
          {facturaParams.fechaVencimientoOption === "CONCRETA" && (
            <div className="space-y-2 pl-6">
              <Label>Fecha de Vencimiento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !facturaParams.fechaVencimiento && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {facturaParams.fechaVencimiento ? format(facturaParams.fechaVencimiento, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={facturaParams.fechaVencimiento}
                    onSelect={(date) => date && setFacturaParams({ ...facturaParams, fechaVencimiento: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          {facturaParams.fechaVencimientoOption === "PLAZO_30" && (
            <div className="pl-6 text-sm text-muted-foreground">
              Vence: {format(addDays(new Date(), 30), "PPP", { locale: es })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={confirmFacturar}
              disabled={isFacturing}
              className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg disabled:opacity-50"
            >
              {isFacturing ? "Generando..." : "Generar Factura"}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
