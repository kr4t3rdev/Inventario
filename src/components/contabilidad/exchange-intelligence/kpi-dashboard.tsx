import React from 'react';
import { KPIDashboardProps } from '@/lib/types/exchange-intelligence';
import { useGetKPIsQuery } from '@/lib/redux/services/exchangeIntelligenceApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, TrendingUp, BarChart3, Target } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

/**
 * @description Componente que visualiza los KPIs de inteligencia cambiaria
 * @param props - Propiedades del componente
 * @returns Componente de panel de KPIs
 */
export const KPIDashboard: React.FC<KPIDashboardProps> = ({ fecha_inicio, fecha_fin }) => {
  const { data: kpisData, isLoading, error } = useGetKPIsQuery({
    fecha_inicio,
    fecha_fin,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !kpisData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error al cargar los indicadores clave de desempeño (KPIs)
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Tasa de Equilibrio */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Tasas de Equilibrio por Producto
          </CardTitle>
          <CardDescription>
            Productos más sensibles a variaciones del tipo de cambio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {kpisData.tasa_equilibrio.map((producto) => (
              <div key={producto.producto_id} className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{producto.nombre}</span>
                  <Badge variant={
                    producto.estado === 'critico' ? 'destructive' :
                    producto.estado === 'advertencia' ? 'secondary' : 'default'
                  }>
                    {producto.estado}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Equilibrio: CUP{producto.tasa_equilibrio.toFixed(2)}</span>
                  <span>Actual: CUP{producto.tasa_actual.toFixed(2)}</span>
                  <span className={producto.proximidad_porcentaje > 90 ? 'text-red-600 font-bold' : ''}>
                    Riesgo: {producto.proximidad_porcentaje.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      producto.estado === 'critico' ? 'bg-destructive' :
                      producto.estado === 'advertencia' ? 'bg-yellow-500' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(producto.proximidad_porcentaje, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Margen Real vs Nominal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análisis de Margen
          </CardTitle>
          <CardDescription>
            Impacto cambiario en rentabilidad
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {kpisData.margen_real_vs_nominal.margen_real.toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground">Margen Real Ajustado</div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold">{kpisData.margen_real_vs_nominal.margen_nominal.toFixed(2)}%</div>
                <div className="text-xs text-muted-foreground">Nominal</div>
              </div>
              <div>
                <div className={`text-lg font-semibold ${kpisData.margen_real_vs_nominal.diferencia_porcentual < 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {kpisData.margen_real_vs_nominal.diferencia_porcentual.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">Diferencia</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diferencial Cambiario Acumulado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Diferencial Acumulado
          </CardTitle>
          <CardDescription>
            Pérdida/Ganancia cambiaria YTD
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${kpisData.diferencial_cambiario_acumulado.ytd < 0 ? 'text-destructive' : 'text-green-600'}`}>
                CUP{Math.abs(kpisData.diferencial_cambiario_acumulado.ytd).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {kpisData.diferencial_cambiario_acumulado.ytd < 0 ? 'Pérdida Acumulada' : 'Ganancia Acumulada'}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>vs. Año Anterior</span>
                <span className={kpisData.diferencial_cambiario_acumulado.comparacion_anio_anterior < 0 ? 'text-destructive' : 'text-green-600'}>
                  {kpisData.diferencial_cambiario_acumulado.comparacion_anio_anterior > 0 ? '+' : ''}
                  {kpisData.diferencial_cambiario_acumulado.comparacion_anio_anterior.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KPIDashboard;
