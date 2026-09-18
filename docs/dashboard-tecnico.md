# Documentación Técnica del Dashboard de Inteligencia Cambiaria

## Arquitectura del Dashboard

### Visión General

El Dashboard de Inteligencia Cambiaria es un módulo integral de análisis financiero que proporciona insights en tiempo real sobre el impacto de las fluctuaciones cambiarias en el negocio. Está construido siguiendo una arquitectura modular y escalable.

### Arquitectura Técnica

#### Stack Tecnológico

- **Frontend**: Next.js 15 con TypeScript
- **Backend**: APIs RESTful en Next.js
- **Base de Datos**: PostgreSQL con Prisma ORM
- **Estado**: Redux Toolkit + RTK Query
- **Gráficos**: Recharts
- **UI**: Radix UI + Tailwind CSS
- **Testing**: Vitest + React Testing Library

#### Estructura de Componentes

```
ExchangeIntelligenceDashboard (contenedor principal)
├── CostImpactSection
│   ├── Gráfico de línea de tiempo
│   ├── Filtros (categoría, almacén, proveedor)
│   └── Alertas de incremento de costos
├── DebtExposureSection
│   ├── Gráfico de barras comparativo
│   ├── Tabla de desglose por moneda
│   └── Alertas de pérdida no realizada
├── PaymentEfficiencySection
│   ├── Tabla comparativa de tasas
│   ├── Cálculo de spread bancario
│   └── Recomendaciones de eficiencia
├── KPIDashboard
│   ├── Tarjeta Tasa de Equilibrio
│   ├── Tarjeta Margen Real vs Nominal
│   ├── Tarjeta Diferencial Cambiario
│   └── Tarjeta Envejecimiento de Deuda
└── ScenarioSimulator
    ├── Sliders de ajuste de tasas
    ├── Gráfico de utilidad proyectada
    └── Guardado de escenarios
```

#### Arquitectura de Estado

```typescript
interface ExchangeIntelligenceState {
  costImpact: CostImpactData;
  debtExposure: DebtExposureData;
  paymentEfficiency: PaymentEfficiencyData;
  kpis: KPIData;
  alerts: Alert[];
  filters: GlobalFilters;
  thresholds: CustomThresholds;
  scenarios: Scenario[];
}
```

## APIs y Endpoints

### Endpoints Principales

#### Cost Impact

- **GET** `/api/contabilidad/exchange/cost-impact`
- **Parámetros**: fechas, filtros (categoría, almacén, proveedor)
- **Respuesta**: timeline de costos históricos vs reposición, alertas

#### Debt Exposure

- **GET** `/api/contabilidad/exchange/debt-exposure`
- **Parámetros**: fecha de corte
- **Respuesta**: desglose de deudas por moneda, pérdida no realizada, antigüedad

#### Payment Efficiency

- **GET** `/api/contabilidad/exchange/payment-efficiency`
- **Parámetros**: fechas, moneda opcional
- **Respuesta**: transacciones con spread bancario, métricas de eficiencia

#### KPIs

- **GET** `/api/contabilidad/exchange/kpis`
- **Respuesta**: tasa de equilibrio, márgenes, diferencial cambiario, priorización de deudas

#### Scenario Simulation

- **POST** `/api/contabilidad/exchange/simulate-scenario`
- **Parámetros**: tasas simuladas
- **Respuesta**: KPIs recalculados, utilidad proyectada

### Endpoints de Soporte

#### Alert History

- **GET** `/api/contabilidad/exchange/alert-history`
- **POST** `/api/contabilidad/exchange/alert-history`
- Gestión del historial de alertas

#### Report History

- **GET** `/api/contabilidad/exchange/report-history`
- Historial de reportes generados

#### Scheduled Reports

- **GET** `/api/contabilidad/exchange/scheduled-reports`
- **POST** `/api/contabilidad/exchange/scheduled-reports`
- Configuración de reportes automáticos

## Algoritmos de Cálculo

### Servicio ExchangeIntelligenceService

#### calculate_cost_impact()

```typescript
calculate_cost_impact(products: Product[], exchangeRates: ExchangeRate[], dateRange: DateRange): CostImpactResult {
  // 1. Calcular costo histórico promedio
  const historicalCost = products.reduce((sum, product) => {
    const purchases = product.purchases.filter(p => p.date >= dateRange.start && p.date <= dateRange.end);
    const avgCost = purchases.reduce((sum, p) => sum + p.cost, 0) / purchases.length;
    return sum + (avgCost * product.stock);
  }, 0);

  // 2. Calcular costo de reposición con tasas actuales
  const replacementCost = products.reduce((sum, product) => {
    const currentRate = exchangeRates.find(r => r.currency === product.currency)?.rate || 1;
    return sum + (product.cost * currentRate * product.stock);
  }, 0);

  // 3. Calcular diferencia porcentual
  const difference = ((replacementCost - historicalCost) / historicalCost) * 100;

  return { historicalCost, replacementCost, difference };
}
```

#### calculate_debt_exposure()

```typescript
calculate_debt_exposure(debts: Debt[], exchangeRates: ExchangeRate[], currentDate: Date): DebtExposureResult {
  const exposure = debts.reduce((acc, debt) => {
    const originalAmount = debt.amount;
    const currentRate = exchangeRates.find(r => r.currency === debt.currency)?.rate || 1;
    const currentAmount = originalAmount * currentRate;
    const unrealizedLoss = currentAmount - originalAmount;

    acc.totalOriginal += originalAmount;
    acc.totalCurrent += currentAmount;
    acc.totalLoss += unrealizedLoss;

    // Desglose por moneda
    if (!acc.byCurrency[debt.currency]) {
      acc.byCurrency[debt.currency] = { original: 0, current: 0, loss: 0 };
    }
    acc.byCurrency[debt.currency].original += originalAmount;
    acc.byCurrency[debt.currency].current += currentAmount;
    acc.byCurrency[debt.currency].loss += unrealizedLoss;

    return acc;
  }, { totalOriginal: 0, totalCurrent: 0, totalLoss: 0, byCurrency: {} });

  return exposure;
}
```

#### calculate_payment_efficiency()

```typescript
calculate_payment_efficiency(transactions: Transaction[], officialRates: ExchangeRate[]): PaymentEfficiencyResult {
  const spreads = transactions.map(tx => {
    const officialRate = officialRates.find(r => r.currency === tx.currency && r.date === tx.date)?.rate || 1;
    const spread = ((tx.actualRate - officialRate) / officialRate) * 100;
    return { ...tx, spread, officialRate };
  });

  const weightedAvgSpread = spreads.reduce((sum, tx) => sum + (tx.spread * tx.amount), 0) /
                           spreads.reduce((sum, tx) => sum + tx.amount, 0);

  return { transactions: spreads, averageSpread: weightedAvgSpread };
}
```

### Cálculos de KPIs

#### Tasa de Equilibrio

```typescript
calculate_break_even_rate(product: Product, exchangeRates: ExchangeRate[]): number {
  const cost = product.cost;
  const price = product.price;
  const margin = price - cost;

  // Tasa que haría que el costo ajustado = precio
  return price / cost;
}
```

#### Margen Real vs Nominal

```typescript
calculate_real_margin(product: Product, currentRate: number): MarginResult {
  const nominalMargin = product.price - product.cost;
  const adjustedCost = product.cost * currentRate;
  const realMargin = product.price - adjustedCost;
  const difference = realMargin - nominalMargin;

  return { nominal: nominalMargin, real: realMargin, difference };
}
```

## Estructura de Datos

### Tipos TypeScript Principales

```typescript
interface CostImpactData {
  timeline: {
    date: string;
    historicalCost: number;
    replacementCost: number;
  }[];
  alerts: Alert[];
  summary: {
    totalDifference: number;
    percentageChange: number;
  };
}

interface DebtExposureData {
  totalOriginal: number;
  totalCurrent: number;
  totalLoss: number;
  byCurrency: Record<string, {
    original: number;
    current: number;
    loss: number;
    aging: number; // días
    trend: 'up' | 'down' | 'stable';
  }>;
  alerts: Alert[];
}

interface PaymentEfficiencyData {
  transactions: {
    id: string;
    date: Date;
    currency: string;
    officialRate: number;
    actualRate: number;
    spread: number;
    amount: number;
  }[];
  averageSpread: number;
  recommendation: string;
}

interface KPIData {
  breakEvenRate: {
    rate: number;
    vulnerableProducts: Product[];
    classification: 'safe' | 'warning' | 'critical';
  };
  marginAnalysis: {
    nominalMargin: number;
    realMargin: number;
    difference: number;
    trend: number[];
  };
  exchangeDifferential: {
    accumulated: number;
    monthlyBreakdown: Record<string, number>;
    yearOverYear: number;
  };
  debtAging: {
    prioritizedDebts: Debt[];
    score: number;
    impact: number;
  };
}

interface Alert {
  id: string;
  type: 'cost_increase' | 'unrealized_loss' | 'spread' | 'break_even' | 'margin' | 'differential' | 'debt_trend';
  severity: 'low' | 'medium' | 'high';
  message: string;
  threshold: number;
  currentValue: number;
  recommendation?: string;
}
```

### Modelo de Base de Datos (Prisma)

```prisma
model AlertHistory {
  id          String   @id @default(cuid())
  type        String
  severity    String
  message     String
  threshold   Float
  currentValue Float
  createdAt   DateTime @default(now())
  resolvedAt  DateTime?
  userId      String?
}

model ReportHistory {
  id        String   @id @default(cuid())
  type      String
  format    String   // 'pdf' | 'csv' | 'excel'
  data      Json
  createdAt DateTime @default(now())
  userId    String?
}

model ScenarioSimulation {
  id          String   @id @default(cuid())
  name        String
  description String?
  rates       Json     // { currency: rate }
  results     Json     // KPIs calculados
  createdAt   DateTime @default(now())
  userId      String?
}

model ScheduledReport {
  id         String   @id @default(cuid())
  name       String
  frequency  String   // 'weekly' | 'monthly'
  format     String
  recipients String[] // emails
  lastRun    DateTime?
  nextRun    DateTime
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
}
```

## Guía de Troubleshooting

### Problemas Comunes

#### 1. Tasas de Cambio No Actualizadas
**Síntomas**: KPIs muestran valores incorrectos, alertas no se generan.
**Causa**: API externa de tasas no responde o datos corruptos.
**Solución**:

1. Verificar conectividad con fuente de tasas
2. Revisar logs de error en `/api/contabilidad/exchange/convertir`
3. Usar tasas manuales como fallback
4. Configurar cache local de tasas

#### 2. Cálculos de Costo Impact Incorrectos
**Síntomas**: Diferencia porcentual no coincide con expectativas.
**Causa**: Datos de compras históricos incompletos o incorrectos.
**Solución**:

1. Verificar integridad de datos en tabla `GastoCompra`
2. Revisar filtros aplicados (fechas, categorías)
3. Validar cálculos manualmente con datos de muestra
4. Usar property tests para validar algoritmo

#### 3. Alertas No Se Generan
**Síntomas**: Umbrales configurados pero no hay alertas activas.
**Causa**: Umbrales personalizados fuera de rango o lógica de evaluación incorrecta.
**Solución**:

1. Revisar configuración de umbrales en Redux state
2. Verificar que `generate_alerts()` se ejecuta correctamente
3. Probar con umbrales por defecto
4. Revisar logs de generación de alertas

#### 4. Performance Degradada
**Síntomas**: Dashboard lento al cargar, recálculos tardan mucho.
**Causa**: Datasets grandes sin optimización o queries N+1.
**Solución**:

1. Implementar paginación en queries grandes
2. Usar `React.memo` y `useMemo` en componentes
3. Configurar cache apropiado (1h para tasas, 5min para KPIs)
4. Optimizar queries de Prisma con `include` y `select`

#### 5. Errores de Validación
**Síntomas**: Formularios no aceptan datos, APIs retornan 400.
**Causa**: Datos de entrada no cumplen esquemas de validación.
**Solución**:

1. Revisar esquemas Zod en endpoints
2. Validar formato de fechas (ISO 8601)
3. Verificar rangos de valores numéricos
4. Usar herramientas de debugging para inspeccionar payloads

### Herramientas de Diagnóstico

#### Logs

- Errores de API: Revisar `console.error` en endpoints
- Errores de frontend: Usar React DevTools + Redux DevTools
- Errores de base de datos: Logs de Prisma en desarrollo

#### Tests

- Ejecutar `pnpm test` para validar lógica
- Usar property tests para casos edge
- Integration tests para flujos completos

#### Monitoreo

- Configurar alertas de error en producción
- Monitorear tiempos de respuesta de APIs
- Trackear uso de features con analytics

### Contacto para Soporte
Para issues críticos o bugs no resueltos, contactar al equipo de desarrollo con:

- Descripción detallada del problema
- Pasos para reproducir
- Logs de error relevantes
- Versión del sistema y navegador