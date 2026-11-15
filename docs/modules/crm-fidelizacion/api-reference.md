# Referencia de API — Server Actions

Lista completa de todas las server actions del ecosistema CRM y Fidelización.

## Convenciones

Todas las server actions usan el wrapper `withAction` de `@/lib/server-actions`. El retorno es siempre:

```typescript
// Éxito
{ success: true, data: T }

// Error
{ success: false, error: { message: string; code?: string } }
```

Las actions manejan autenticación automáticamente. Se debe llamar a `requireTenant(user)` dentro de cada action para validar el tenant.

---

## Módulo CRM (CDP y Segmentación)

Archivo: `src/features/crm/actions.ts`

| Action | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `getSegmentosAction` | `?` | `{ segmentos: SegmentoCliente[] }` | Lista todos los segmentos del tenant |
| `createSegmentoAction` | `{ nombre, tipo, reglas?, descripcion?, color? }` | `{ segmento: SegmentoCliente }` | Crea un nuevo segmento |
| `updateSegmentoAction` | `{ segmentoId, ...datos }` | `{ segmento: SegmentoCliente }` | Actualiza un segmento existente |
| `deleteSegmentoAction` | `{ segmentoId }` | `{ eliminado: true }` | Elimina un segmento |
| `asignarSegmentoAction` | `{ clienteId, segmentoId }` | `{ asignado: true }` | Asigna un segmento a un cliente manualmente |
| `quitarSegmentoAction` | `{ clienteId, segmentoId }` | `{ quitado: true }` | Quita un segmento de un cliente |
| `ejecutarSegmentacionAutoAction` | `?` | `{ procesados: number }` | Ejecuta la segmentación automática para todos los clientes |
| `encontrarDuplicadosAction` | `?` | `{ duplicados: DuplicadoGroup[] }` | Busca clientes duplicados |

---

## Módulo Lealtad

Archivo: `src/features/lealtad/actions.ts`

| Action | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `getProgramaAction` | `?` | `{ programa: ProgramaLealtad }` | Obtiene el programa de lealtad activo |
| `getClienteLealtadAction` | `{ clienteId }` | `{ perfil: ClienteLealtad; historial: HistorialPuntos[] }` | Obtiene el perfil de lealtad de un cliente |
| `canjePuntosAction` | `{ clienteId, puntosACanjar }` | `{ exito: boolean; descuento: number; motivo?: string }` | Canjea puntos por descuento |
| `addPuntosManualesAction` | `{ clienteId, puntos, motivo }` | `{ puntosAgregados: number }` | Agrega puntos manualmente (bonus) |
| `acumularPuntosPorCompraAction` | `{ clienteId, ventaId, totalCompra }` | `{ puntos: number; motivo: string }` | Acumula puntos por una compra |

Archivo: `src/features/lealtad/actions-admin.ts`

| Action | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `createProgramaAction` | `{ nombre, puntosPorPeso?, puntosMinimos?, valorCanje?, reglas? }` | `{ programa: ProgramaLealtad }` | Crea un programa de lealtad |
| `updateProgramaAction` | `{ programaId, ...datos }` | `{ programa: ProgramaLealtad }` | Actualiza el programa |
| `toggleProgramaAction` | `{ programaId, activo }` | `{ programa: ProgramaLealtad }` | Activa/desactiva el programa |
| `createTierAction` | `{ programaId, nombre, orden, umbralGasto, umbralFrecuencia?, beneficios, color?, icono? }` | `{ tier: TierLealtad }` | Crea un nuevo tier |
| `updateTierAction` | `{ tierId, ...datos }` | `{ tier: TierLealtad }` | Actualiza un tier |
| `deleteTierAction` | `{ tierId }` | `{ eliminado: true }` | Elimina un tier |
| `createMisionAction` | `{ programaId, nombre, tipo, reglas, recompensaPuntos, validoDesde, validoHasta? }` | `{ mision: MisionLealtad }` | Crea una misión |
| `updateMisionAction` | `{ misionId, ...datos }` | `{ mision: MisionLealtad }` | Actualiza una misión |
| `getMisionesActivasAction` | `{ programaId? }` | `{ misiones: MisionLealtad[] }` | Lista misiones activas |
| `generarCodigoReferralAction` | `{ clienteId }` | `{ codigo: string }` | Genera código de referido |

---

## Módulo Cupones

Archivo: `src/features/cupones/actions.ts`

| Action | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `getCuponesAction` | `{ activo?: boolean }` | `{ cupones: Cupon[] }` | Lista cupones del tenant |
| `getCuponAction` | `{ cuponId }` | `{ cupon: Cupon }` | Obtiene un cupón por ID |
| `createCuponAction` | `{ codigo, tipo, valor, ... }` | `{ cupon: Cupon }` | Crea un nuevo cupón |
| `updateCuponAction` | `{ cuponId, ...datos }` | `{ cupon: Cupon }` | Actualiza un cupón |
| `deleteCuponAction` | `{ cuponId }` | `{ eliminado: true }` | Elimina un cupón |
| `aplicarCuponAction` | `{ codigo, clienteId?, totalCompra, canal, productoIds? }` | `{ valido: boolean; descuento?: number; motivoRechazo?: string }` | Valida y aplica un cupón en el checkout |

---

## Módulo Analytics

Archivo: `src/features/cliente-analytics/actions.ts`

| Action | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `getClienteAnalyticsAction` | `{ clienteId }` | `{ analytics: ClienteAnalytics }` | Obtiene analytics de un cliente |
| `getRFMDistributionAction` | `?` | `{ distribution: Record<string, { count, percentage }> }` | Distribución por segmento RFM |
| `getTopClientesAction` | `{ limit?: number }` | `{ clientes: Array<{ clienteId, nombre, clv }> }` | Top N clientes por CLV |
| `getBasketRulesAction` | `{ minLevantamiento?: number }` | `{ reglas: BasketRule[] }` | Reglas de basket analysis |
| `getChurnRiskAction` | `{ probabilidadMin?: number }` | `{ clientes: Array<{ clienteId, probabilidadChurn, senales }> }` | Clientes en riesgo de churn |
| `getCohortesAction` | `{ periodos?: string[] }` | `{ cohortes: CohorteAnalytics[] }` | Analytics por cohorte |

---

## Módulo Automatización

Archivo: `src/features/automatizacion/actions.ts`

| Action | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `getTriggersAction` | `{ activo?: boolean }` | `{ triggers: TriggerAutomatizacion[] }` | Lista triggers del tenant |
| `createTriggerAction` | `{ nombre, evento, condiciones, accion, payload, canal, delayMinutos?, vecesMaximo? }` | `{ trigger: TriggerAutomatizacion }` | Crea un nuevo trigger |
| `updateTriggerAction` | `{ triggerId, ...datos }` | `{ trigger: TriggerAutomatizacion }` | Actualiza un trigger |
| `deleteTriggerAction` | `{ triggerId }` | `{ eliminado: true }` | Elimina un trigger |
| `toggleTriggerAction` | `{ triggerId, activo }` | `{ trigger: TriggerAutomatizacion }` | Activa/desactiva un trigger |
| `getTriggerEjecucionesAction` | `{ triggerId, limite?: number }` | `{ ejecuciones: TriggerEjecucion[] }` | Log de ejecuciones de un trigger |
| `getWebhooksAction` | `?` | `{ webhooks: WebhookLealtad[] }` | Lista webhooks del tenant |
| `createWebhookAction` | `{ url, eventos, secreto }` | `{ webhook: WebhookLealtad }` | Crea un nuevo webhook |
| `updateWebhookAction` | `{ webhookId, ...datos }` | `{ webhook: WebhookLealtad }` | Actualiza un webhook |
| `deleteWebhookAction` | `{ webhookId }` | `{ eliminado: true }` | Elimina un webhook |
| `testWebhookAction` | `{ webhookId }` | `{ exito: boolean; respuesta?: string }` | Envía un webhook de prueba |

---

## Módulo Dashboard KPIs

Archivo: `src/features/fidelizacion-dashboard/actions.ts`

| Action | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `getFidelizacionKPIsAction` | `{ periodo? }` | `{ repeatPurchaseRate, clvPromedio, aov, redemptionRate, breakage, churnRate, ... }` | KPIs generales de fidelización |
| `getRFMDistributionAction` | `?` | `{ distribution: Record<string, { count, percentage }> }` | Distribución por segmento RFM |
| `getTierDistributionAction` | `?` | `{ tiers: Array<{ nombre, count, percentage }> }` | Distribución de tiers |
| `getChurnTrendAction` | `{ periodos?: number }` | `{ trend: Array<{ mes, churnRate, clientesPerdidos }> }` | Tendencia de churn |
| `getCLVDistributionAction` | `?` | `{ buckets: Array<{ rango, count, label }> }` | Distribución de CLV |
| `getRedemptionTrendAction` | `{ periodos?: number }` | `{ trend: Array<{ mes, puntosEmitidos, puntosCanjeados, rate }> }` | Tendencia de redención |

---

## Errores Comunes

| Código de Error | Descripción | Solución |
|----------------|-------------|----------|
| `CUPON_INVALIDO` | El cupón no cumple las reglas de validación | Verificar fechas, límites y condiciones del cupón |
| `CUPON_NO_ENCONTRADO` | El código de cupón no existe o no está activo | Verificar que el código sea correcto y el cupón esté activo |
| `SALDO_INSUFICIENTE` | El cliente no tiene suficientes puntos para el canje | Verificar el saldo de puntos del cliente |
| `PROGRAMA_NO_ACTIVO` | No hay programa de lealtad activo | Crear o activar un programa de lealtad |
| `DUPLICATE` | Ya existe un registro con ese identificador | Verificar unicidad del código o nombre |
| `NOT_FOUND` | El recurso no existe | Verificar el ID del recurso |
| `PERMISSION_DENIED` | El usuario no tiene permiso para la operación | Verificar los permisos del usuario |

---

## Ejemplo de Uso en Componente React

```typescript
'use client';

import { useState } from 'react';
import { createCuponAction } from '@/features/cupones/actions';

export function CrearCuponForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createCuponAction(data);

      if (!result.success) {
        throw new Error(result.error?.message || 'Error al crear el cupón');
      }

      // Éxito: recargar datos o mostrar notificación
      console.log('Cupón creado:', result.data.cupon.codigo);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Campos del formulario */}
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creando...' : 'Crear Cupón'}
      </button>
    </form>
  );
}
```
