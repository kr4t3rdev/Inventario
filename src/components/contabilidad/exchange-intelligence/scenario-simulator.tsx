import React, { useState, useMemo } from 'react';
import { ScenarioSimulatorProps } from '@/lib/types/exchange-intelligence';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sliders, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * @description Componente de simulación de escenarios cambiarios
 * @param props - Propiedades del componente
 * @returns Componente del simulador
 */
const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({ datos_actuales }) => {
  const [exchangeRateVariation, setExchangeRateVariation] = useState<number>(0);

  const simulatedData = useMemo(() => {
    if (!datos_actuales) return null;

    const variationFactor = 1 + exchangeRateVariation / 100;
    
    // Simular impacto en margen real
    const simulatedMargenReal = datos_actuales.margen_real_vs_nominal.margen_real * (1 - (exchangeRateVariation / 50));
    
    // Simular impacto en diferencial
    const simulatedDiferencial = datos_actuales.diferencial_cambiario_acumulado.ytd * variationFactor;

    return {
      margenReal: simulatedMargenReal,
      diferencial: simulatedDiferencial,
      isPositive: exchangeRateVariation < 0,
      severity: Math.abs(exchangeRateVariation) > 10 ? 'critical' : Math.abs(exchangeRateVariation) > 5 ? 'warning' : 'info'
    };
  }, [datos_actuales, exchangeRateVariation]);

  if (!datos_actuales) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">No hay datos suficientes para realizar simulaciones.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5" />
            Configuración del Escenario
          </CardTitle>
          <CardDescription>
            Ajuste la variación proyectada del tipo de cambio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="variation-slider">Variación del T/C (%)</Label>
              <Badge variant={exchangeRateVariation > 0 ? 'destructive' : exchangeRateVariation < 0 ? 'default' : 'secondary'}>
                {exchangeRateVariation > 0 ? '+' : ''}{exchangeRateVariation}%
              </Badge>
            </div>
            <Slider
              id="variation-slider"
              min={-20}
              max={20}
              step={0.5}
              value={[exchangeRateVariation]}
              onValueChange={(vals) => setExchangeRateVariation(vals[0])}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>-20% (Apreciación)</span>
              <span>0% (Base)</span>
              <span>+20% (Depreciación)</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label>Entrada Directa</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={exchangeRateVariation}
                onChange={(e) => setExchangeRateVariation(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">% de variación</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Impacto Proyectado
          </CardTitle>
          <CardDescription>
            Resultados estimados bajo el escenario configurado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {simulatedData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">Margen Real Est.</div>
                  <div className={`text-2xl font-bold ${simulatedData.margenReal < 0 ? 'text-destructive' : 'text-primary'}`}>
                    {simulatedData.margenReal.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Base: {datos_actuales.margen_real_vs_nominal.margen_real.toFixed(2)}%
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">Diferencial Est.</div>
                  <div className={`text-2xl font-bold ${simulatedData.diferencial < 0 ? 'text-destructive' : 'text-green-600'}`}>
                    ${Math.abs(simulatedData.diferencial).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Base: ${Math.abs(datos_actuales.diferencial_cambiario_acumulado.ytd).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border flex gap-3 ${
                simulatedData.severity === 'critical' ? 'bg-red-50 border-red-200' :
                simulatedData.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                {simulatedData.severity === 'info' ? (
                  <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                ) : (
                  <AlertTriangle className={`h-5 w-5 shrink-0 ${
                    simulatedData.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
                  }`} />
                )}
                <div>
                  <div className={`text-sm font-semibold ${
                    simulatedData.severity === 'critical' ? 'text-red-900' :
                    simulatedData.severity === 'warning' ? 'text-yellow-900' :
                    'text-blue-900'
                  }`}>
                    {simulatedData.severity === 'critical' ? 'Riesgo Crítico' :
                     simulatedData.severity === 'warning' ? 'Advertencia de Riesgo' :
                     'Escenario Controlado'}
                  </div>
                  <p className={`text-xs mt-1 ${
                    simulatedData.severity === 'critical' ? 'text-red-700' :
                    simulatedData.severity === 'warning' ? 'text-yellow-700' :
                    'text-blue-700'
                  }`}>
                    {exchangeRateVariation > 10 
                      ? 'Una depreciación superior al 10% compromete seriamente los márgenes operativos actuales.' 
                      : exchangeRateVariation > 5
                      ? 'Se observa una erosión moderada de márgenes. Considere estrategias de cobertura.'
                      : exchangeRateVariation < -5
                      ? 'Una apreciación del peso mejora significativamente los costos de reposición.'
                      : 'Las variaciones se mantienen dentro de los rangos de tolerancia establecidos.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScenarioSimulator;
