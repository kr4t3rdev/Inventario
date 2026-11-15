# Analytics de Comportamiento de Compra

RFM, CLV, Basket Analysis, Churn Prediction y Cohort Analysis para entender el comportamiento de los clientes.

## Visión General

El módulo de analytics proporciona métricas avanzadas sobre el comportamiento de compra de los clientes. Los cálculos pesados se ejecutan en un job nocturno para no afectar el rendimiento del checkout. Los resultados se almacenan en modelos denormalizados para consultas rápidas.

## Modelo de Datos

### Cliente Analytics

```prisma
model ClienteAnalytics {
  analyticsId          String   @id @default(cuid())
  tenantId             String
  clienteId            String   @unique
  // RFM
  ultimaCompra         DateTime?
  diasDesdeUltima      Int?
  totalCompras         Int      @default(0)
  totalGastado         Int      @default(0)     // Centavos
  ticketPromedio       Int?     // Centavos
  // Segmentación automática
  segmentoRfm          String?  // "Champion", "Loyal", "At Risk", "Lost", "New", "Regular"
  scoreLealtad         Int?     // 1-100
  // CLV
  clv                  Float?   // Valor de vida calculado
  clvProyectado        Float?   // Proyección a 12 meses
  // Categorías preferidas
  categoriasFrecuentes Json?   // [{ categoriaId, count, porcentaje }]
  productosFrecuentes  Json?   // [{ productoId, count, porcentaje }]
  // Canales
  canalPreferido       String?  // "POS", "Web", "App"
  // Churn
  probabilidadChurn    Float?   // 0-1
  senalesChurn         Json?    // [{ senal, severidad }]
  // Cohorte
  cohorteAdquisicion   String?  // "2026-Q1", "2026-Q2"
  diasHastaSegunda     Int?
  // KPIs
  repeatPurchaseRate   Float?
  redemptionRate       Float?
  updatedAt            DateTime @updatedAt
}
```

### Basket Analysis

```prisma
model BasketAnalysis {
  basketId            String   @id @default(cuid())
  tenantId            String
  productoA           String
  productoB           String
  coocurrencias       Int      @default(0)
  soporte             Float    // Support
  confianza           Float    // Confidence
  levantamiento       Float    // Lift
  updatedAt           DateTime @updatedAt
  @@unique([tenantId, productoA, productoB])
}
```

### Cohorte Analytics

```prisma
model CohorteAnalytics {
  cohorteId           String   @id @default(cuid())
  tenantId            String
  periodo             String   // "2026-Q1", "2026-01"
  canalAdquisicion    String?
  totalClientes       Int      @default(0)
  retencionMes1       Float?
  retencionMes2       Float?
  retencionMes3       Float?
  ltvPromedio         Float?
  aovPromedio         Float?
  diasHastaSegunda    Float?
  churnRate           Float?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  @@unique([tenantId, periodo, canalAdquisicion])
}
```

## RFM (Recency, Frequency, Monetary)

El algoritmo RFM clasifica los clientes según tres dimensiones:

| Dimensión | Qué mide | Mejor valor |
|-----------|----------|-------------|
| **Recencia** | Días desde la última compra | Menor (compró recientemente) |
| **Frecuencia** | Número total de compras | Mayor (compra seguido) |
| **Monetario** | Total gastado | Mayor (gasta más) |

### Segmentos RFM

| Segmento | Criterio | Estrategia |
|----------|----------|------------|
| **Champion** | Recencia ≤ 30, Frecuencia ≥ 5, Monetario ≥ $500 | Premiar y fidelizar |
| **Loyal** | Recencia ≤ 60, Frecuencia ≥ 3 | Mantener engagement |
| **At Risk** | Recencia > 90, Frecuencia ≥ 2 | Re-engagement urgente |
| **Lost** | Recencia > 180 | Intentar recuperar o archivar |
| **New** | Frecuencia = 1, Recencia ≤ 30 | Onboarding y segunda compra |
| **Regular** | Resto | Mejorar frecuencia |

### Servicio

```typescript
export function calcularSegmentoRFM(params: {
  recencia: number;    // días desde última compra
  frecuencia: number;  // total de compras
  monetario: number;   // total gastado en centavos
}): string

export function calcularScoreLealtad(params: {
  recencia: number;
  frecuencia: number;
  monetario: number;
}): number  // 1-100
```

### Ejemplo

```typescript
import { calcularSegmentoRFM } from '@/features/cliente-analytics/services/rfm-calculator';

const segmento = calcularSegmentoRFM({
  recencia: 15,     // Compró hace 15 días
  frecuencia: 8,    // 8 compras totales
  monetario: 120000, // $1,200 gastado
});
// Resultado: "Champion"
```

## CLV (Customer Lifetime Value)

El CLV estima el valor total que un cliente generará durante su relación con la empresa.

### Fórmula

```
CLV = Ticket Promedio × Frecuencia × Vida Promedio (años)
```

### Servicio

```typescript
export function calcularCLV(params: {
  ticketPromedio: number;    // Centavos
  frecuenciaAnual: number;   // Compras por año
  vidaPromedioAnios: number; // Años de relación esperada
  margenBruto?: number;      // Margen como decimal (0.3 = 30%)
}): { clv: number; clvProyectado: number }
```

### Ejemplo

```typescript
import { calcularCLV } from '@/features/cliente-analytics/services/clv-calculator';

const resultado = calcularCLV({
  ticketPromedio: 50000,    // $500 promedio
  frecuenciaAnual: 12,      // 12 compras al año
  vidaPromedioAnios: 3,     // 3 años esperados
  margenBruto: 0.3,         // 30% margen
});
// { clv: 1800000, clvProyectado: 1800000 }
// CLV: $18,000 (con margen: $5,400 de ganancia)
```

## Basket Analysis (Market Basket)

Identifica productos que se compran juntos usando el algoritmo Apriori para reglas de asociación.

### Métricas

| Métrica | Fórmula | Significado |
|---------|---------|-------------|
| **Soporte (Support)** | Frecuencia(A ∩ B) / Total transacciones | Qué tan común es la combinación |
| **Confianza (Confidence)** | Frecuencia(A ∩ B) / Frecuencia(A) | Si compran A, ¿qué probabilidad de comprar B? |
| **Levantamiento (Lift)** | Confianza / Soporte(B) | Si > 1, hay correlación positiva |

### Servicio

```typescript
export function calcularBasketAnalysis(params: {
  transacciones: { productoIds: string[] }[];
  minSoporte?: number;   // Default: 0.01
  minConfianza?: number; // Default: 0.1
}): BasketRule[]

interface BasketRule {
  productoA: string;
  productoB: string;
  coocurrencias: number;
  soporte: number;
  confianza: number;
  levantamiento: number;
}
```

### Ejemplo de uso

```typescript
// Reglas encontradas:
// - Quien compra "Cerveza" tiene 65% de probabilidad de comprar "Papas fritas" (Lift: 2.3)
// - Quien compra "Leche" tiene 40% de probabilidad de comprar "Pan" (Lift: 1.8)

// Uso para cross-sell:
// "Los clientes que compraron X también compraron Y"
```

## Churn Prediction

Detecta señales de abandono basándose en patrones de comportamiento.

### Señales de Churn

| Señal | Severidad | Descripción |
|-------|-----------|-------------|
| `disminucion_frecuencia` | Alta | Las compras se han espaciado significativamente |
| `aov_en_caída` | Media | El ticket promedio está disminuyendo |
| `sin_compra_90_dias` | Alta | No ha comprado en 90 días |
| `sin_compra_60_dias` | Media | No ha comprado en 60 días |
| `puntos_no_canjeados` | Baja | Tiene puntos pero no los usa |
| `tier_degradado` | Media | Bajó de tier en el último periodo |

### Servicio

```typescript
export function detectarSenalesChurn(params: {
  cliente: any;
  ventasRecientes: any[];
  analytics: ClienteAnalytics;
  diasActual: number;
}): {
  probabilidadChurn: number;  // 0-1
  senales: { senal: string; severidad: string }[];
}
```

## Cohort Analysis

Analiza la retención de clientes por cohorte de adquisición.

### Servicio

```typescript
export function calcularCohortes(params: {
  clientes: any[];
  ventas: any[];
  periodos: string[]; // ["2026-Q1", "2026-Q2", ...]
}): CohorteAnalytics[]
```

## Job Nocturno

El job `analytics-nightly-job.ts` se ejecuta diariamente para:

1. Actualizar RFM de todos los clientes activos
2. Calcular CLV y proyección
3. Ejecutar basket analysis incremental
4. Actualizar cohortes
5. Detectar señales de churn
6. Actualizar segmentación automática

### Ejecución

```typescript
import { analyticsNightlyJob } from '@/features/cliente-analytics/jobs/analytics-nightly-job';

// Ejecutar manualmente
await analyticsNightlyJob({ tenantId: 'tenant123' });

// O configurar como cron job
// 0 2 * * *  (2:00 AM diario)
```

## Server Actions

| Action | Descripción |
|--------|-------------|
| `getClienteAnalyticsAction` | Obtiene analytics de un cliente |
| `getRFMDistributionAction` | Distribución de clientes por segmento RFM |
| `getTopClientesAction` | Top N clientes por CLV |
| `getBasketRulesAction` | Reglas de basket analysis |
| `getChurnRiskAction` | Clientes en riesgo de churn |
| `getCohortesAction` | Analytics por cohorte |

## Consideraciones

- **Performance**: Los cálculos son pesados; siempre usar el job nocturno, no calcular en tiempo real
- **Denormalización**: Los resultados se almacenan en `ClienteAnalytics` para consultas rápidas
- **Tenant isolation**: Todos los queries filtran por `tenantId`
- **Frecuencia**: El job nocturno es suficiente para la mayoría de casos; no ejecutar más de una vez al día
