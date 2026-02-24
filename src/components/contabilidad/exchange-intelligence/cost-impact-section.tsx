/**
 * @description Componente que visualiza el impacto del tipo de cambio en costos de inventario
 * @param props - Propiedades del componente
 * @returns Componente de sección de impacto en costos
 */
import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CostImpactSectionProps } from '@/lib/types/exchange-intelligence';
import { useGetCostImpactQuery } from '@/lib/redux/services/exchangeIntelligenceApi';
import { Loader2, TrendingUp, AlertTriangle, Calculator } from 'lucide-react';
import { useBreakpoints } from '@/hooks/use-breakpoints';
import { formatCurrency } from '@/lib/utils';

function CostImpactSection(props: CostImpactSectionProps): React.JSX.Element {
  const { fecha_inicio, fecha_fin, categoria_id, almacen_id, vendor_id } = props;

  // Hooks de responsive design
  const { isMobile } = useBreakpoints();

  // Estado para producto seleccionado en simulación
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Memoizar parámetros de la consulta para evitar re-ejecuciones innecesarias
  const queryParams = useMemo(() => ({
    fecha_inicio,
    fecha_fin,
    categoria_id,
    almacen_id,
    vendor_id,
  }), [fecha_inicio, fecha_fin, categoria_id, almacen_id, vendor_id]);

  const { data: costImpactData, isLoading, error } = useGetCostImpactQuery(queryParams);

  const { resumen, por_producto, detalle_reposiciones, moneda_principal } = useMemo(() => {
    if (!costImpactData) return { 
      resumen: { incremento_promedio: 0, productos_afectados: 0, alerta_ajuste_precios: false },
      por_producto: [] as any[],
      detalle_reposiciones: [] as any[],
      moneda_principal: 'CUP',
    };
    return {
      resumen: costImpactData.resumen,
      por_producto: costImpactData.por_producto || [],
      detalle_reposiciones: costImpactData.detalle_reposiciones || [],
      moneda_principal: costImpactData.moneda_principal || 'CUP',
    };
  }, [costImpactData]);

  const chart_data_timeline = useMemo(() => {
    const grouped = detalle_reposiciones.reduce((acc, item) => {
      const date = item.fecha.split('T')[0]; // Asumir formato ISO, tomar solo fecha
      if (!acc[date]) {
        acc[date] = { fecha: date, costo_historico: 0, costo_reposicion: 0 };
      }
      acc[date].costo_historico += item.gasto_historico_local;
      acc[date].costo_reposicion += item.gasto_reposicion_local;
      return acc;
    }, {} as Record<string, { fecha: string; costo_historico: number; costo_reposicion: number }>);
    return (Object.values(grouped) as Array<{ fecha: string; costo_historico: number; costo_reposicion: number }>).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [detalle_reposiciones]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className={isMobile ? 'pb-2' : ''}>
          <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
            <TrendingUp className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
            Matriz de Riesgo de Reposición
          </CardTitle>
          <CardDescription className={isMobile ? 'text-xs' : 'text-sm'}>
            Priorización automática de productos críticos por impacto cambiario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`flex items-center justify-center ${isMobile ? 'h-48' : 'h-64'}`}>
            <Loader2 className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} animate-spin`} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !costImpactData) {
    return (
      <Card>
        <CardHeader className={isMobile ? 'pb-2' : ''}>
          <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
            <TrendingUp className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
            Matriz de Riesgo de Reposición
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className={isMobile ? 'text-xs' : 'text-sm'}>
              Error al cargar los datos de impacto en costos
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const showAlert = resumen.alerta_ajuste_precios;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Matriz de Riesgo de Reposición
        </CardTitle>
        <CardDescription>
          Priorización automática de productos críticos: próximos a agotarse y con mayor impacto cambiario
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Alerta de ajuste de precios */}
        {showAlert && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Alerta: Considera subir precios de venta para mantener el margen de reposición.
            </AlertDescription>
          </Alert>
        )}

        {/* Estadísticas resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {resumen.incremento_promedio.toFixed(2)}%
            </div>
            <div className="text-sm text-muted-foreground">
              Incremento Promedio
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600"> 
              {resumen.productos_afectados}
            </div>
            <div className="text-sm text-muted-foreground">
              Productos Afectados
            </div>
          </div>
          <div className="text-center">
            <Badge variant={showAlert ? "destructive" : "secondary"}>
              {showAlert ? "Requiere Atención" : "Estable"}
            </Badge>
          </div>
        </div>

        {/* Tabs para alternar entre Matriz y Gráfico */}
        <Tabs defaultValue="matrix" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="matrix">Matriz de Riesgo</TabsTrigger>
            <TabsTrigger value="chart">Gráfico de Tendencia</TabsTrigger>
          </TabsList>

          <TabsContent value="matrix">
            {/* Matriz de Riesgo de Reposición */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto (SKU)</TableHead>
                    <TableHead className="text-right">Stock Actual</TableHead>
                    <TableHead className="text-right">Nivel Reorden</TableHead>
                    <TableHead className="text-right">Costo en Libros</TableHead>
                    <TableHead className="text-right">Costo Reposición</TableHead>
                    <TableHead className="text-right">Variación Costo</TableHead>
                    <TableHead className="text-right">Nuevo Margen Est.</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {por_producto.length > 0 ? (
                    [...por_producto]
                      .sort((a, b) => {
                        // Priorizar: productos con stock bajo y alta variación
                        const aStockLow = (a.stock_actual || 0) <= (a.nivel_reorden || 0);
                        const bStockLow = (b.stock_actual || 0) <= (b.nivel_reorden || 0);
                        const aHighVariation = Math.abs(a.diferencia_porcentual) > 10;
                        const bHighVariation = Math.abs(b.diferencia_porcentual) > 10;

                        if (aStockLow && aHighVariation && !(bStockLow && bHighVariation)) return -1;
                        if (bStockLow && bHighVariation && !(aStockLow && aHighVariation)) return 1;
                        return Math.abs(b.diferencia_porcentual) - Math.abs(a.diferencia_porcentual);
                      })
                      .map((item, index) => {
                        const costoReposicion = item.gasto_reposicion / item.reposiciones || 0;
                        const costoHistorico = item.gasto_historico / item.reposiciones || 0;
                        const variacion = ((costoReposicion - costoHistorico) / costoHistorico) * 100;
                        const precioVenta = item.precio_venta || costoHistorico * 1.3; // Placeholder
                        const nuevoMargen = ((precioVenta - costoReposicion) / precioVenta) * 100;
                        const stockLow = (item.stock_actual || 0) <= (item.nivel_reorden || 0);
                        const highVariation = Math.abs(variacion) > 10;
                        const estado = stockLow && highVariation ? '🚨 Reponer ya' : stockLow ? '⚠️ Bajo stock' : highVariation ? '📈 Alta variación' : '✅ OK';

                        const isCritical = stockLow && highVariation;

                        return (
                          <TableRow
                            key={index}
                            className={`${nuevoMargen < 15 ? 'bg-red-50' : ''} ${isCritical ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                            onClick={isCritical ? () => setSelectedProduct(item) : undefined}
                          >
                            <TableCell className="font-medium">{item.nombre}</TableCell>
                            <TableCell className="text-right">{item.stock_actual || 'N/A'}</TableCell>
                            <TableCell className="text-right">{item.nivel_reorden || 'N/A'}</TableCell>
                            <TableCell className="text-right text-blue-600">
                              {formatCurrency(costoHistorico)}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {formatCurrency(costoReposicion)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={variacion > 5 ? "destructive" : variacion < -5 ? "default" : "secondary"}>
                                {variacion > 0 ? '+' : ''}{variacion.toFixed(2)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={nuevoMargen < 15 ? "destructive" : "secondary"}>
                                {nuevoMargen.toFixed(2)}%
                              </Badge>
                            </TableCell>
                            <TableCell>{estado}</TableCell>
                          </TableRow>
                        );
                      })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No hay datos disponibles para el período seleccionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="chart">
            {/* Gráfico de Tendencia */}
            <div
              className="h-80 w-full"
              role="img"
              aria-label={`Gráfico de línea de tiempo comparativa mostrando costo histórico vs costo de reposición. Incremento promedio: ${resumen.incremento_promedio.toFixed(2)}%. Moneda principal: ${moneda_principal}. ${showAlert ? 'Requiere atención: considera subir precios de venta.' : 'Situación estable.'}`}
            >
              <ResponsiveContainer
                width="100%"
                height="100%"
                key={isMobile ? 'mobile-chart' : 'desktop-chart'}
              >
                <LineChart
                  data={chart_data_timeline}
                  aria-describedby="cost-timeline-chart-description"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="fecha"
                    tick={{ fontSize: 12 }}
                    aria-label="Eje X: Fechas"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `${moneda_principal}${Number(value).toLocaleString()}`}
                    aria-label="Eje Y: Costos en moneda principal"
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === 'costo_historico' ? 'Costo Histórico' : 'Costo de Reposición'
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="costo_historico"
                    stroke="#2563eb"
                    name="Costo Histórico"
                    aria-label="Línea azul: Costo histórico acumulado por fecha"
                  />
                  <Line
                    type="monotone"
                    dataKey="costo_reposicion"
                    stroke="#dc2626"
                    name="Costo de Reposición"
                    aria-label="Línea roja: Costo de reposición acumulado por fecha"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div id="cost-timeline-chart-description" className="sr-only">
                Gráfico de líneas comparando costo histórico (línea azul) vs costo de reposición (línea roja) a lo largo del tiempo.
                El costo histórico representa lo pagado en compras pasadas, mientras que el costo de reposición estima el costo actual para reponer el mismo inventario.
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Información adicional */}
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            • <strong>Matriz de Riesgo:</strong> Prioriza productos próximos a agotarse y con mayor variación cambiaria
          </p>
          <p>
            • <strong>Nuevo Margen Est.:</strong> Margen proyectado si se repone con costos actuales
          </p>
          <p>
            • Filas en rojo indican márgenes por debajo del umbral mínimo (15%). Haz clic en productos críticos para simular ajustes de precio.
          </p>
        </div>
      </CardContent>

      {/* Panel de Simulación de Precios */}
      <Sheet open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Ajuste de Precios Inteligente
            </SheetTitle>
            <SheetDescription>
              Simulación para {selectedProduct?.nombre}
            </SheetDescription>
          </SheetHeader>
          {selectedProduct && (
            <div className="mt-6 space-y-4">
              {(() => {
                const costoReposicion = selectedProduct.gasto_reposicion / selectedProduct.reposiciones || 0;
                const precioVentaActual = selectedProduct.precio_venta || (selectedProduct.gasto_historico / selectedProduct.reposiciones) * 1.3;
                const margenActual = ((precioVentaActual - (selectedProduct.gasto_historico / selectedProduct.reposiciones)) / precioVentaActual) * 100;
                const precioSugerido = costoReposicion / (1 - 0.30); // Para mantener 30% margen
                const nuevoMargen = ((precioVentaActual - costoReposicion) / precioVentaActual) * 100;

                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Costo Nuevo Proyectado</div>
                        <div className="text-lg font-bold text-red-600">{formatCurrency(costoReposicion)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Precio Venta Actual</div>
                        <div className="text-lg font-bold">{formatCurrency(precioVentaActual)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Margen Actual</div>
                        <div className="text-lg font-bold">{margenActual.toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Nuevo Margen Proyectado</div>
                        <div className={`text-lg font-bold ${nuevoMargen < 15 ? 'text-red-600' : 'text-green-600'}`}>
                          {nuevoMargen.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Para mantener tu margen histórico del 30%, deberías subir el precio a {formatCurrency(precioSugerido)}.
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-2 pt-4">
                      <Button className="flex-1">Actualizar Precio de Venta</Button>
                      <Button variant="outline" className="flex-1">Mantener Precio y Absorber Pérdida</Button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

export default React.memo(CostImpactSection, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.fecha_inicio === nextProps.fecha_inicio &&
    prevProps.fecha_fin === nextProps.fecha_fin &&
    prevProps.categoria_id === nextProps.categoria_id &&
    prevProps.almacen_id === nextProps.almacen_id &&
    prevProps.vendor_id === nextProps.vendor_id
  );
});