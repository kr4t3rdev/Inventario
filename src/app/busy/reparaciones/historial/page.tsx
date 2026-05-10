'use client'

import { useEffect, useState } from "react"
import { getOrdenesReparacion } from "@/app/actions/reparaciones/ordenes"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, History, Eye } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function HistorialSeriesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  
  // Consultar API solo cuando haya un término de búsqueda (aunque la API soporta void, mejor no cargar todo)
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!debouncedSearch) { setOrdenes([]); return }
    setIsLoading(true)
    getOrdenesReparacion({ search: debouncedSearch })
      .then(setOrdenes)
      .catch(() => setOrdenes([]))
      .finally(() => setIsLoading(false))
  }, [debouncedSearch])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setDebouncedSearch(searchTerm)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            Historial por Número de Serie
        </h1>
        <p className="text-muted-foreground">Busca el historial completo de reparaciones de un equipo por su serie, marca o cliente.</p>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Búsqueda</CardTitle>
            <CardDescription>Ingrese el número de serie, nombre de cliente o número de orden.</CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleSearch} className="flex gap-4">
                <Input 
                    placeholder="Ej: SN12345678, Juan Perez..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                />
                <Button type="submit" disabled={!searchTerm}>
                    <Search className="mr-2 h-4 w-4" /> Buscar
                </Button>
            </form>
        </CardContent>
      </Card>

      {debouncedSearch && (
        <Card>
            <CardHeader>
                <CardTitle>Resultados</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center py-8">Cargando resultados...</div>
                ) : ordenes && ordenes.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Orden #</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Equipo</TableHead>
                                <TableHead>Serie</TableHead>
                                <TableHead>Problema</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ordenes.map((orden) => (
                                <TableRow key={orden.id}>
                                    <TableCell className="font-medium">{orden.numeroOrden}</TableCell>
                                    <TableCell>{format(new Date(orden.createdAt), "dd MMM yyyy", { locale: es })}</TableCell>
                                    <TableCell>{orden.cliente?.nombre}</TableCell>
                                    <TableCell>{orden.equipoTipo?.nombre} {orden.marca} {orden.modelo}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono">
                                            {orden.numeroSerie || "S/N"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={orden.problemaReportado}>
                                        {orden.problemaReportado}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={orden.estado === 'ENTREGADO' ? 'default' : 'secondary'}>
                                            {orden.estado}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href={`/busy/reparaciones/ordenes/${orden.id}`}>
                                                <Eye className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        No se encontraron reparaciones con ese criterio.
                    </div>
                )}
            </CardContent>
        </Card>
      )}
    </div>
  )
}
