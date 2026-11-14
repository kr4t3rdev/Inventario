# Automatización y Triggers

Triggers en tiempo real y webhooks para automatizar comunicaciones y acciones basadas en eventos de lealtad.

## Visión General

El módulo de automatización permite definir triggers que se disparan automáticamente ante eventos del sistema (compra completada, cumpleaños, tier alcanzado, churn risk). Cada trigger puede enviar emails, SMS, push notifications, otorgar cupones o puntos bonus.

## Modelo de Datos

### Trigger de Automatización

```prisma
model TriggerAutomatizacion {
  triggerId           String   @id @default(cuid())
  tenantId            String
  nombre              String   // "Cumpleaños", "Post-Compra", "Churn Risk"
  evento              String   // Tipo de evento que dispara el trigger
  condiciones         Json     // { minimoGasto: 1000, segmento: "VIP" }
  accion              String   // "EMAIL", "SMS", "PUSH", "CUPON", "PUNTOS_BONUS"
  payload             Json     // { templateId, cuponId, puntos, mensaje }
  canal               String   // "EMAIL", "SMS", "PUSH"
  delayMinutos        Int      @default(0) // Delay antes de enviar
  activo              Boolean  @default(true)
  vecesMaximo         Int?     // Límite de disparos por cliente
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  ejecuciones         TriggerEjecucion[]
}
```

### Ejecución de Trigger

```prisma
model TriggerEjecucion {
  ejecucionId         String   @id @default(cuid())
  tenantId            String
  triggerId           String
  clienteId           String
  eventoData          Json     // Datos del evento que disparó
  estado              String   // "PENDIENTE", "ENVIADO", "FALLIDO"
  enviadoEn           DateTime?
  error               String?
  trigger             TriggerAutomatizacion @relation(fields: [triggerId], references: [triggerId])
}
```

### Webhook de Lealtad

```prisma
model WebhookLealtad {
  webhookId           String   @id @default(cuid())
  tenantId            String
  url                 String   // URL del endpoint
  eventos             String[] // ["puntos_acumulados", "tier_cambiado", "cupon_redimido"]
  secreto             String   // HMAC secret para verificar
  activo              Boolean  @default(true)
  ultimoEstado        String?  // "200", "404", "error"
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

## Eventos del Sistema

| Evento | Descripción | Trigger típico |
|--------|-------------|----------------|
| `COMPRA_COMPLETADA` | Se completó una venta | Email de confirmación + puntos acumulados |
| `CUMPLEANOS` | Es el cumpleaños del cliente | Email/SMS con cupón especial + puntos bonus |
| `TIER_ALCANZADO` | El cliente subió de tier | Notificación de ascenso con beneficios |
| `CHURN_RISK` | Se detectó riesgo de churn | Email de re-engagement con oferta |
| `CARRITO_ABANDONADO` | Carrito sin completar (futuro) | Email de recuperación |
| `MISION_COMPLETADA` | El cliente completó una misión | Notificación de puntos ganados |

## Motor de Triggers

El servicio `trigger-engine.ts` evalúa y ejecuta triggers:

### API

```typescript
// Evalúa todos los triggers activos para un evento
export async function evaluarTriggers(tx: PrismaTransaction, params: {
  tenantId: string;
  evento: string;
  clienteId: string;
  eventoData: Record<string, unknown>;
}): Promise<{ ejecutados: string[]; fallidos: string[] }>

// Verifica si un trigger cumple sus condiciones
export function cumpleCondiciones(params: {
  condiciones: Record<string, unknown>;
  eventoData: Record<string, unknown>;
}): boolean
```

### Ejemplo: Crear trigger

```typescript
const result = await createTriggerAction({
  nombre: 'Post-Compra VIP',
  evento: 'COMPRA_COMPLETADA',
  condiciones: {
    segmento: 'VIP',
    minimoGasto: 10000,
  },
  accion: 'EMAIL',
  payload: {
    templateId: 'post-compra-vip',
    cuponId: 'vip-gracias',
  },
  canal: 'EMAIL',
  delayMinutos: 30, // Enviar 30 minutos después
  vecesMaximo: 10,
});
```

### Ejemplo: Trigger de cumpleaños

```typescript
const result = await createTriggerAction({
  nombre: 'Cumpleaños',
  evento: 'CUMPLEANOS',
  condiciones: {},
  accion: 'PUNTOS_BONUS',
  payload: {
    puntos: 500,
    mensaje: '¡Feliz cumpleaños! Aquí tienes 500 puntos de regalo.',
  },
  canal: 'PUSH',
  delayMinutos: 0,
});
```

## Webhooks

El servicio `webhook-dispatcher.ts` envía eventos a endpoints externos con verificación HMAC.

### API

```typescript
// Envía un webhook a todos los endpoints registrados para un evento
export async function dispatchWebhook(params: {
  tenantId: string;
  evento: string;
  payload: Record<string, unknown>;
}): Promise<{ enviados: number; fallidos: number }>

// Verifica la firma HMAC de un webhook recibido
export function verificarHMAC(params: {
  payload: string;
  signature: string;
  secreto: string;
}): boolean
```

### Ejemplo: Crear webhook

```typescript
const result = await createWebhookAction({
  url: 'https://mi-app.com/webhooks/tcp-lealtad',
  eventos: ['puntos_acumulados', 'tier_cambiado', 'cupon_redimido'],
  secreto: 'whk_secret_abc123',
});
```

### Formato del webhook

```json
{
  "evento": "puntos_acumulados",
  "tenantId": "tenant123",
  "clienteId": "cliente456",
  "datos": {
    "puntos": 500,
    "tipo": "COMPRA",
    "saldoAcumulado": 2500,
    "ventaId": "venta789"
  },
  "timestamp": "2026-11-14T03:00:00.000Z"
}
```

### Verificación HMAC

```typescript
import { verificarHMAC } from '@/features/automatizacion/services/webhook-dispatcher';

// En el endpoint que recibe el webhook:
const signature = request.headers['x-tcp-signature'];
const payload = await request.text();
const valido = verificarHMAC({
  payload,
  signature,
  secreto: 'whk_secret_abc123',
});

if (!valido) {
  return new Response('Firma inválida', { status: 401 });
}
```

### Retry

El dispatcher intenta enviar el webhook hasta 3 veces con backoff exponencial:

1. Intento 1: Inmediato
2. Intento 2: 5 segundos después
3. Intento 3: 30 segundos después

Si todos fallan, se registra el error en `WebhookLealtad.ultimoEstado`.

## Server Actions

| Action | Descripción |
|--------|-------------|
| `getTriggersAction` | Lista triggers activos del tenant |
| `createTriggerAction` | Crea un nuevo trigger |
| `updateTriggerAction` | Actualiza un trigger |
| `deleteTriggerAction` | Elimina un trigger |
| `toggleTriggerAction` | Activa/desactiva un trigger |
| `getTriggerEjecucionesAction` | Log de ejecuciones de un trigger |
| `getWebhooksAction` | Lista webhooks del tenant |
| `createWebhookAction` | Crea un nuevo webhook |
| `updateWebhookAction` | Actualiza un webhook |
| `deleteWebhookAction` | Elimina un webhook |
| `testWebhookAction` | Envía un webhook de prueba |

## Consideraciones

- **Tenant isolation**: Todos los queries filtran por `tenantId`
- **Idempotencia**: Los triggers verifican `vecesMaximo` para no spamear al cliente
- **Delay**: Los triggers con `delayMinutos > 0` requieren un worker para ejecutar en el momento correcto
- **HMAC**: Siempre verificar la firma HMAC en los endpoints que reciben webhooks
- **Retry**: El dispatcher reintent automáticamente hasta 3 veces antes de marcar como fallido
