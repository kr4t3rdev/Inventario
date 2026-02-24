/**
 * @description Componente que evalúa la eficiencia en la compra de divisas
 * @param props - Propiedades del componente
 * @returns Componente de sección de eficiencia de pagos
 */
import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaymentEfficiencySectionProps } from '@/lib/types/exchange-intelligence';
import { useGetPaymentEfficiencyQuery } from '@/lib/redux/services/exchangeIntelligenceApi';
import { Loader2, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';

function PaymentEfficiencySection(props: PaymentEfficiencySectionProps): React.JSX.Element {
  const { fecha_inicio, fecha_fin, moneda } = props;

  const { data: paymentEfficiencyData, isLoading, error } = useGetPaymentEfficiencyQuery({
    fecha_inicio,
    fecha_fin,
    moneda,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Eficiencia de Pagos
          </CardTitle>
          <CardDescription>
            Análisis de spreads bancarios en transacciones de cambio
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

  if (error || !paymentEfficiencyData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Eficiencia de Pagos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Error al cargar los datos de eficiencia de pagos
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { transacciones, spread_promedio: spread_promedio_ponderado, recomendacion_renegociacion } = paymentEfficiencyData;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Eficiencia de Pagos
        </CardTitle>
        <CardDescription>
          Comparación de tasas oficiales vs. tasas reales obtenidas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Recomendación de renegociación */}
        {recomendacion_renegociacion && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Spread bancario promedio alto ({spread_promedio_ponderado}%).
              Considere renegociar condiciones con su banco.
            </AlertDescription>
          </Alert>
        )}

        {/* Estadísticas principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {spread_promedio_ponderado}%
            </div>
            <div className="text-sm text-muted-foreground">
              Spread Promedio
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {transacciones.length}
            </div>
            <div className="text-sm text-muted-foreground">
              Transacciones
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              ${transacciones.reduce((sum, tx) => sum + tx.monto, 0).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              Volumen Total
            </div>
          </div>
          <div className="text-center">
            <Badge variant={recomendacion_renegociacion ? "destructive" : "secondary"}>
              {recomendacion_renegociacion ? "Renegociar" : "Aceptable"}
            </Badge>
          </div>
        </div>

        {/* Tabla de transacciones */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Tasa Oficial</TableHead>
                <TableHead className="text-right">Tasa Real</TableHead>
                <TableHead className="text-right">Spread</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transacciones.map((tx, index) => (
                <TableRow key={index}>
                  <TableCell>{new Date(tx.fecha).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{tx.moneda}</Badge>
                  </TableCell>
                  <TableCell className="text-right">${tx.monto.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{tx.tasa_oficial.toFixed(4)}</TableCell>
                  <TableCell className="text-right">{tx.tasa_real.toFixed(4)}</TableCell>
                  <TableCell className={`text-right font-medium ${
                    tx.spread_bancario > 3 ? 'text-red-600' :
                    tx.spread_bancario > 1 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {tx.spread_bancario > 0 ? '+' : ''}{tx.spread_bancario}%
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      tx.spread_bancario > 3 ? "destructive" :
                      tx.spread_bancario > 1 ? "secondary" : "default"
                    }>
                      {tx.spread_bancario > 3 ? "Alto" :
                       tx.spread_bancario > 1 ? "Medio" : "Bajo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {transacciones.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No hay transacciones de cambio en el período seleccionado
          </div>
        )}

        {/* Información adicional */}
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            • <strong>Spread Bancario:</strong> Diferencia porcentual entre tasa oficial y tasa real
          </p>
          <p>
            • <strong>Tasa Oficial:</strong> Tipo de cambio publicado por el banco central
          </p>
          <p>
            • <strong>Tasa Real:</strong> Tipo de cambio efectivamente pagado en la transacción
          </p>
          <p>
            • Un spread menor indica mejor eficiencia en la compra de divisas
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default React.memo(PaymentEfficiencySection, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.fecha_inicio === nextProps.fecha_inicio &&
    prevProps.fecha_fin === nextProps.fecha_fin &&
    prevProps.moneda === nextProps.moneda
  );
});