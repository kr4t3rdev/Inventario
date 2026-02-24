# Exchange Intelligence Dashboard - Type Definitions

Este directorio contiene todas las definiciones de tipos TypeScript para el Dashboard de Inteligencia Cambiaria.

## Archivo Principal

### `exchange-intelligence.ts`

Contiene todas las interfaces y tipos para el sistema de análisis cambiario, organizados en las siguientes secciones:

#### 1. Tipos Base y Enums
- `ProductoEstado`: Estados de productos según proximidad a tasa de equilibrio
- `TendenciaMoneda`: Tendencias de moneda (alcista, bajista, estable)
- `SeveridadAlerta`: Niveles de severidad para alertas
- `TipoAlerta`: Tipos de alertas del sistema

#### 2. Interfaces de Datos por Sección

**Sección A: Impacto en Costos**
- `CostImpactTimelinePoint`: Punto de datos en timeline
- `CostImpactResumen`: Resumen del análisis
- `CostImpactData`: Datos completos de la sección

**Sección B: Exposición de Deuda**
- `DeudaPorMoneda`: Desglose por moneda
- `DeudaDetalle`: Detalle de deuda individual
- `DebtExposureData`: Datos completos de la sección

**Sección C: Eficiencia de Pagos**
- `TransaccionCambio`: Transacción con análisis de spread
- `PaymentEfficiencyMetrics`: Métricas de eficiencia
- `PaymentEfficiencyData`: Datos completos de la sección

#### 3. Interfaces de KPIs
- `TasaEquilibrioKPI`: KPI de tasa de equilibrio
- `MargenRealVsNominalKPI`: KPI de márgenes
- `DiferencialCambiarioKPI`: KPI de diferencial cambiario
- `EnvejecimientoDeudaKPI`: KPI de envejecimiento de deuda
- `KPIData`: Todos los KPIs del dashboard

#### 4. Interfaces de Alertas
- `Alerta`: Alerta del sistema
- `UmbralesPersonalizados`: Configuración de umbrales

#### 5. Interfaces de Simulación
- `TasasSimuladas`: Tasas por moneda
- `SimulationResult`: Resultado de simulación
- `EscenarioGuardado`: Escenario guardado
- `EscenarioPredefinido`: Escenario predefinido

#### 6. Interfaces de Filtros
- `FiltrosDashboard`: Filtros globales
- `OpcionesFiltro`: Opciones disponibles

#### 7. Interfaces de Exportación
- `FormatoExportacion`: Formatos disponibles
- `ConfiguracionExportacion`: Configuración de exportación
- `ReporteExportado`: Reporte generado

#### 8. Interfaces de API
- Request types: `CostImpactRequest`, `DebtExposureRequest`, etc.
- Response types: `CostImpactResponse`, `DebtExposureResponse`, etc.
- `ApiErrorResponse`: Respuesta de error estándar

#### 9. Interfaces de Estado Redux
- `LoadingStates`: Estados de carga por sección
- `ErrorStates`: Estados de error por sección
- `ExchangeIntelligenceState`: Estado completo de Redux

#### 10. Interfaces de Componentes
- Props para todos los componentes principales del dashboard

#### 11. Type Guards
- `is_api_error_response`: Verifica si es error de API
- `is_tendencia_moneda`: Verifica tendencia válida
- `is_producto_estado`: Verifica estado de producto válido
- `is_severidad_alerta`: Verifica severidad de alerta válida

## Uso

### Importar tipos

```typescript
import type {
  CostImpactData,
  DebtExposureData,
  KPIData,
  ExchangeIntelligenceState,
} from '@/types/exchange-intelligence'
```

### Usar type guards

```typescript
import { is_api_error_response } from '@/types/exchange-intelligence'

const response = await fetch('/api/exchange/cost-impact')
const data = await response.json()

if (is_api_error_response(data)) {
  console.error('Error:', data.error.message)
} else {
  console.log('Success:', data.data)
}
```

## Convenciones de Nomenclatura

- **Interfaces**: PascalCase (ej. `CostImpactData`)
- **Tipos**: PascalCase (ej. `TendenciaMoneda`)
- **Propiedades**: snake_case (ej. `fecha_inicio`, `costo_historico`)
- **Funciones**: snake_case (ej. `is_api_error_response`)

## Validación de Tipos

Todos los tipos están diseñados para ser estrictos y seguros. Use los type guards proporcionados para validación en runtime cuando sea necesario.

## Extensibilidad

Para agregar nuevos tipos:

1. Agregar la definición en la sección apropiada de `exchange-intelligence.ts`
2. Documentar con JSDoc
3. Exportar el tipo
4. Actualizar este README si es necesario
5. Agregar type guards si aplica

## Testing

Los tipos están diseñados para trabajar con property-based testing usando fast-check. Ver `src/lib/testing/pbt-config.ts` para arbitraries correspondientes.
