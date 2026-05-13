'use client'

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { Users, TrendingUp, CheckCircle, DollarSign } from "lucide-react"
import { getAuthToken } from '@/lib/token'

export default function TecnicosDashboardPage() {
  const [stats, setStats] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/servicios/reparaciones/tecnicos/stats', {
      cache: 'no-store',
      headers: { Authorization: getAuthToken() },
    })
      .then((response) => response.json())
      .then(setStats)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return <div className="container mx-auto py-8 text-center">Cargando estadísticas...</div>
  }

  // Cálculos globales
  const totalGenerado = stats?.reduce((acc, curr) => acc + curr.totalGenerado, 0) || 0
  const totalManoObra = stats?.reduce((acc, curr) => acc + curr.manoDeObraGenerada, 0) || 0
  const totalOrdenes = stats?.reduce((acc, curr) => acc + curr.totalOrdenes, 0) || 0
  const totalCompletadas = stats?.reduce((acc, curr) => acc + curr.ordenesCompletadas, 0) || 0

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Rendimiento de Técnicos
        </h1>
        <p className="text-muted-foreground">Métricas de productividad y comisiones del equipo técnico.</p>
      </div>

      {/* Resumen Global */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Generado</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalGenerado)}</div>
                <p className="text-xs text-muted-foreground">Mano de obra: {formatCurrency(totalManoObra)}</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Órdenes Asignadas</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{totalOrdenes}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completadas</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{totalCompletadas}</div>
                <p className="text-xs text-muted-foreground">
                    {totalOrdenes > 0 ? Math.round((totalCompletadas / totalOrdenes) * 100) : 0}% efectividad
                </p>
            </CardContent>
        </Card>
      </div>

      {/* Tabla Detallada */}
      <Card>
        <CardHeader>
            <CardTitle>Detalle por Técnico</CardTitle>
            <CardDescription>Desglose de rendimiento individual y comisiones estimadas (basado en mano de obra).</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Técnico</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead className="text-right">Órdenes</TableHead>
                        <TableHead className="text-right">Completadas</TableHead>
                        <TableHead className="text-right">Tasa %</TableHead>
                        <TableHead className="text-right">Mano de Obra</TableHead>
                        <TableHead className="text-right">Total Generado</TableHead>
                        <TableHead className="text-right">Comisión Est.</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {stats && stats.length > 0 ? (
                        stats.map((tech) => (
                            <TableRow key={tech.id}>
                                <TableCell className="font-medium">{tech.nombre}</TableCell>
                                <TableCell><Badge variant="outline">{tech.cargo}</Badge></TableCell>
                                <TableCell className="text-right">{tech.totalOrdenes}</TableCell>
                                <TableCell className="text-right">{tech.ordenesCompletadas}</TableCell>
                                <TableCell className="text-right">
                                    <span className={tech.tasaCompletado >= 80 ? "text-green-600 font-bold" : ""}>
                                        {tech.tasaCompletado}%
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(tech.manoDeObraGenerada)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(tech.totalGenerado)}</TableCell>
                                <TableCell className="text-right font-bold text-green-600">
                                    {formatCurrency(tech.comisionEstimada)}
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                No hay datos disponibles.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  )
}
