# CRM y Fidelización — Arquitectura

Ecosistema completo de Customer Data Platform, Loyalty Engine, Cupones, Analytics y Automatización para el SaaS ERP TCP.

## Visión General

El módulo CRM y Fidelización extiende el ERP de inventario y ventas con capacidades de gestión avanzada de clientes. Proporciona un perfil unificado del cliente, un motor de lealtad con puntos y tiers, un sistema de cupones y promociones, analytics de comportamiento de compra, y automatización con triggers en tiempo real.

### Problema que resuelve

- El modelo `Cliente` original era mínimo: solo nombre, teléfono y dirección
- No existía programa de lealtad, cupones, segmentación ni analytics de comportamiento
- Las notificaciones eran genéricas, sin capacidad de campañas ni triggers
- No había visibilidad sobre el valor de vida del cliente (CLV) ni riesgo de churn

### Qué incluye

| Módulo | Descripción | Plan mínimo |
|--------|-------------|-------------|
| **CDP** | Perfil unificado, segmentación y deduplicación | Profesional |
| **Loyalty Engine** | Puntos, tiers, gamificación y referidos | Profesional |
| **Cupones** | Promociones segmentadas con A/B testing | Profesional |
| **Analytics** | RFM, CLV, basket analysis, churn prediction | Empresarial |
| **Automatización** | Triggers en tiempo real y webhooks | Profesional (triggers), Empresarial (webhooks) |
| **Dashboard KPIs** | Métricas de fidelización | Profesional |

## Principios Arquitectónicos

### Tenant Isolation

Todos los modelos nuevos incluyen `tenantId` como campo obligatorio. Las server actions validan el tenant del usuario autenticado antes de cualquier operación. Esto garantiza que cada tenant ve solo sus propios datos.

### Server Actions con `withAction`

Todas las mutaciones usan el wrapper `withAction` de `@/lib/server-actions`. Esto proporciona:

- Autenticación automática
- Manejo de errores estandarizado
- Retorno uniforme: `{ success: true, data }` o `{ success: false, error: { message, code? } }`

### Idempotencia

La acumulación de puntos usa claves de idempotencia (`idempotenciaKey`) para evitar duplicados si una operación se ejecuta múltiples veces. La clave se genera a partir del tipo de evento y el ID de referencia (ej. `venta-{ventaId}`).

### Job Nocturno

Los cálculos pesados de analytics (RFM, CLV, basket analysis, cohortes) se ejecutan en un job nocturno (`analytics-nightly-job.ts`) para no afectar el rendimiento del checkout. Los resultados se almacenan en modelos denormalizados (`ClienteAnalytics`, `BasketAnalysis`, `CohorteAnalytics`).

### API-First

Los eventos de lealtad (puntos acumulados, tier cambiado, cupón redimido) se exponen vía webhooks con verificación HMAC para integraciones externas.

## Arquitectura de Datos

```
ERP (Inventario/Precios) ──diario──→ Loyalty Platform (CRM)
POS / Checkout ────────────real-time→ Loyalty Platform
Loyalty Platform ──────────real-time→ App / Web (tarjeta digital)
Loyalty Platform ────────semanal/mensual→ Reporting / BI
```

**Principio clave:** Un solo sistema es "dueño" de cada campo de datos:

- **ERP** es líder en productos, precios e inventario
- **Loyalty Platform** es líder en perfil de cliente, consentimientos, puntos, tiers y segmentos
- **Analytics** es líder en RFM, CLV, churn y cohortes (actualizado por job nocturno)

## Modelos de Datos

### Modelo Cliente (enriquecido)

El modelo `Cliente` existente se enriqueció con 15 campos nuevos:

| Campo | Tipo | Propósito |
|-------|------|-----------|
| `email` | `String? @unique` | Contacto principal, email marketing |
| `emailSecondary` | `String?` | Contacto secundario |
| `telefonoSecondary` | `String?` | Contacto alternativo |
| `fechaNacimiento` | `DateTime?` | Cumpleaños, promociones de edad |
| `genero` | `String?` | Personalización de recomendaciones |
| `preferenciasComunicacion` | `Json?` | `{ email: true, sms: false, push: true }` |
| `consentimientos` | `Json?` | GDPR/LOPD: `{ marketing: true, analytics: true }` |
| `segmento` | `String?` | "VIP", "Mayorista", "Minorista", "Nuevo" |
| `tags` | `Json?` | Array de tags: `["frecuente", "nuevo", "churn-risk"]` |
| `canalPreferido` | `String?` | "POS", "Web", "App" — denormalizado |
| `ultimaCompra` | `DateTime?` | Denormalizado para RFM |
| `totalComprado` | `Int?` | Denormalizado para RFM (centavos) |
| `cantidadCompras` | `Int?` | Denormalizado para RFM |
| `clv` | `Float?` | Customer Lifetime Value calculado |
| `metadata` | `Json?` | Campos personalizados por tenant |

### Modelos nuevos (19)

| Modelo | Módulo | Descripción |
|--------|--------|-------------|
| `SegmentoCliente` | CDP | Definición de segmentos con reglas |
| `ClienteSegmento` | CDP | Relación cliente-segmento |
| `ClienteDuplicado` | CDP | Registro de fusiones de duplicados |
| `ProgramaLealtad` | Lealtad | Configuración del programa de lealtad |
| `TierLealtad` | Lealtad | Niveles del programa (Bronce, Plata, Oro, VIP) |
| `HistorialPuntos` | Lealtad | Historial de movimientos de puntos |
| `ClienteLealtad` | Lealtad | Perfil de lealtad del cliente |
| `MisionLealtad` | Lealtad | Misiones y desafíos de gamificación |
| `ProgresoMision` | Lealtad | Progreso del cliente en misiones |
| `ReferidoLealtad` | Lealtad | Tracking de programa de referidos |
| `Cupon` | Cupones | Cupones y promociones |
| `CuponUso` | Cupones | Registro de uso de cupones |
| `CuponABTest` | Cupones | Experimentos A/B de cupones |
| `ClienteAnalytics` | Analytics | Métricas de comportamiento por cliente |
| `BasketAnalysis` | Analytics | Productos que se compran juntos |
| `CohorteAnalytics` | Analytics | Retención por cohorte de adquisición |
| `TriggerAutomatizacion` | Automatización | Triggers de automatización |
| `TriggerEjecucion` | Automatización | Log de ejecuciones de triggers |
| `WebhookLealtad` | Automatización | Webhooks para eventos de lealtad |

## Estructura de Módulos

```
src/features/
├── crm/                          # CDP y segmentación
│   ├── services/
│   │   ├── segmento-engine.ts    # Motor de segmentación automática
│   │   └── deduplication-service.ts # Detección y fusión de duplicados
│   └── actions.ts                # Server actions para CRM
│
├── lealtad/                      # Loyalty Engine
│   ├── services/
│   │   ├── puntos-calculo.ts     # Reglas puras de cálculo de puntos
│   │   ├── canje-service.ts      # Lógica de canje de puntos
│   │   ├── tier-engine.ts        # Cálculo de tier actual
│   │   ├── mision-engine.ts      # Evaluación de progreso de misiones
│   │   ├── referido-engine.ts   # Tracking de referidos
│   │   └── idempotency-service.ts # Prevención de duplicados
│   ├── actions.ts                # Server actions de lealtad
│   ├── actions-admin.ts          # Server actions CRUD admin
│   └── schemas.ts                # Validación Zod
│
├── cupones/                      # Motor de Cupones
│   ├── services/
│   │   └── cupon-validator.ts    # Validación y aplicación de cupones
│   ├── actions.ts                # Server actions CRUD + checkout
│   └── schemas.ts                # Validación Zod
│
├── cliente-analytics/            # Analytics de Comportamiento
│   ├── services/
│   │   ├── rfm-calculator.ts     # Algoritmo RFM
│   │   ├── clv-calculator.ts     # Customer Lifetime Value
│   │   ├── basket-analyzer.ts    # Market Basket Analysis (Apriori)
│   │   ├── churn-predictor.ts    # Detección de churn
│   │   ├── coorte-analyzer.ts    # Cohort analysis
│   │   └── segmentacion-auto.ts  # Segmentación automática por RFM
│   ├── jobs/
│   │   └── analytics-nightly-job.ts # Job nocturno de actualización
│   └── actions.ts                # Queries de analytics
│
├── automatizacion/               # Automatización y Triggers
│   ├── services/
│   │   ├── trigger-engine.ts     # Motor de evaluación de triggers
│   │   └── webhook-dispatcher.ts # Dispatch de webhooks con HMAC
│   ├── actions.ts                # CRUD de triggers y webhooks
│   └── schemas.ts                # Validación Zod
│
└── fidelizacion-dashboard/       # Dashboard de KPIs
    └── actions.ts                # Queries de KPIs
```

## Integración con Ventas

El módulo se integra con el flujo de ventas en tres puntos:

1. **Validación de cupones** — Antes de la transacción de venta, se valida el cupón si se proporcionó un código
2. **Registro de uso de cupón** — Dentro de la transacción, se registra el `CuponUso` y se incrementa `vecesUsado`
3. **Acumulación de puntos** — Después de confirmar la venta (fuera de la transacción), se acumulan puntos de lealtad y se actualizan los campos RFM del cliente

Los errores de lealtad no fallan la venta: se capturan con `try-catch` y se loguean, pero la venta se completa normalmente.

## Guías de Uso

- [CDP y Segmentación](./cdp.md) — Perfil unificado, segmentación inteligente y deduplicación
- [Loyalty Engine](./lealtad.md) — Puntos, tiers, gamificación y referidos
- [Motor de Cupones](./cupones.md) — Cupones, promociones y A/B testing
- [Analytics de Comportamiento](./analytics.md) — RFM, CLV, basket analysis y churn
- [Automatización y Triggers](./automatizacion.md) — Triggers en tiempo real y webhooks
- [Dashboard de KPIs](./dashboard-kpis.md) — Métricas de fidelización
- [Referencia de API](./api-reference.md) — Server actions disponibles
- [Integración con Ventas](./integracion-ventas.md) — Cómo se integra con el checkout

## Feature Flags

Los 14 features se registran en `FEATURE_REGISTRY` y se distribuyen por plan:

| Feature Key | Label | Plan |
|-------------|-------|------|
| `crm-cdp` | CDP de Clientes | Profesional |
| `crm-segmentacion` | Segmentación Inteligente | Empresarial |
| `lealtad-programa` | Programa de Lealtad | Profesional |
| `lealtad-gamificacion` | Gamificación | Empresarial |
| `lealtad-referidos` | Programa de Referidos | Profesional |
| `cupones-promociones` | Cupones y Promociones | Profesional |
| `cupones-ab-testing` | A/B Testing de Cupones | Empresarial |
| `cliente-analytics` | Analytics de Clientes | Empresarial |
| `cliente-churn` | Predicción de Churn | Empresarial |
| `cliente-basket` | Basket Analysis | Empresarial |
| `automatizacion-triggers` | Automatización de Triggers | Profesional |
| `automatizacion-webhooks` | Webhooks de Lealtad | Empresarial |
| `fidelizacion-dashboard` | Dashboard de Fidelización | Profesional |

## Migración de Base de Datos

La migración Prisma (`20261113000000_add_crm_cdp_and_fidelizacion`) crea las 19 tablas nuevas y agrega los 15 campos al modelo `Cliente`. Se aplica con:

```bash
npx prisma migrate deploy
```

## Testing

Los servicios puros cuentan con tests unitarios:

- `puntos-calculo.test.ts` — Cálculo de puntos y canjes
- `tier-engine.test.ts` — Evaluación de tiers
- `rfm-calculator.test.ts` — Segmentación RFM
- `clv-calculator.test.ts` — Cálculo de CLV
- `basket-analyzer.test.ts` — Market Basket Analysis
- `trigger-engine.test.ts` — Evaluación de triggers
- `webhook-dispatcher.test.ts` — Dispatch de webhooks

Se ejecutan con:

```bash
pnpm test -- src/features/lealtad src/features/cliente-analytics src/features/automatizacion
```
