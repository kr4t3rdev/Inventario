# Exchange Intelligence Dashboard - Testing Infrastructure

Este directorio contiene la infraestructura de testing para el Dashboard de Inteligencia Cambiaria, incluyendo configuración de property-based testing con fast-check y utilidades de testing.

## Archivos

### `pbt-config.ts`

Configuración y arbitraries (generadores de datos aleatorios) para property-based testing con fast-check.

#### Configuraciones Disponibles

```typescript
import { DEFAULT_PBT_CONFIG, PERFORMANCE_PBT_CONFIG, EXHAUSTIVE_PBT_CONFIG } from '@/lib/testing'

// Configuración por defecto (100 iteraciones)
fc.assert(fc.property(arbitrary, predicate), DEFAULT_PBT_CONFIG)

// Configuración de performance (50 iteraciones)
fc.assert(fc.property(arbitrary, predicate), PERFORMANCE_PBT_CONFIG)

// Configuración exhaustiva (500 iteraciones)
fc.assert(fc.property(arbitrary, predicate), EXHAUSTIVE_PBT_CONFIG)
```

#### Arbitraries Básicos

- `fecha_arbitrary`: Genera fechas válidas en formato ISO
- `date_range_arbitrary`: Genera rangos de fechas válidos
- `moneda_arbitrary`: Genera códigos de moneda válidos
- `tasa_cambio_arbitrary`: Genera tasas de cambio realistas
- `monto_arbitrary`: Genera montos monetarios positivos
- `porcentaje_arbitrary`: Genera porcentajes (0-100)
- `cantidad_arbitrary`: Genera cantidades enteras positivas
- `id_arbitrary`: Genera IDs únicos (UUID)

#### Arbitraries Compuestos

- `tasas_simuladas_arbitrary`: Tasas para múltiples monedas
- `producto_con_historial_arbitrary`: Producto con historial de compras
- `deuda_con_historial_arbitrary`: Deuda con historial de tasas
- `transaccion_cambio_arbitrary`: Transacción de cambio
- `filtros_dashboard_arbitrary`: Filtros de dashboard válidos

#### Arbitraries Especializados

- `inventario_dataset_arbitrary`: Dataset completo de inventario
- `tasas_actuales_arbitrary`: Tasas actuales por moneda
- `deudas_activas_arbitrary`: Conjunto de deudas activas
- `transacciones_cambio_arbitrary`: Conjunto de transacciones
- `umbrales_personalizados_arbitrary`: Umbrales personalizados válidos

#### Helpers de Umbrales

```typescript
import { near_threshold_arbitrary, above_threshold_arbitrary, below_threshold_arbitrary } from '@/lib/testing'

// Genera valores cerca de un umbral (útil para testing de alertas)
const near_10 = near_threshold_arbitrary(10, 2) // 8-12

// Genera valores que superan un umbral
const above_10 = above_threshold_arbitrary(10, 5) // 10.01-15

// Genera valores por debajo de un umbral
const below_10 = below_threshold_arbitrary(10, 5) // 5-9.99
```

### `test-helpers.ts`

Funciones auxiliares para testing, incluyendo validación, cálculos, generación de datos mock y assertions.

#### Validación de Datos

```typescript
import { 
  is_valid_positive_number,
  is_valid_iso_date,
  is_valid_date_range,
  is_valid_percentage,
  is_valid_exchange_rate 
} from '@/lib/testing'

// Validar números positivos
is_valid_positive_number(100) // true
is_valid_positive_number(-10) // false

// Validar fechas
is_valid_iso_date('2024-01-15') // true
is_valid_iso_date('invalid') // false

// Validar rangos de fechas
is_valid_date_range('2024-01-01', '2024-12-31') // true
is_valid_date_range('2024-12-31', '2024-01-01') // false
```

#### Cálculos

```typescript
import {
  calculate_percentage_difference,
  calculate_weighted_average,
  calculate_days_between,
  round_to_decimals
} from '@/lib/testing'

// Calcular diferencia porcentual
calculate_percentage_difference(100, 110) // 10

// Calcular promedio ponderado
calculate_weighted_average([10, 20, 30], [1, 2, 3]) // 23.33

// Calcular días entre fechas
calculate_days_between('2024-01-01', '2024-01-31') // 30

// Redondear a N decimales
round_to_decimals(3.14159, 2) // 3.14
```

#### Generación de Datos Mock

```typescript
import {
  create_mock_cost_impact_data,
  create_mock_debt_exposure_data,
  create_mock_payment_efficiency_data,
  create_mock_kpi_data,
  create_mock_alerta
} from '@/lib/testing'

// Generar datos mock con valores por defecto
const cost_data = create_mock_cost_impact_data()

// Generar datos mock con overrides
const debt_data = create_mock_debt_exposure_data({
  perdida_no_realizada: 100000,
  perdida_porcentual: 20
})
```

#### Assertions Personalizadas

```typescript
import {
  assert_all,
  assert_in_range,
  assert_approximately_equal,
  assert_sorted
} from '@/lib/testing'

// Verificar que todos los elementos cumplan una condición
assert_all(numbers, n => n > 0, 'All numbers must be positive')

// Verificar que un valor esté en rango
assert_in_range(value, 0, 100, 'Value must be between 0 and 100')

// Verificar igualdad aproximada
assert_approximately_equal(3.14159, 3.14, 0.01)

// Verificar que un array esté ordenado
assert_sorted(items, (a, b) => a.priority - b.priority)
```

#### Clasificación

```typescript
import { classify_currency_trend, classify_product_status } from '@/lib/testing'

// Clasificar tendencia de moneda
classify_currency_trend(5) // 'alcista'
classify_currency_trend(-5) // 'bajista'
classify_currency_trend(1) // 'estable'

// Clasificar estado de producto
classify_product_status(95) // 'advertencia'
classify_product_status(105) // 'critico'
classify_product_status(80) // 'seguro'
```

## Uso en Tests

### Property-Based Test Básico

```typescript
import { describe, it } from 'vitest'
import { fc, run_property_test, monto_arbitrary } from '@/lib/testing'

describe('Cost Calculations', () => {
  it('should always produce positive costs', () => {
    run_property_test(
      monto_arbitrary,
      (monto) => {
        const result = calculate_cost(monto)
        return result >= 0
      }
    )
  })
})
```

### Property-Based Test con Múltiples Arbitraries

```typescript
import { describe, it } from 'vitest'
import { fc, inventario_dataset_arbitrary, tasas_actuales_arbitrary } from '@/lib/testing'

describe('Inventory Impact', () => {
  it('replacement cost should be proportional to rate changes', () => {
    fc.assert(
      fc.property(
        inventario_dataset_arbitrary,
        tasas_actuales_arbitrary,
        (inventory, rates) => {
          const result = calculate_cost_impact(inventory, rates)
          return result.costo_reposicion >= result.costo_historico
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### Unit Test con Mock Data

```typescript
import { describe, it, expect } from 'vitest'
import { create_mock_cost_impact_data } from '@/lib/testing'

describe('CostImpactSection', () => {
  it('should render correctly with data', () => {
    const data = create_mock_cost_impact_data({
      resumen: {
        incremento_promedio: 15,
        productos_afectados: 100,
        alerta_ajuste_precios: true,
        costo_historico_total: 500000,
        costo_reposicion_total: 575000,
      }
    })
    
    const component = render(<CostImpactSection data={data} />)
    expect(component.getByText('15%')).toBeInTheDocument()
  })
})
```

### Test con Assertions Personalizadas

```typescript
import { describe, it } from 'vitest'
import { assert_all, assert_sorted, is_valid_positive_number } from '@/lib/testing'

describe('Debt Priority Calculation', () => {
  it('should produce valid priority scores', () => {
    const debts = calculate_debt_priorities(mock_debts)
    
    // Verificar que todos los scores sean válidos
    assert_all(debts, d => is_valid_positive_number(d.prioridad))
    
    // Verificar que estén ordenados por prioridad
    assert_sorted(debts, (a, b) => b.prioridad - a.prioridad)
  })
})
```

## Mejores Prácticas

### 1. Usar Property-Based Testing para Propiedades Universales

```typescript
// ✅ BIEN: Testing de propiedad universal
it('cost impact percentage should match manual calculation', () => {
  fc.assert(
    fc.property(
      monto_arbitrary,
      monto_arbitrary,
      (historical, replacement) => {
        const result = calculate_impact(historical, replacement)
        const expected = ((replacement - historical) / historical) * 100
        return Math.abs(result - expected) < 0.01
      }
    )
  )
})

// ❌ MAL: Testing de ejemplo específico con PBT
it('should calculate 10% increase correctly', () => {
  fc.assert(
    fc.property(fc.constant(100), fc.constant(110), (h, r) => {
      return calculate_impact(h, r) === 10
    })
  )
})
```

### 2. Usar Unit Tests para Casos Específicos y Edge Cases

```typescript
// ✅ BIEN: Unit test para edge case específico
it('should handle zero historical cost', () => {
  const result = calculate_impact(0, 100)
  expect(result).toBe(Infinity)
})

// ✅ BIEN: Unit test para ejemplo específico
it('should calculate 10% increase correctly', () => {
  const result = calculate_impact(100, 110)
  expect(result).toBe(10)
})
```

### 3. Combinar Ambos Enfoques

```typescript
describe('Cost Impact Calculation', () => {
  // Property test para comportamiento general
  it('should always produce finite results for positive inputs', () => {
    fc.assert(
      fc.property(
        monto_arbitrary,
        monto_arbitrary,
        (h, r) => {
          const result = calculate_impact(h, r)
          return isFinite(result)
        }
      )
    )
  })
  
  // Unit tests para casos específicos
  it('should handle zero historical cost', () => {
    expect(calculate_impact(0, 100)).toBe(Infinity)
  })
  
  it('should handle equal costs', () => {
    expect(calculate_impact(100, 100)).toBe(0)
  })
})
```

### 4. Usar Shrinking Inteligente

```typescript
import { monto_with_smart_shrinking, tasa_with_smart_shrinking } from '@/lib/testing'

// Los arbitraries con smart shrinking reducen a valores "redondos"
// más fáciles de debuggear cuando un test falla
it('should handle all valid amounts', () => {
  fc.assert(
    fc.property(
      monto_with_smart_shrinking,
      tasa_with_smart_shrinking,
      (amount, rate) => {
        // Si falla, fast-check reducirá a valores como 100.00 y 20.0000
        // en lugar de 99.87234 y 19.9823
        return calculate(amount, rate) >= 0
      }
    )
  )
})
```

## Configuración de Vitest

Asegúrese de que su `vitest.config.ts` incluya:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/lib/testing/setup.ts'], // Si necesita setup
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/lib/testing/',
      ],
    },
  },
})
```

## Recursos Adicionales

- [fast-check Documentation](https://fast-check.dev/)
- [Property-Based Testing Guide](https://fast-check.dev/docs/introduction/)
- [Vitest Documentation](https://vitest.dev/)

## Troubleshooting

### Test Falla con Seed Específico

Si un property test falla, fast-check mostrará un seed. Para reproducir:

```typescript
fc.assert(
  fc.property(arbitrary, predicate),
  { 
    ...DEFAULT_PBT_CONFIG,
    seed: 1234567890, // Seed del fallo
    path: "0:1:2" // Path del fallo
  }
)
```

### Test es Muy Lento

Reduzca el número de iteraciones:

```typescript
fc.assert(
  fc.property(arbitrary, predicate),
  { numRuns: 50 } // En lugar de 100
)
```

### Shrinking Produce Valores Inválidos

Use `filter` o `map` para asegurar valores válidos:

```typescript
const valid_rate = tasa_cambio_arbitrary
  .filter(rate => rate > 0 && rate < 1000)
  .map(rate => round_to_decimals(rate, 4))
```
