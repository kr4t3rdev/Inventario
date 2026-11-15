# Dashboard de KPIs de Fidelización

Métricas clave para monitorear la salud del programa de fidelización.

## Visión General

El módulo de dashboard proporciona queries optimizadas para calcular los KPIs principales de fidelización. Estas métricas permiten evaluar el rendimiento del programa de lealtad, detectar problemas tempranos y tomar decisiones basadas en datos.

## KPIs Monitoreados

| Métrica | Qué mide | Fórmula |
|---------|----------|---------|
| **Repeat Purchase Rate** | Frecuencia de recompra | Clientes con ≥2 compras / Total clientes |
| **Customer Lifetime Value (CLV)** | Valor total a largo plazo | Ticket promedio × Frecuencia × Vida promedio |
| **Average Order Value (AOV)** | Ticket promedio | Total ventas / Número de ventas |
| **Redemption Rate** | % de recompensas canjeadas | Puntos canjeados / Puntos emitidos |
| **Breakage** | Puntos emitidos no canjeados (pasivo) | Puntos emitidos - Puntos canjeados |
| **Churn Rate** | % de clientes que dejan de comprar | Clientes inactivos > 90 días / Total clientes |
| **NPS** | Satisfacción del cliente | Promotores - Detractores |

## Server Actions

### KPIs Generales

```typescript
import { getFidelizacionKPIsAction } from '@/features/fidelizacion-dashboard/actions';

const result = await getFidelizacionKPIsAction({
  periodo: 'ultimo_mes', // 'ultima_semana', 'ultimo_mes', 'ultimo_trimestre', 'ultimo_anio'
});

// Resultado:
// {
//   repeatPurchaseRate: 0.35,      // 35% de clientes repiten compra
//   clvPromedio: 150000,           // $1,500 CLV promedio
//   aov: 50000,                    // $500 ticket promedio
//   redemptionRate: 0.25,          // 25% de puntos canjeados
//   breakage: 750000,              // $7,500 en puntos no canjeados
//   churnRate: 0.08,               // 8% de churn
//   totalClientesActivos: 1200,
//   totalPuntosEmitidos: 5000000,
//   totalPuntosCanjeados: 1250000,
// }
```

### Distribución RFM

```typescript
import { getRFMDistributionAction } from '@/features/fidelizacion-dashboard/actions';

const result = await getRFMDistributionAction();

// Resultado:
// {
//   Champion: { count: 150, percentage: 12.5 },
//   Loyal: { count: 200, percentage: 16.7 },
//   At Risk: { count: 100, percentage: 8.3 },
//   Lost: { count: 50, percentage: 4.2 },
//   New: { count: 300, percentage: 25.0 },
//   Regular: { count: 400, percentage: 33.3 },
// }
```

### Distribución de Tiers

```typescript
import { getTierDistributionAction } from '@/features/fidelizacion-dashboard/actions';

const result = await getTierDistributionAction();

// Resultado:
// {
//   tiers: [
//     { nombre: 'Bronce', count: 500, percentage: 41.7 },
//     { nombre: 'Plata', count: 300, percentage: 25.0 },
//     { nombre: 'Oro', count: 200, percentage: 16.7 },
//     { nombre: 'VIP', count: 100, percentage: 8.3 },
//   ]
// }
```

### Tendencia de Churn

```typescript
import { getChurnTrendAction } from '@/features/fidelizacion-dashboard/actions';

const result = await getChurnTrendAction({
  periodos: 6, // Últimos 6 meses
});

// Resultado:
// {
//   trend: [
//     { mes: '2026-06', churnRate: 0.10, clientesPerdidos: 45 },
//     { mes: '2026-07', churnRate: 0.09, clientesPerdidos: 40 },
//     { mes: '2026-08', churnRate: 0.08, clientesPerdidos: 35 },
//     { mes: '2026-09', churnRate: 0.08, clientesPerdidos: 38 },
//     { mes: '2026-10', churnRate: 0.07, clientesPerdidos: 30 },
//     { mes: '2026-11', churnRate: 0.08, clientesPerdidos: 33 },
//   ]
// }
```

### Distribución de CLV

```typescript
import { getCLVDistributionAction } from '@/features/fidelizacion-dashboard/actions';

const result = await getCLVDistributionAction();

// Resultado:
// {
//   buckets: [
//     { rango: '0-50000', count: 400, label: '$0 - $500' },
//     { rango: '50000-150000', count: 350, label: '$500 - $1,500' },
//     { rango: '150000-500000', count: 250, label: '$1,500 - $5,000' },
//     { rango: '500000+', count: 200, label: '$5,000+' },
//   ]
// }
```

### Tendencia de Redención

```typescript
import { getRedemptionTrendAction } from '@/features/fidelizacion-dashboard/actions';

const result = await getRedemptionTrendAction({
  periodos: 12, // Últimos 12 meses
});

// Resultado:
// {
//   trend: [
//     { mes: '2026-01', puntosEmitidos: 300000, puntosCanjeados: 75000, rate: 0.25 },
//     { mes: '2026-02', puntosEmitidos: 320000, puntosCanjeados: 80000, rate: 0.25 },
//     // ...
//   ]
// }
```

## Cómo Integrar en Dashboards

### Ejemplo: Componente de KPI Cards

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getFidelizacionKPIsAction } from '@/features/fidelizacion-dashboard/actions';

export function FidelizacionKPIs() {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFidelizacionKPIsAction({ periodo: 'ultimo_mes' })
      .then((r) => {
        if (r.success) setKpis(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando KPIs...</p>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard title="Repeat Purchase Rate" value={`${(kpis.repeatPurchaseRate * 100).toFixed(1)}%`} />
      <KPICard title="CLV Promedio" value={`$${(kpis.clvPromedio / 100).toFixed(2)}`} />
      <KPICard title="AOV" value={`$${(kpis.aov / 100).toFixed(2)}`} />
      <KPICard title="Churn Rate" value={`${(kpis.churnRate * 100).toFixed(1)}%`} />
    </div>
  );
}
```

### Ejemplo: Gráfico de Distribución RFM

```typescript
import { getRFMDistributionAction } from '@/features/fidelizacion-dashboard/actions';

export function RFMDistributionChart() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getRFMDistributionAction()
      .then((r) => { if (r.success) setData(r.data); });
  }, []);

  // Usar con biblioteca de gráficos (Chart.js, Recharts, etc.)
  // data = { Champion: { count, percentage }, Loyal: { count, percentage }, ... }
}
```

## Benchmarks de Referencia

| KPI | Bueno | Excelente |
|-----|-------|-----------|
| Repeat Purchase Rate | > 30% | > 50% |
| Redemption Rate | 20-30% | 30-40% |
| Breakage | 60-80% | < 60% |
| Churn Rate | < 10% | < 5% |
| CLV/AOV Ratio | > 3x | > 5x |

## Consideraciones

- **Performance**: Las queries están optimizadas con índices en `tenantId`, `segmentoRfm` y `cohorteAdquisicion`
- **Caché**: Considerar cachear los resultados por 1-4 horas para dashboards de alta frecuencia
- **Tenant isolation**: Todas las queries filtran por `tenantId` automáticamente
- **Periodos**: Los periodos soportados son: `ultima_semana`, `ultimo_mes`, `ultimo_trimestre`, `ultimo_anio`
