"use client"

import { useState, useMemo, useCallback } from "react"
import { useGetAnticiposDisponiblesQuery } from "@/features/contabilidad/api/contabilidadApi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, Wallet, AlertCircle } from "lucide-react"

/**
 * @description Allocation individual de un anticipo.
 * @property {string} anticipoId - ID del anticipo seleccionado.
 * @property {number} montoAplicado - Monto aplicado del anticipo al documento.
 */
export interface AnticipoAllocation {
  anticipoId: string
  montoAplicado: number
}

/**
 * @description Props para el componente AnticipoSelector.
 * @property {'PAGO' | 'COBRO'} tipo - Tipo de anticipo: PAGO para proveedores, COBRO para clientes.
 * @property {string} [entidadId] - ID del proveedor o cliente para filtrar anticipos.
 * @property {number} montoTotal - Monto total del documento a cubrir.
 * @property {(allocations: AnticipoAllocation[]) => void} onSelectionChange - Callback cuando cambian las allocations.
 * @property {string} [moneda='CUP'] - Moneda para filtrar anticipos disponibles.
 * @property {boolean} [disabled=false] - Si el selector está deshabilitado.
 */
interface AnticipoSelectorProps {
  tipo: "PAGO" | "COBRO"
  entidadId?: string
  montoTotal: number
  onSelectionChange: (allocations: AnticipoAllocation[]) => void
  moneda?: string
  disabled?: boolean
}

const MONEDA_SIMBOLOS: Record<string, string> = {
  CUP: "CUP",
  USD: "$",
  EUR: "€",
}

/**
 * @description Componente reutilizable para seleccionar anticipos y distribuir montos.
 * Muestra anticipos disponibles filtrados por proveedor/cliente y permite
 * asignar montos parciales a cada uno.
 * @param {AnticipoSelectorProps} props - Props del componente.
 * @returns {JSX.Element} Selector de anticipos con tabla de allocations.
 */
export function AnticipoSelector({
  tipo,
  entidadId,
  montoTotal,
  onSelectionChange,
  moneda = "CUP",
  disabled = false,
}: AnticipoSelectorProps) {
  const contexto = tipo === "PAGO" ? "compra" as const : "factura" as const

  const queryParams = useMemo(
    () => ({
      contexto,
      proveedorId: tipo === "PAGO" ? entidadId : undefined,
      clienteId: tipo === "COBRO" ? entidadId : undefined,
      moneda,
    }),
    [contexto, tipo, entidadId, moneda]
  )

  const skipQuery = !entidadId

  const { data: anticiposData, isFetching: isLoadingAnticipos } =
    useGetAnticiposDisponiblesQuery(queryParams, { skip: skipQuery })

  const anticipos = anticiposData?.anticipos || []

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [montos, setMontos] = useState<Record<string, number>>({})

  const toggleAnticipo = useCallback(
    (anticipoId: string) => {
      if (disabled) return

      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(anticipoId)) {
          next.delete(anticipoId)
          setMontos((prev) => {
            const nextMontos = { ...prev }
            delete nextMontos[anticipoId]
            return nextMontos
          })
        } else {
          next.add(anticipoId)
          const anticipo = anticipos.find((a) => a.anticipoId === anticipoId)
          if (anticipo) {
            setMontos((prev) => ({
              ...prev,
              [anticipoId]: Number(anticipo.saldoDisponible),
            }))
          }
        }
        return next
      })
    },
    [disabled, anticipos]
  )

  const handleMontoChange = useCallback(
    (anticipoId: string, value: string) => {
      if (disabled) return

      const numericValue = parseFloat(value) || 0
      const anticipo = anticipos.find((a) => a.anticipoId === anticipoId)
      if (!anticipo) return

      const maxMonto = Number(anticipo.saldoDisponible)
      const clampedValue = Math.min(Math.max(0, numericValue), maxMonto)

      setMontos((prev) => ({
        ...prev,
        [anticipoId]: clampedValue,
      }))
    },
    [disabled, anticipos]
  )

  const allocations = useMemo<AnticipoAllocation[]>(() => {
    return Array.from(selectedIds)
      .map((anticipoId) => ({
        anticipoId,
        montoAplicado: montos[anticipoId] || 0,
      }))
      .filter((a) => a.montoAplicado > 0)
  }, [selectedIds, montos])

  const totalAplicado = useMemo(
    () => allocations.reduce((sum, a) => sum + a.montoAplicado, 0),
    [allocations]
  )

  const saldoPendiente = montoTotal - totalAplicado
  const excedido = totalAplicado > montoTotal + 0.01

  // Notificar al padre cuando cambien las allocations
  useMemo(() => {
    onSelectionChange(allocations)
  }, [allocations, onSelectionChange])

  const formatCurrency = (amount: number, currency: string = "CUP") => {
    const symbol = MONEDA_SIMBOLOS[currency] || currency
    return `${symbol} ${amount.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  if (skipQuery) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        <Wallet className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>
          Seleccione {tipo === "PAGO" ? "un proveedor" : "un cliente"} para
          ver anticipos disponibles
        </p>
      </div>
    )
  }

  if (isLoadingAnticipos) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (anticipos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        <Wallet className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>
          No hay anticipos de {tipo === "PAGO" ? "pago" : "cobro"} disponibles
          {entidadId ? " para esta entidad" : ""}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          Anticipos disponibles ({tipo === "PAGO" ? "Pago" : "Cobro"})
        </h4>
        <Badge variant={excedido ? "destructive" : "secondary"}>
          {excedido ? "Excedido" : saldoPendiente <= 0.01 ? "Cubierto" : "Parcial"}
        </Badge>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">Sel.</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Moneda</TableHead>
              <TableHead>Saldo Disponible</TableHead>
              <TableHead>Monto a Aplicar</TableHead>
              <TableHead className="w-12">Quitar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anticipos.map((anticipo) => {
              const isSelected = selectedIds.has(anticipo.anticipoId)
              const saldo = Number(anticipo.saldoDisponible)
              const montoAplicado = montos[anticipo.anticipoId] || 0
              const exceedsSaldo = montoAplicado > saldo + 0.01

              return (
                <TableRow
                  key={anticipo.anticipoId}
                  className={isSelected ? "bg-primary/5" : ""}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAnticipo(anticipo.anticipoId)}
                      disabled={disabled}
                      className="h-4 w-4 rounded border-muted-foreground/40"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {anticipo.anticipoId.slice(-8)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {anticipo.moneda}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(saldo, anticipo.moneda)}
                  </TableCell>
                  <TableCell>
                    {isSelected ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={saldo}
                          step={0.01}
                          value={montoAplicado || ""}
                          onChange={(e) =>
                            handleMontoChange(anticipo.anticipoId, e.target.value)
                          }
                          disabled={disabled}
                          className={`h-8 w-28 text-sm ${
                            exceedsSaldo ? "border-destructive" : ""
                          }`}
                          placeholder="0.00"
                        />
                        {exceedsSaldo && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isSelected && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleAnticipo(anticipo.anticipoId)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Resumen */}
      <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total del documento</span>
          <span className="font-medium">{formatCurrency(montoTotal, moneda)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total aplicado</span>
          <span className={`font-medium ${excedido ? "text-destructive" : "text-green-600"}`}>
            {formatCurrency(totalAplicado, moneda)}
          </span>
        </div>
        <div className="flex justify-between border-t pt-1">
          <span className="text-muted-foreground font-medium">Saldo pendiente</span>
          <span
            className={`font-bold ${
              saldoPendiente <= 0.01
                ? "text-green-600"
                : excedido
                ? "text-destructive"
                : "text-amber-600"
            }`}
          >
            {formatCurrency(Math.abs(saldoPendiente), moneda)}
            {excedido ? " (excedido)" : saldoPendiente <= 0.01 ? "" : " pendiente"}
          </span>
        </div>
      </div>

      {excedido && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          El monto aplicado excede el total del documento
        </p>
      )}
    </div>
  )
}