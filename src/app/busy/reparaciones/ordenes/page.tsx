'use client'

import { useState, useEffect } from "react"
import { LazyMotion, m as motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getOrdenesReparacion } from "@/app/actions/reparaciones/ordenes"
import { Plus, Search, Wrench, FileText } from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { EstadoOrden } from "@/app/models/model"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function OrdenesReparacionPage() {
  const [statusFilter, setStatusFilter] = useState<string>("TODOS")
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [exchangeRate, setExchangeRate] = useState<number>(1)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    let mounted = true
    const loadRate = async () => {
      try {
        const token = sessionStorage.getItem('token')
        const res = await fetch('/api/exchange?from=USD&to=CUP', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const rate = Number(data?.rate) || 1
          if (mounted) setExchangeRate(rate)
        }
      } catch {
        if (mounted) setExchangeRate(1)
      }
    }
    loadRate()
    return () => { mounted = false }
  }, [])
  
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    getOrdenesReparacion({ estado: statusFilter, search: debouncedSearch || undefined })
      .then(setOrdenes)
      .catch(() => setOrdenes([]))
      .finally(() => setIsLoading(false))
  }, [statusFilter, debouncedSearch])

  const getStatusColor = (status: EstadoOrden) => {
    switch (status) {
      case 'RECIBIDO': return "bg-blue-100 text-blue-800"
      case 'EN_DIAGNOSTICO': return "bg-purple-100 text-purple-800"
      case 'ESPERANDO_APROBACION': return "bg-yellow-100 text-yellow-800"
      case 'EN_REPARACION': return "bg-orange-100 text-orange-800"
      case 'TERMINADO': return "bg-green-100 text-green-800"
      case 'ENTREGADO': return "bg-gray-100 text-gray-800"
      case 'CANCELADO': return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusLabel = (status: EstadoOrden) => {
    return status.replace(/_/g, " ")
  }

  return (
    <motion.div 
      className="container mx-auto py-6 px-4 space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            <Wrench className="h-5 w-5 text-white" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold">Órdenes de Reparación</h1>
            <p className="text-muted-foreground text-sm">Gestiona el flujo de trabajo del taller</p>
          </div>
        </div>
        <div className="flex gap-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button asChild variant="outline">
                  <Link href="/busy/reparaciones">
                      Configurar Catálogo
                  </Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                asChild
                className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg"
              >
                  <Link href="/busy/reparaciones/ordenes/new">
                      <Plus className="mr-2 h-4 w-4" /> Nueva Orden
                  </Link>
              </Button>
            </motion.div>
        </div>
      </motion.div>

      <motion.div 
        className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-lg border shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, orden, marca..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="TODOS">Todos los estados</SelectItem>
                <SelectItem value="RECIBIDO">Recibido</SelectItem>
                <SelectItem value="EN_DIAGNOSTICO">En Diagnóstico</SelectItem>
                <SelectItem value="ESPERANDO_APROBACION">Esperando Aprobación</SelectItem>
                <SelectItem value="EN_REPARACION">En Reparación</SelectItem>
                <SelectItem value="TERMINADO">Terminado</SelectItem>
                <SelectItem value="ENTREGADO">Entregado</SelectItem>
            </SelectContent>
        </Select>
      </motion.div>

      {isLoading ? (
        <div className="text-center py-12">Cargando órdenes...</div>
      ) : ordenes && ordenes.length > 0 ? (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, staggerChildren: 0.1 }}
        >
          {ordenes.map((orden, index) => (
            <motion.div
              key={orden.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4 }}
            >
              <Link href={`/busy/reparaciones/ordenes/${orden.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-l-4" style={{ borderLeftColor: orden.prioridad === 'URGENTE' ? 'red' : 'transparent' }}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="secondary" className="mb-2">#{orden.numeroOrden}</Badge>
                      <Badge className={getStatusColor(orden.estado)} variant="outline">
                          {getStatusLabel(orden.estado)}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">
                      {(() => {
                        const primary = orden.equipos?.[0]
                        const multiple = (orden.equipos?.length ?? 0) > 1
                        if (multiple) return `Orden múltiple (${orden.equipos?.length} equipos)`
                        return `${primary?.equipoTipo?.nombre || orden.equipoTipo?.nombre || 'Equipo'} - ${primary?.marca || orden.marca}`
                      })()}
                    </CardTitle>
                    <CardDescription>
                      {orden.cliente?.nombre} • {new Date(orden.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                          <span className="text-muted-foreground">Modelo:</span>
                          <span className="font-medium">{orden.modelo || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-muted-foreground">Problema:</span>
                          <span className="font-medium truncate max-w-[150px]" title={orden.problemaReportado}>{orden.problemaReportado}</span>
                      </div>
                       <div className="flex justify-between mt-4 pt-2 border-t">
                          <span className="text-muted-foreground">Total Estimado:</span>
                          <span className="font-bold text-primary">{formatCurrency(Number(orden.total) * exchangeRate)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div 
          className="text-center py-12 bg-muted/10 rounded-lg border border-dashed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No hay órdenes encontradas</h3>
          <p className="text-muted-foreground">Intenta cambiar los filtros o crea una nueva orden.</p>
        </motion.div>
      )}
    </motion.div>
  )
}
