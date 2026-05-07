'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Calendar,
  User,
  FileText,
  CheckCircle,
  XCircle
} from "lucide-react";
import { format } from "date-fns";


interface cierre {
    tipo:string;
    estado:string;
    fechaInicio:Date;
    fechaFin:Date
    creadoPor:string;
    observaciones:string;
    totalVentas: number;
    totalGastos: number;
    totalGastosM: number;
    ganancias: number;
    perdidas: number;
    deudasClientes: number;
    deudasProveedores: number;
    inventarioVendido: number;
    inventarioRebajado: number;
    stockFinal: number
    margenGanancia:number;
    margenPerdida:number;
    ventasVsExistencias:number;
}

/**
 * Componente para mostrar detalles completos de un cierre contable
 * @param cierre - Datos del cierre
 * @param onClose - Función para cerrar el modal/detalles
 * @param onApprove - Función para aprobar el cierre
 */
export function CierreDetails({ cierre, onClose, onApprove }: {
  cierre: cierre;
  onClose: () => void;
  onApprove?: () => void;
}) {
  if (!cierre) return null;

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

  const formatCurrency = (amount: number) => {
    return Number(amount).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatPercent = (value: number) => {
    return `${Number(value).toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Detalles del Cierre Contable</h2>
          <p className="text-muted-foreground">
            {format(new Date(cierre.fechaInicio), "dd/MM/yyyy")} - {format(new Date(cierre.fechaFin), "dd/MM/yyyy")}
          </p>
        </div>
        <div className="flex gap-2">
          {cierre.estado === 'cerrado' && onApprove && (
            <Button onClick={onApprove} variant="default">
              <CheckCircle className="h-4 w-4 mr-2" />
              Aprobar Cierre
            </Button>
          )}
          <Button onClick={onClose} variant="outline">
            <XCircle className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </div>

       {/* Layout Horizontal Principal */}
       <div className="grid grid-cols-2 gap-6">
        {/* Columna Izquierda */}
        <div className="space-y-6">
          {/* Información General */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label className="text-sm font-medium">Tipo de Cierre</Label>
                  <p className="text-lg capitalize">{cierre.tipo}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Estado</Label>
                  <div className="mt-1">{getEstadoBadge(cierre.estado)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Creado por</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4" />
                    <span>{cierre.creadoPor}</span>
                  </div>
                </div>
              </div>
              {cierre.observaciones && (
                <div className="mt-4">
                  <Label className="text-sm font-medium">Observaciones</Label>
                  <p className="text-sm text-muted-foreground mt-1">{cierre.observaciones}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deudas y Obligaciones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Deudas y Obligaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">Deudas con Clientes</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-600">
                    CUP {formatCurrency(cierre.deudasClientes)}
                  </p>
                  <p className="text-xs text-muted-foreground">Ventas pendientes de cobro</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Monto de gasto por reconciliar</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    CUP {formatCurrency(cierre.deudasProveedores)}
                  </p>
                  <p className="text-xs text-muted-foreground">Compras pendientes de pago</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha */}
        <div className="space-y-6">
          {/* Estadísticas Financieras */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Estadísticas Financieras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Total Ventas</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    CUP {formatCurrency(cierre.totalVentas)}
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Total Gastos</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    CUP {formatCurrency(cierre.totalGastosM)}
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Ganancias</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    CUP {formatCurrency(cierre.ganancias)}
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Pérdidas</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">
                    CUP {formatCurrency(cierre.perdidas)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Análisis de Inventario */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Análisis de Inventario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Vendido</span>
                  </div>
                  <p className="text-2xl font-bold">{cierre.inventarioVendido}</p>
                  <p className="text-xs text-muted-foreground">unidades</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Rebajado</span>
                  </div>
                  <p className="text-2xl font-bold">{cierre.inventarioRebajado}</p>
                  <p className="text-xs text-muted-foreground">unidades</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Stock Final</span>
                  </div>
                  <p className="text-2xl font-bold">{cierre.stockFinal}</p>
                  <p className="text-xs text-muted-foreground">unidades</p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                <h4 className="font-medium">Márgenes de Ganancia/Pérdida</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">Margen de Ganancia</p>
                    <p className="text-lg font-bold text-green-800">{formatPercent(cierre.margenGanancia)}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-700">Margen de Pérdida</p>
                    <p className="text-lg font-bold text-red-800">{formatPercent(cierre.margenPerdida)}</p>
                  </div>
                </div>

                {cierre.ventasVsExistencias && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Análisis Comparativo</h4>
                    <p className="text-sm text-blue-700">{cierre.ventasVsExistencias}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Componente auxiliar para labels
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-medium ${className}`}>{children}</label>;
}