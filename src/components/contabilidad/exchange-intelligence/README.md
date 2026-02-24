# Exchange Intelligence - Treasury Integration

## Descripción

Este módulo proporciona la integración bidireccional entre el Dashboard de Inteligencia Cambiaria y el módulo de Tesorería (gestión de capital y pagos). Permite a los usuarios tomar acciones directas desde el análisis de deudas priorizadas.

## Componentes

### 1. `debt_payment_actions`

Componente que proporciona botones de acción para cada deuda priorizada.

**Características:**
- Botón "Iniciar Pago" con formulario pre-llenado
- Botón "Ver Detalles" con información completa de la deuda
- Botón "Crear Recordatorio" para programar alertas
- Botón "Ir a Módulo de Capital" para navegación directa
- Validación de elegibilidad de pago
- Registro de auditoría de todas las acciones

**Uso:**
```tsx
import { debt_payment_actions } from '@/components/contabilidad/exchange-intelligence'

<debt_payment_actions
  deuda={deuda_priorizada}
  on_payment_success={() => {
    // Callback cuando el pago se registra exitosamente
    refetch_kpis()
  }}
  on_reminder_created={() => {
    // Callback cuando se crea un recordatorio
    show_success_message()
  }}
/>
```

### 2. `debt_aging_table`

Tabla completa de deudas priorizadas con acciones integradas.

**Características:**
- Visualización de todas las deudas activas
- Indicadores de prioridad y tendencia
- Cálculo de impacto proyectado a 30 días
- Acciones integradas para cada deuda
- Resumen de deudas urgentes

**Uso:**
```tsx
import { debt_aging_table } from '@/components/contabilidad/exchange-intelligence'

<debt_aging_table
  deudas={kpi_data.envejecimiento_deuda.deudas_priorizadas}
  loading={is_loading}
  on_payment_success={handle_payment_success}
  on_reminder_created={handle_reminder_created}
/>
```

### 3. `threshold_configuration`

Componente para configurar umbrales personalizados de alertas (ya existente).

## Servicios

### `TreasuryIntegrationService`

Servicio backend que maneja la lógica de integración.

**Métodos principales:**

#### `prepare_payment_form_data(deuda_priorizada)`
Prepara datos para pre-llenar el formulario de pago basándose en el análisis de prioridad.

**Retorna:**
```typescript
{
  deuda_id: string
  entidad: string
  monto_sugerido: number
  moneda: string
  descripcion: string
  observaciones_recomendadas: string
}
```

#### `create_payment_reminder(deuda_id, fecha, usuario_id, mensaje?)`
Crea un recordatorio de pago para una deuda específica.

#### `sync_after_payment(deuda_id, monto_pagado, usuario_id)`
Sincroniza datos después de registrar un pago y actualiza KPIs.

#### `log_action(accion, entidad_tipo, entidad_id, usuario_id, datos_anteriores?, datos_nuevos?)`
Registra acciones en el log de auditoría.

#### `validate_payment_eligibility(deuda_id)`
Valida que una deuda puede ser pagada.

**Uso:**
```typescript
import { treasury_integration_service } from '@/lib/services/treasury_integration_service'

// Preparar datos de pago
const payment_data = await treasury_integration_service.prepare_payment_form_data(deuda)

// Crear recordatorio
await treasury_integration_service.create_payment_reminder(
  deuda_id,
  new Date('2024-12-31'),
  user_id,
  'Recordatorio personalizado'
)

// Sincronizar después de pago
await treasury_integration_service.sync_after_payment(deuda_id, 5000, user_id)
```

## Hooks

### `use_treasury_integration`

Hook personalizado que proporciona funciones y estado para la integración.

**Retorna:**
```typescript
{
  // Estado
  state: {
    is_syncing: boolean
    last_sync: Date | null
    pending_updates: number
    sync_errors: string[]
  }
  
  // Acciones
  navigate_to_payment: (deuda_id: string) => void
  prepare_payment_data: (deuda: DeudaPriorizada) => Promise<PrefilledPaymentData | null>
  sync_after_payment: (deuda_id: string, monto: number) => Promise<boolean>
  create_reminder: (deuda_id: string, fecha: Date, mensaje?: string) => Promise<boolean>
  validate_payment: (deuda_id: string) => Promise<boolean>
  
  // Utilidades
  get_navigation_url: (deuda_id: string) => string
  clear_sync_errors: () => void
}
```

**Uso:**
```typescript
import { use_treasury_integration } from '@/hooks/use-treasury-integration'

function MyComponent() {
  const {
    state,
    navigate_to_payment,
    prepare_payment_data,
    sync_after_payment
  } = use_treasury_integration()

  const handle_pay_debt = async (deuda: DeudaPriorizada) => {
    // Preparar datos
    const payment_data = await prepare_payment_data(deuda)
    
    // Navegar al módulo de pagos
    navigate_to_payment(deuda.deuda_id)
  }

  return (
    <div>
      {state.is_syncing && <p>Sincronizando...</p>}
      {/* ... */}
    </div>
  )
}
```

## Flujo de Integración

### 1. Análisis de Deudas
El dashboard analiza las deudas en moneda extranjera y calcula:
- Prioridad de pago (basada en antigüedad y tendencia de moneda)
- Impacto proyectado a 30 días
- Recomendaciones de pago

### 2. Acciones del Usuario
El usuario puede:
- **Iniciar Pago**: Abre un diálogo con formulario pre-llenado
- **Ver Detalles**: Muestra información completa de la deuda
- **Crear Recordatorio**: Programa una alerta para fecha futura
- **Ir a Módulo**: Navega al módulo de capital con parámetros

### 3. Registro de Pago
Cuando se registra un pago:
1. Se valida la elegibilidad de la deuda
2. Se registra el pago en la base de datos
3. Se actualiza el saldo pendiente
4. Se sincroniza con el dashboard de inteligencia
5. Se invalida el cache de KPIs para recálculo
6. Se registra la acción en auditoría

### 4. Sincronización Bidireccional
- **Dashboard → Tesorería**: Navegación con datos pre-llenados
- **Tesorería → Dashboard**: Actualización automática de KPIs después de pagos
- **Cache Invalidation**: RTK Query invalida automáticamente los datos

### 5. Auditoría
Todas las acciones se registran:
- Navegación al módulo de pagos
- Creación de recordatorios
- Registro de pagos
- Sincronizaciones

## Parámetros de URL

Cuando se navega al módulo de capital, se incluyen estos parámetros:

```
/busy/contabilidad/capital?action=pagar&deuda_id=xxx&source=exchange-intelligence
```

- `action`: Acción a realizar (pagar, ver, editar)
- `deuda_id`: ID de la deuda
- `source`: Origen de la navegación (para tracking)

## Validaciones

### Elegibilidad de Pago
Una deuda es elegible para pago si:
- Existe en la base de datos
- Es de tipo `DEUDA_EXTERNA`
- No está en estado `PAGADA`
- Tiene saldo pendiente > 0

### Validación de Monto
- El monto debe ser mayor a 0
- El monto no puede exceder el saldo pendiente
- Se debe seleccionar una cuenta bancaria válida

### Validación de Recordatorio
- La fecha debe ser futura
- La fecha no puede ser más de 1 año en el futuro

## Recomendaciones de Pago

El sistema genera recomendaciones automáticas basadas en:

1. **Prioridad Crítica (>80%)**
   - "⚠️ PRIORIDAD CRÍTICA: Se recomienda pago inmediato."

2. **Prioridad Alta (>60%)**
   - "⚡ PRIORIDAD ALTA: Considerar pago en los próximos 7 días."

3. **Tendencia Alcista**
   - "📈 Moneda en tendencia alcista (+X% últimos 30 días). Pagar pronto minimiza pérdidas."

4. **Impacto Proyectado**
   - "💰 Impacto proyectado en 30 días: X. Pagar hoy evita este costo adicional."

5. **Antigüedad Alta (>180 días)**
   - "⏰ Deuda con X días de antigüedad. Considerar liquidación."

## Actualización de KPIs

Después de registrar un pago:

1. **Automático**: RTK Query invalida el cache de `InyeccionesCapital`
2. **Recálculo**: Los KPIs se recalculan en la próxima consulta
3. **Notificación**: Se muestra un toast de éxito
4. **Callback**: Se ejecuta `on_payment_success` si está definido

## Ejemplo Completo

```tsx
import { useState } from 'react'
import { debt_aging_table } from '@/components/contabilidad/exchange-intelligence'
import { use_treasury_integration } from '@/hooks/use-treasury-integration'
import { useGetKPIsQuery } from '@/lib/redux/services/exchangeIntelligenceApi'

export function DebtManagementPage() {
  const { data: kpis, isLoading, refetch } = useGetKPIsQuery({
    fecha_inicio: '2024-01-01',
    fecha_fin: '2024-12-31'
  })

  const { state, sync_after_payment } = use_treasury_integration()

  const handle_payment_success = async () => {
    // Sincronizar datos
    await sync_after_payment(deuda_id, monto)
    
    // Refrescar KPIs
    refetch()
  }

  const handle_reminder_created = () => {
    console.log('Recordatorio creado exitosamente')
  }

  return (
    <div className="space-y-6">
      <h1>Gestión de Deudas</h1>
      
      {state.is_syncing && (
        <div className="bg-blue-50 p-4 rounded">
          Sincronizando datos...
        </div>
      )}

      <debt_aging_table
        deudas={kpis?.data.envejecimiento_deuda.deudas_priorizadas || []}
        loading={isLoading}
        on_payment_success={handle_payment_success}
        on_reminder_created={handle_reminder_created}
      />
    </div>
  )
}
```

## Consideraciones de Seguridad

1. **Validación de Permisos**: Verificar que el usuario tiene permisos para registrar pagos
2. **Validación de Datos**: Todos los inputs se validan en cliente y servidor
3. **Auditoría**: Todas las acciones se registran con timestamp y usuario
4. **Transacciones**: Los pagos se registran en transacciones atómicas
5. **Sincronización**: Se valida la integridad de datos después de cada operación

## Próximas Mejoras

- [ ] Implementar tabla de auditoría en Prisma schema
- [ ] Agregar endpoint API para recordatorios
- [ ] Implementar notificaciones push para recordatorios
- [ ] Agregar gráfico de evolución de deuda
- [ ] Implementar exportación de historial de pagos
- [ ] Agregar predicción de impacto futuro con ML
- [ ] Implementar workflow de aprobación para pagos grandes
- [ ] Agregar integración con APIs bancarias para pagos automáticos

## Soporte

Para preguntas o problemas, consultar:
- Documentación de diseño: `.kiro/specs/dashboard-inteligencia-cambiaria/design.md`
- Requerimientos: `.kiro/specs/dashboard-inteligencia-cambiaria/requirements.md`
- Tests: `src/lib/services/__tests__/treasury_integration_service.test.ts`
