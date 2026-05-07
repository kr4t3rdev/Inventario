"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useGetInyeccionesCapitalQuery } from "@/features/contabilidad/api/contabilidadApi"
import { InyeccionCapital } from "@/app/models/model"
import { PagoDeudaDialog } from "./pago-deuda-dialog"
import { Loader2, TrendingUp, TrendingDown, DollarSign, CreditCard } from "lucide-react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function CapitalTable() {
  const { data, isLoading } = useGetInyeccionesCapitalQuery({})
  const [selectedInjection, setSelectedInjection] = useState<InyeccionCapital | null>(null)
  const [isPayOpen, setIsPayOpen] = useState(false)

  const inyecciones = data?.inyecciones || []

  const handlePayClick = (injection: InyeccionCapital) => {
    setSelectedInjection(injection)
    setIsPayOpen(true)
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 w-full bg-slate-100 dark:bg-slate-800/10 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 shadow-sm">
      <CardHeader>
        <CardTitle>Historial de Transacciones</CardTitle>
        <CardDescription>
          Registro detallado de inyecciones de capital y préstamos externos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-900/20 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Entidad / Socio</TableHead>
                <TableHead>Monto Recibido</TableHead>
                <TableHead>Cuenta Destino</TableHead>
                <TableHead>Estado Deuda</TableHead>
                <TableHead>Saldo Pendiente</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <motion.tbody
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="[&_tr:last-child]:border-0"
            >
              {inyecciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-32 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full">
                        <TrendingUp className="h-6 w-6 text-slate-400" />
                      </div>
                      <p>No hay inyecciones de capital registradas.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                inyecciones.map((item) => (
                  <motion.tr
                    key={item.id}
                    variants={itemVariants}
                    className="border-b transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/50 data-[state=selected]:bg-slate-100 dark:data-[state=selected]:bg-slate-800"
                  >
                    <TableCell className="font-medium">{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          item.tipo === "CAPITAL_SOCIAL"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                            : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                        }
                      >
                        {item.tipo === "CAPITAL_SOCIAL" ? "Capital Social" : "Deuda Externa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.tipo === "CAPITAL_SOCIAL" ? (
                          <span className="font-medium">{item.socio}</span>
                        ) : (
                          <span className="font-medium">{item.entidadPrestamista}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {item.montoRecibido.toLocaleString()} {item.moneda}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CreditCard className="h-3 w-3" />
                        {item.cuentaBancaria?.nombreBanco}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.tipo === "DEUDA_EXTERNA" ? (
                        <Badge variant={
                          item.estado === "PAGADA" ? "outline" :
                          item.estado === "EN_MORA" ? "destructive" : "default"
                        }>
                          {item.estado}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.tipo === "DEUDA_EXTERNA" ? (
                        <span className={Number(item.saldoPendiente) > 0 ? "text-red-500 font-medium" : "text-emerald-600 font-medium"}>
                            {Number(item.saldoPendiente).toLocaleString()} {item.moneda}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.tipo === "DEUDA_EXTERNA" && item.estado !== "PAGADA" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePayClick(item)}
                                className="h-8 px-2 lg:px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                <span className="hidden lg:inline">Abonar</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Registrar pago a deuda</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </motion.tbody>
          </Table>
        </div>
      </CardContent>

      {selectedInjection && (
        <PagoDeudaDialog
          open={isPayOpen}
          onOpenChange={setIsPayOpen}
          inyeccion={selectedInjection}
          onSuccess={() => setSelectedInjection(null)}
        />
      )}
    </Card>
  )
}
