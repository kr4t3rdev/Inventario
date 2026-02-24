/**
 * @description Componente que analiza la exposición a riesgos cambiarios en cuentas por pagar
 * @param props - Propiedades del componente
 * @returns Componente de sección de exposición de deuda
 */
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DebtExposureSectionProps } from '@/lib/types/exchange-intelligence';
import { useGetDebtExposureQuery } from '@/lib/redux/services/exchangeIntelligenceApi';
import { Loader2, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';

function DebtExposureSection(props: DebtExposureSectionProps): React.JSX.Element {
  const { fecha_corte } = props;

  const { data: debtExposureData, isLoading, error } = useGetDebtExposureQuery({
    fecha_corte,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Exposición de Deuda
          </CardTitle>
          <CardDescription>
            Análisis de riesgos cambiarios en cuentas por pagar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !debtExposureData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Exposición de Deuda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Error al cargar los datos de exposición de deuda
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { deuda_original_local, deuda_actual_local, perdida_no_realizada, desglose_por_moneda, alertas } = debtExposureData;
  const showAlert = alertas.length > 0;

  // Preparar datos para el gráfico
  const chartData = [
    {
      name: 'Deuda',
      deuda_original: deuda_original_local,
      deuda_actual: deuda_actual_local,
      perdida: perdida_no_realizada,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Exposición de Deuda
        </CardTitle>
        <CardDescription>
          Comparación entre deuda original y valor actual con tasas vigentes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Alertas */}
        {alertas.map((alerta, index) => (
          <Alert key={index} className="mb-4" variant={alerta.severidad === 'critical' ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{alerta.mensaje}</AlertDescription>
          </Alert>
        ))}

        {/* Estadísticas principales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              ${deuda_original_local.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              Deuda Original
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              ${deuda_actual_local.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              Deuda Actual
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${perdida_no_realizada > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ${Math.abs(perdida_no_realizada).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              {perdida_no_realizada > 0 ? 'Pérdida No Realizada' : 'Ganancia No Realizada'}
            </div>
          </div>
        </div>

        {/* Gráfico comparativo */}
        <div className="h-80 w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
              <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
              <Legend />
              <Bar dataKey="deuda_original" fill="#2563eb" name="Deuda Original" />
              <Bar dataKey="deuda_actual" fill="#dc2626" name="Deuda Actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Desglose por moneda */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold">Desglose por Moneda</h4>
          <div className="grid gap-4">
            {desglose_por_moneda.map((moneda) => (
              <div key={moneda.moneda} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{moneda.moneda}</Badge>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className={`text-sm ${
                        moneda.tendencia === 'alcista' ? 'text-red-600' :
                        moneda.tendencia === 'bajista' ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {moneda.tendencia === 'alcista' ? 'Alcista' :
                         moneda.tendencia === 'bajista' ? 'Bajista' : 'Estable'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      Antigüedad: {moneda.antiguedad_dias} días
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Original</div>
                    <div className="text-muted-foreground">${moneda.monto_original.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="font-medium">Actual</div>
                    <div className="text-muted-foreground">${moneda.monto_actual.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className={`font-medium ${moneda.diferencia > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Diferencia
                    </div>
                    <div className={`text-muted-foreground ${moneda.diferencia > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${Math.abs(moneda.diferencia).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Información adicional */}
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            • <strong>Pérdida No Realizada:</strong> Diferencia entre el valor registrado de la deuda y su valor actual
          </p>
          <p>
            • <strong>Tendencia:</strong> Basada en cambios de la moneda en los últimos 30 días
          </p>
          <p>
            • Deudas en monedas con tendencia alcista representan mayor riesgo
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default React.memo(DebtExposureSection, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return prevProps.fecha_corte === nextProps.fecha_corte;
});