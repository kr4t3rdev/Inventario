'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Calendar, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";

/**
 * Tabla para mostrar el historial de cierres contables
 * @param cierres - Lista de cierres
 * @param isLoading - Estado de carga
 */
export function CierresTable({ cierres, isLoading }: {
  cierres: any[];
  isLoading: boolean;
}) {
  const router = useRouter();
  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'abierto':
        return <Badge variant="secondary">Abierto</Badge>;
      case 'cerrado':
        return <Badge variant="outline">Cerrado</Badge>;
      case 'aprobado':
        return <Badge variant="default">Aprobado</Badge>;
      default:
        return <Badge variant="secondary">{estado}</Badge>;
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'diario':
        return <Badge variant="outline">Diario</Badge>;
      case 'mensual':
        return <Badge variant="default">Mensual</Badge>;
      case 'anual':
        return <Badge variant="destructive">Anual</Badge>;
      default:
        return <Badge variant="secondary">{tipo}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historial de Cierres</CardTitle>
          <CardDescription>Cargando cierres contables...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Cierres Contables</CardTitle>
        <CardDescription>
          Lista de todos los cierres realizados con sus estadísticas principales
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cierres.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="mx-auto h-12 w-12 mb-4" />
            <p>No hay cierres contables registrados aún</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Ventas</TableHead>
                <TableHead>Gastos</TableHead>
                <TableHead>Ganancias</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cierres.map((cierre) => (
                <TableRow key={cierre.cierreId}>
                  <TableCell>{getTipoBadge(cierre.tipo)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{format(new Date(cierre.fechaInicio), "dd/MM/yyyy")}</div>
                      <div className="text-muted-foreground">
                        al {format(new Date(cierre.fechaFin), "dd/MM/yyyy")}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {Number(cierre.totalVentas).toLocaleString('es-ES', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      {Number(cierre.totalGastos).toLocaleString('es-ES', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      {Number(cierre.ganancias).toLocaleString('es-ES', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </div>
                  </TableCell>
                  <TableCell>{getEstadoBadge(cierre.estado)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/busy/contabilidad/cierres/${cierre.cierreId}`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalles
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}