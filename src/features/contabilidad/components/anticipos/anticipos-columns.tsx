"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Eye, PlayCircle, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Anticipo } from "@/app/models/model"
import { cn } from "@/lib/utils"

type AnticipoConRelaciones = Anticipo & {
  cliente?: { clienteId: string; nombre: string } | null
  proveedor?: { vendorId: string; nombre: string } | null
}

/**
 * @description Devuelve el nombre del cliente si viene embebido, o su ID como fallback.
 * @param {AnticipoConRelaciones} anticipo - Anticipo con relación de cliente opcional.
 * @returns {string} Nombre del cliente o identificador.
 */
export function formatAnticipoCliente(anticipo: AnticipoConRelaciones): string {
  return anticipo.cliente?.nombre || anticipo.clienteId || "-"
}

/**
 * @description Devuelve el nombre del proveedor si viene embebido, o su ID como fallback.
 * @param {AnticipoConRelaciones} anticipo - Anticipo con relación de proveedor opcional.
 * @returns {string} Nombre del proveedor o identificador.
 */
export function formatAnticipoProveedor(anticipo: AnticipoConRelaciones): string {
  return anticipo.proveedor?.nombre || anticipo.proveedorId || "-"
}

/**
 * @description Define las columnas para la tabla de anticipos
 * @returns {ColumnDef<Anticipo>[]} Columnas configuradas
 */
export const anticiposColumns: ColumnDef<Anticipo>[] = [
  {
    accessorKey: "tipo",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Tipo
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const tipo = row.getValue("tipo") as string
      return (
        <Badge variant={tipo === "PAGO" ? "default" : "secondary"}>
          {tipo === "PAGO" ? "Pago" : "Cobro"}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "estado",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Estado
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const estado = row.getValue("estado") as string
      const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        RESERVADO: "outline",
        EJECUTADO: "default",
        ANULADO: "destructive",
      }
      return (
        <Badge variant={variants[estado] || "outline"}>
          {estado}
        </Badge>
      )
    },
  },
  {
    accessorKey: "montoOriginal",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Monto Original
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const monto = parseFloat(row.getValue("montoOriginal"))
      const moneda = row.original.moneda
      return (
        <span className="font-medium">
          {moneda} {monto.toLocaleString("es-ES")}
        </span>
      )
    },
  },
  {
    accessorKey: "saldoDisponible",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Saldo Disponible
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const saldo = parseFloat(row.getValue("saldoDisponible"))
      const moneda = row.original.moneda
      const isZero = saldo === 0
      return (
        <span className={cn(
          "font-medium",
          isZero ? "text-muted-foreground" : "text-green-600 dark:text-green-400"
        )}>
          {moneda} {saldo.toLocaleString("es-ES")}
        </span>
      )
    },
  },
  {
    accessorKey: "clienteId",
    header: "Cliente",
    cell: ({ row }) => {
      return formatAnticipoCliente(row.original as AnticipoConRelaciones)
    },
  },
  {
    accessorKey: "proveedorId",
    header: "Proveedor",
    cell: ({ row }) => {
      return formatAnticipoProveedor(row.original as AnticipoConRelaciones)
    },
  },
  {
    accessorKey: "contratoId",
    header: "Contrato ID",
    cell: ({ row }) => {
      return row.original.contratoId || "-"
    },
  },
  {
    accessorKey: "fechaReserva",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Fecha Reserva
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const fecha = row.original.fechaReserva
      return fecha ? new Date(fecha).toLocaleDateString("es-ES") : "-"
    },
  },
  {
    accessorKey: "vigenciaHasta",
    header: "Vigencia",
    cell: ({ row }) => {
      const vigencia = row.original.vigenciaHasta
      if (!vigencia) return <span className="text-muted-foreground">Sin límite</span>
      
      const fechaVigencia = new Date(vigencia)
      const isVencida = fechaVigencia < new Date()
      
      return (
        <span className={cn(isVencida ? "text-red-500" : "")}>
          {fechaVigencia.toLocaleDateString("es-ES")}
        </span>
      )
    },
  },
]
