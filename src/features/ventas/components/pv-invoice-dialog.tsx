"use client"

import { LazyMotion, m as motion, AnimatePresence } from "framer-motion"
import { CreditCard, Calendar, Truck, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// Diálogo para seleccionar cliente
export function VentaInvoiceDialog({
  open,
  onOpenChange,
  clientes,
  selectedClienteId,
  setSelectedClienteId,
  series,
  selectedSerieId,
  setSelectedSerieId,
  cargoTransporte,
  setCargoTransporte,
  tipoVencimiento,
  setTipoVencimiento,
  fechaVencimiento,
  setFechaVencimiento,
  anticiposFeatureEnabled,
  anticiposCobro,
  selectedAnticipoCobroId,
  setSelectedAnticipoCobroId,
  isLoadingAnticiposCobro,
  onConfirm,
  isProcessing,
  isLoadingClientes,
 }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientes: any[] | undefined
  selectedClienteId: string
  setSelectedClienteId: (v: string) => void
  series: any[]
  selectedSerieId: string
  setSelectedSerieId: (v: string) => void
  cargoTransporte: number
  setCargoTransporte: (v: number) => void
  tipoVencimiento: "fecha" | "plazo" | "contra_pago"
  setTipoVencimiento: (v: "fecha" | "plazo" | "contra_pago") => void
  fechaVencimiento: string
  setFechaVencimiento: (v: string) => void
  anticiposFeatureEnabled: boolean
  anticiposCobro: any[]
  selectedAnticipoCobroId: string
  setSelectedAnticipoCobroId: (v: string) => void
  isLoadingAnticiposCobro: boolean
  onConfirm: () => void
  isProcessing: boolean
  isLoadingClientes: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-dashed">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <motion.div
                className="w-8 h-8 bg-linear-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center"
                whileHover={{ scale: 1.05 }}
              >
                <CreditCard className="h-4 w-4 text-white" />
              </motion.div>
              Datos para Facturación
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full" />
                Cliente
              </label>
              {isLoadingClientes ? (
                <div className="flex items-center gap-2 p-2 border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Cargando clientes...</span>
                </div>
              ) : (
                <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                    <SelectValue placeholder="Elige un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes?.map((c: any) => (
                      <SelectItem key={c.clienteId} value={c.clienteId}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </motion.div>

            {anticiposFeatureEnabled && (
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <label className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Cobro anticipado
              </label>
              <Select
                value={selectedAnticipoCobroId || "__none__"}
                onValueChange={(value) => {
                  const nextValue = value === "__none__" ? "" : value
                  setSelectedAnticipoCobroId(nextValue)
                  if (nextValue) {
                    setTipoVencimiento("contra_pago")
                  }
                }}
              >
                <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                  <SelectValue placeholder="Sin anticipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin anticipo</SelectItem>
                  {anticiposCobro.map((anticipo: any) => (
                    <SelectItem key={anticipo.anticipoId} value={anticipo.anticipoId}>
                      {`${anticipo.anticipoId.slice(0, 8)} · Saldo ${Number(anticipo.saldoDisponible).toFixed(2)} ${anticipo.moneda}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isLoadingAnticiposCobro
                  ? "Cargando cobros anticipados disponibles..."
                  : "Opcional: aplica y ejecuta un cobro anticipado al facturar"}
              </p>
            </motion.div>
            )}

            <motion.div
              className="space-y-3 border p-3 rounded-md dark:border-gray-700"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Vencimiento de la Factura
              </Label>
              <RadioGroup
                value={tipoVencimiento}
                onValueChange={(val) => setTipoVencimiento(val as any)}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fecha" id="v-fecha" />
                  <Label htmlFor="v-fecha" className="font-normal cursor-pointer">Fecha concreta</Label>
                </div>

                <AnimatePresence>
                  {tipoVencimiento === 'fecha' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="ml-6 mt-1 mb-2"
                    >
                      <Input
                        type="date"
                        value={fechaVencimiento}
                        onChange={(e) => setFechaVencimiento(e.target.value)}
                        className="w-full transition-all duration-200 focus:scale-[1.01]"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Se agregará a Cuentas por Cobrar</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="plazo" id="v-plazo" />
                  <Label htmlFor="v-plazo" className="font-normal cursor-pointer">Plazo de 30 días</Label>
                </div>
                <AnimatePresence>
                  {tipoVencimiento === 'plazo' && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-muted-foreground ml-6"
                    >
                      Se agregará a Cuentas por Cobrar con vencimiento a 30 días
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="contra_pago" id="v-contra" />
                  <Label htmlFor="v-contra" className="font-normal cursor-pointer">Contra pago (Pago directo)</Label>
                </div>
                <AnimatePresence>
                  {tipoVencimiento === 'contra_pago' && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-muted-foreground ml-6"
                    >
                      Se registra conciliación completa y cierre total de la factura
                    </motion.p>
                  )}
                </AnimatePresence>
              </RadioGroup>
            </motion.div>

            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <span className="text-sm font-medium">Serie de Facturación</span>
              {series.length === 0 ? (
                <div className="flex items-center gap-2 p-2 border rounded-md dark:border-gray-700 bg-muted/50">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Cargando series de facturación...</span>
                </div>
              ) : (
                <Select value={selectedSerieId} onValueChange={setSelectedSerieId}>
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                    <SelectValue placeholder="Selecciona una serie" />
                  </SelectTrigger>
                  <SelectContent>
                    {series.filter((s: any) => s.activa).map((serie: any) => (
                      <SelectItem key={serie.serieId} value={serie.serieId}>
                        {serie.prefijo} - {serie.descripcion} {serie.esPorDefecto ? "(Por defecto)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </motion.div>

            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <span className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Cargo por Transporte (MN)
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={cargoTransporte}
                onChange={(e) => setCargoTransporte(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="transition-all duration-200 focus:scale-[1.01]"
              />
            </motion.div>
          </div>

          <DialogFooter className="mt-6">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                Cancelar
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={onConfirm}
                disabled={!selectedClienteId || isProcessing}
                className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Confirmar y facturar"
                )}
              </Button>
            </motion.div>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
