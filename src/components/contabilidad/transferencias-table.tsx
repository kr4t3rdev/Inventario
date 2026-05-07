"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { motion, AnimatePresence } from "framer-motion"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  ArrowRightLeft, 
  Download, 
  Eye, 
  MoreHorizontal, 
  Search,
  Filter,
  Calendar,
  RefreshCw,
  FileText,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { useAppSelector, useAppDispatch } from "@/lib/redux/hooks"
import { contabilidadApi } from "@/features/contabilidad/api/contabilidadApi"
import { ComprobanteTransferencia } from "./comprobante-transferencia"
import { cn } from "@/lib/utils"
import { AnimatedNumber } from "@/components/ui/animated-number"
import type { ComprobanteTransferenciaData } from "./comprobante-transferencia"

interface TransferenciasTableProps {
  transferencias: any[]
  isLoading?: boolean
  onRefresh?: () => void
}

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

const inputClass = cn(
  'bg-white/50 text-slate-900 placeholder:text-slate-400 transition-all duration-300',
  'border-slate-200/60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40',
  'dark:bg-slate-900/10 dark:text-slate-100 dark:border-slate-800/60 dark:focus:bg-slate-950',
);

export function TransferenciasTable({ 
  transferencias, 
  isLoading = false,
  onRefresh 
}: TransferenciasTableProps) {
  const dispatch = useAppDispatch()
  const { cuentasBancarias } = useAppSelector((state) => state.contabilidad)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCuenta, setFilterCuenta] = useState<string>("all")
  const [selectedTransferencia, setSelectedTransferencia] = useState<ComprobanteTransferenciaData | null>(null)
  const [showComprobante, setShowComprobante] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  
  // Sorting & Pagination
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'fechaTransferencia', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ` ${currency}`
  }

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredTransferencias = useMemo(() => {
    const result = transferencias.filter(transferencia => {
      const matchesSearch = 
        transferencia?.numeroComprobante?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transferencia?.motivo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transferencia?.cuentaOrigen?.nombreBanco?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transferencia?.cuentaDestino?.nombreBanco?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesFilter = filterCuenta === "all" || 
        transferencia?.cuentaOrigenId === filterCuenta ||
        transferencia?.cuentaDestinoId === filterCuenta

      return matchesSearch && matchesFilter
    });

    if (sortConfig) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle nested properties if needed, or specific keys
        if (sortConfig.key === 'cuentaOrigen') aValue = a.cuentaOrigen?.nombreBanco;
        if (sortConfig.key === 'cuentaDestino') bValue = b.cuentaDestino?.nombreBanco;
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [transferencias, searchTerm, filterCuenta, sortConfig]);

  const totalPages = Math.ceil(filteredTransferencias.length / itemsPerPage);
  const paginatedTransferencias = filteredTransferencias.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExportarTablaPDF = () => {
    const doc = new jsPDF()
    doc.text("Historial de Transferencias", 14, 16)

    autoTable(doc, {
      startY: 20,
      head: [[
        'Comprobante',
        'Fecha',
        'Cuenta Origen',
        'Cuenta Destino',
        'Monto',
        'Motivo',
        'Estado'
      ]],
      body: filteredTransferencias.map(t => [
        t.numeroComprobante,
        format(new Date(t.fechaTransferencia), "dd/MM/yyyy HH:mm"),
        `${t.cuentaOrigen?.nombreBanco} - ${t.cuentaOrigen?.numeroCuenta}`,
        `${t.cuentaDestino?.nombreBanco} - ${t.cuentaDestino?.numeroCuenta}`,
        `${formatCurrency(t.montoOrigen, t.monedaOrigen)}${t.monedaOrigen !== t.monedaDestino ? ` -> ${formatCurrency(t.montoDestino, t.monedaDestino)}` : ''}`,
        t.motivo,
        t.comprobanteGenerado ? "Completada" : "Procesando"
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 163, 74] },
    })

    doc.save('transferencias.pdf')
  }

  const handleDescargarComprobante = async (transferenciaId: string) => {
    try {
      const response = await dispatch(
        contabilidadApi.endpoints.descargarComprobanteTransferencia.initiate(transferenciaId)
      ).unwrap()

      const blob = new Blob([response], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `comprobante-transferencia-${transferenciaId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al descargar comprobante:', error)
    }
  }

  const handleVerComprobante = (transferencia: any) => {
    const transferenciaNormalizada: ComprobanteTransferenciaData = {
      transferenciaId: transferencia.transferenciaId,
      numeroComprobante: transferencia.numeroComprobante,
      fechaTransferencia: transferencia.fechaTransferencia,
      cuentaOrigen: {
        nombreBanco: transferencia.cuentaOrigen?.nombreBanco || 'N/A',
        numeroCuenta: transferencia.cuentaOrigen?.numeroCuenta || 'N/A',
        tipoCuenta: transferencia.cuentaOrigen?.tipoCuenta || 'N/A'
      },
      cuentaDestino: {
        nombreBanco: transferencia.cuentaDestino?.nombreBanco || 'N/A',
        numeroCuenta: transferencia.cuentaDestino?.numeroCuenta || 'N/A',
        tipoCuenta: transferencia.cuentaDestino?.tipoCuenta || 'N/A'
      },
      montoOrigen: Number(transferencia.montoOrigen || 0),
      monedaOrigen: transferencia.monedaOrigen || 'CUP',
      montoDestino: Number(transferencia.montoDestino || 0),
      monedaDestino: transferencia.monedaDestino || 'CUP',
      tasaCambio: transferencia.tasaCambio ? Number(transferencia.tasaCambio) : undefined,
      motivo: transferencia.motivo || 'Transferencia bancaria',
      descripcion: transferencia.descripcion || undefined,
      realizadoPor: transferencia.realizadoPor || 'Sistema',
      comprobanteGenerado: Boolean(transferencia.comprobanteGenerado)
    }

    setOpenDropdownId(null)
    setTimeout(() => {
      setSelectedTransferencia(transferenciaNormalizada)
      setShowComprobante(true)
    }, 100)
  }

  if (isLoading) {
    return (
      <Card className={surfaceCardClass}>
        <CardHeader>
          <CardTitle>Historial de Transferencias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={surfaceCardClass}>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-6">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ArrowRightLeft className="h-5 w-5 text-blue-500" />
              Historial de Transferencias
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gestiona y monitorea todas las transferencias realizadas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={onRefresh} 
              variant="outline" 
              size="sm"
              className="h-9 border-slate-200/60 hover:bg-slate-100 dark:border-slate-800/60 dark:hover:bg-slate-800"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <Button 
              onClick={handleExportarTablaPDF} 
              variant="outline"
              size="sm"
              className="h-9 border-slate-200/60 hover:bg-slate-100 dark:border-slate-800/60 dark:hover:bg-slate-800"
            >
              <FileText className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por comprobante, banco o motivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(inputClass, "pl-10")}
              />
            </div>
            
            <Select value={filterCuenta} onValueChange={setFilterCuenta}>
              <SelectTrigger className={cn(inputClass, "w-full sm:w-[250px]")}>
                <Filter className="h-4 w-4 mr-2 text-slate-500" />
                <SelectValue placeholder="Filtrar por cuenta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cuentas</SelectItem>
                {cuentasBancarias.map((cuenta) => (
                  <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                    {cuenta.nombreBanco} - {cuenta.numeroCuenta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                  <TableHead className="font-semibold cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('numeroComprobante')}>
                    <div className="flex items-center gap-2">
                      Comprobante
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('fechaTransferencia')}>
                    <div className="flex items-center gap-2">
                      Fecha
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('cuentaOrigen')}>
                    <div className="flex items-center gap-2">
                      Cuenta Origen
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('cuentaDestino')}>
                    <div className="flex items-center gap-2">
                      Cuenta Destino
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('montoOrigen')}>
                    <div className="flex items-center gap-2">
                      Monto
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">Estado</TableHead>
                  <TableHead className="text-right font-semibold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {paginatedTransferencias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-500">
                          <ArrowRightLeft className="h-8 w-8 mb-2 opacity-50" />
                          <p>
                            {searchTerm || filterCuenta !== "all" 
                              ? "No se encontraron transferencias con los filtros aplicados"
                              : "No hay transferencias registradas"
                            }
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTransferencias.map((transferencia, index) => (
                      <motion.tr
                        key={transferencia.transferenciaId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.05 }}
                        className="group border-b border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                      >
                        <TableCell className="font-medium">
                          <Badge variant="outline" className="font-mono text-xs">
                            {transferencia.numeroComprobante}
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(transferencia.fechaTransferencia), "dd/MM/yyyy HH:mm")}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium text-sm">{transferencia.cuentaOrigen?.nombreBanco}</div>
                            <div className="text-xs text-slate-500 font-mono">
                              {transferencia.cuentaOrigen?.numeroCuenta}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium text-sm">{transferencia.cuentaDestino?.nombreBanco}</div>
                            <div className="text-xs text-slate-500 font-mono">
                              {transferencia.cuentaDestino?.numeroCuenta}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-semibold text-sm">
                              <AnimatedNumber value={transferencia.montoOrigen} currency={transferencia.monedaOrigen} />
                            </div>
                            {transferencia.monedaOrigen !== transferencia.monedaDestino && (
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <span className="text-blue-500">→</span> 
                                <AnimatedNumber value={transferencia.montoDestino} currency={transferencia.monedaDestino} />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge 
                            variant={transferencia.comprobanteGenerado ? "default" : "secondary"}
                            className={cn(
                              transferencia.comprobanteGenerado 
                                ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/25" 
                                : "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 hover:bg-amber-500/25",
                              "border-0"
                            )}
                          >
                            {transferencia.comprobanteGenerado ? "Completada" : "Procesando"}
                          </Badge>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <DropdownMenu 
                            open={openDropdownId === transferencia.transferenciaId}
                            onOpenChange={(open) => {
                              setOpenDropdownId(open ? transferencia.transferenciaId : null)
                            }}
                          >
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="sr-only">Abrir menú</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleVerComprobante(transferencia)} className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4 text-slate-500" />
                                Ver Comprobante
                              </DropdownMenuItem>
                              {transferencia.comprobanteGenerado && (
                                <DropdownMenuItem onClick={() => handleDescargarComprobante(transferencia.transferenciaId)} className="cursor-pointer">
                                  <Download className="mr-2 h-4 w-4 text-slate-500" />
                                  Descargar PDF
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredTransferencias.length)} de {filteredTransferencias.length} registros
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium">
                  Página {currentPage} de {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de comprobante */}
      {showComprobante && selectedTransferencia && (
        <ComprobanteTransferencia
          transferencia={selectedTransferencia}
          isOpen={showComprobante}
          onClose={() => {
            setShowComprobante(false)
            setSelectedTransferencia(null)
          }}
        />
      )}
    </>
  )
}
