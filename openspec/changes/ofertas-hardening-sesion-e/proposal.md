# Propuesta — Sesión E: hardening de ofertas (numeración, VENCIDA, ítems, impuestos)

## Decisión ejecutiva

Cerrar los cuatro gaps del módulo de ofertas identificados en la re-auditoría del
2026-09-26 con una sesión acotada de backend-first: numeración secuencial con
reintento (mismo patrón ya probado en contratos), estado `VENCIDA` con expiración
perezosa y guardas de transición, recálculo autoritativo de totales/impuestos en el
servidor, y edición/duplicación de ítems con precios re-resueltos. Todo con TDD
estricto (RED→GREEN→REFACTOR por fase), sin tocar el patrón de contratos y sin
cambios de contrato para clientes móviles existentes.

## Why

Verificado sobre `main` (b4be12ba) el 2026-09-27:

1. **Numeración race → 500.** `createOfertaAction` calcula el consecutivo con
   `findFirst` + `parseInt` fuera de transacción y sin reintento
   (`src/features/ofertas/actions.ts:79-87`); dos creaciones concurrentes del mismo
   tenant chocan contra `@@unique([tenantId, numeroOferta])` (schema L2482) y
   terminan en P2002 sin manejo (hallazgo 11 de la re-auditoría).
2. **No existe `VENCIDA`.** El enum `EstadoOferta` solo tiene
   `PENDIENTE | ACEPTADA | RECHAZADA | FACTURADA` (schema L3452-3457); el
   vencimiento vive únicamente en `fechaVencimiento` sin efecto en el ciclo de vida.
3. **Sin máquina de estados.** `updateOfertaAction` acepta cualquier salto de estado
   vía enum Zod (`schemas.ts:29`), p. ej. `FACTURADA → PENDIENTE`; y
   `deleteOfertaAction` borra cualquier oferta sin guarda de estado en servidor (la
   UI solo oculta el botón si `FACTURADA`, `ofertas-table.tsx:167`).
4. **Impuestos del cliente.** El servidor recalcula `subtotal` desde precios
   resueltos, pero `impuestos` se toma tal cual del payload
   (`actions.ts:76`, `total: subtotal + impuestos` en L98) sin validación alguna.
5. **Ítems congelados.** Los ítems no se pueden editar después de crear la oferta
   (el update solo toca `estado`/`observaciones`) y no existe acción de duplicar.

## What Changes

| Hoy | Objetivo |
|---|---|
| Consecutivo leído una vez, sin retry; colisión → 500 | Generador `OF-XXXXXX` con reintento ante P2002 (máx. 3 intentos), patrón de `numeroContratoGenerator` |
| Estados `PENDIENTE/ACEPTADA/RECHAZADA/FACTURADA` | Nuevo estado `VENCIDA` + expiración perezosa por `fechaVencimiento` |
| `update` acepta cualquier transición; delete sin guarda | Matriz de transiciones server-side + guardas en facturar/convertir/delete |
| `impuestos` y totales de línea del payload | Calculadora pura server-side: totales por línea, `subtotal`, `total = subtotal + impuestos`, impuestos declarados validados |
| Ítems inmutables; sin duplicar | Edición de ítems (solo `PENDIENTE`, reemplazo atómico con precios re-resueltos) + `duplicarOfertaAction` |

## No-goals

- Refactor del generador de contratos a lib compartida (se replica el patrón; la
  unificación queda como seguimiento).
- Motor fiscal con tasas por producto/servicio (no existe infraestructura de tasas;
  `impuestos` sigue siendo una declaración validada, no un cálculo por alícuota).
- Limpieza del limbo `Venta.ofertaId` en anulación de pedidos (corresponde a la
  Sesión A, revertida en `main` — se re-integra aparte).
- Cron de expiración; la expiración es perezosa (al leer/facturar/convertir).
- Cambios en la app móvil (lee ofertas vía `mapOfertaForMobile`; sin cambios).

## Solución propuesta (resumen; detalle en design.md)

1. **E-1 — Numeración con retry.** Nueva lib `src/features/ofertas/lib/numero-oferta-generator.ts`
   con `generarProximoNumeroOferta(tenantId)` y `crearOfertaConNumero({ tenantId,
   buildData, create })`: reintento hasta 3 veces ante `P2002`, propagando otros
   errores. `createOfertaAction` y la futura duplicación pasan por aquí.
2. **E-2 — VENCIDA + guardas.** Enum + migración `ALTER TYPE ... ADD VALUE;
   expiración perezosa (`updateMany` PENDIENTE con `fechaVencimiento < now` →
   `VENCIDA`) en lecturas, facturar y convertir; matriz de transiciones en
   `updateOfertaAction` (solo `PENDIENTE → ACEPTADA | RECHAZADA`); `delete`
   rechaza `FACTURADA` en servidor.
3. **E-3 — Totales server-side.** Calculadora pura `calcularTotalesOferta(items,
   impuestosDeclarados)` en `src/features/ofertas/lib/totales-oferta.ts`: totales
   por línea, `subtotal` desde precios resueltos, validación
   `0 ≤ impuestos ≤ subtotal` (`TAX_INVALID`), `total = subtotal + impuestos`.
   Usada por crear, editar ítems y duplicar.
4. **E-4 — Edición y duplicación de ítems.** `updateOfertaAction` acepta `items`
   opcional (solo `PENDIENTE`; reemplazo atómico en `$transaction` con precios
   re-resueltos y recálculo E-3). Nueva `duplicarOfertaAction`: copia con precios
   re-resueltos a hoy, número nuevo vía E-1, estado `PENDIENTE`, fecha de
   vencimiento conservada solo si sigue futura. UI mínima: botón Duplicar en tabla
   y detalle.

## Impact

| Elemento | Magnitud real | Afectación |
|---|---|---|
| `src/features/ofertas/actions.ts` | 260 líneas | create usa generador; update gana items + matriz; delete gana guarda; facturar/convertir ganan expiración |
| Libs nuevas | 2 archivos | `numero-oferta-generator.ts`, `totales-oferta.ts` (+ tests) |
| `prisma/schema.prisma` | 1 enum | `EstadoOferta` + `VENCIDA`; migración SQL de 1 línea |
| Tests | ~6 archivos | nuevos: numeración, totales, expiración, edición, duplicación; ajustes a mocks existentes |
| UI | 1-2 componentes | botón Duplicar (tabla y/o detalle); sin cambios de copy existente |
| Móvil / API pública | 0 | sin cambios de contrato |

## Criterios de aceptación

1. Dos creaciones concurrentes no generan 500: la colisión P2002 reintenta y ambas
   ofertas obtienen números distintos (test de colisión con `mockRejectedValueOnce`).
2. Una oferta `PENDIENTE` con `fechaVencimiento` vencida aparece como `VENCIDA` al
   listar/leer, y no puede facturarse, convertirse, editarse ni reactivarse.
3. `updateOfertaAction` rechaza `FACTURADA → PENDIENTE` (o cualquier transición no
   permitida) con código explícito; `delete` rechaza `FACTURADA` en servidor.
4. Ningún cliente puede persistir `impuestos > subtotal` ni totales de línea
   forjados: todo se recalcula en servidor.
5. Los ítems de una oferta `PENDIENTE` se reemplazan atómicamente con precios
   re-resueltos; en otro estado se rechaza.
6. Duplicar produce una oferta nueva `PENDIENTE`, número nuevo, precios a hoy.
7. `pnpm exec vitest run src/features/ofertas` verde (con los mocks existentes
   actualizados); lint limpio en archivos tocados.
8. Sin cambios de comportamiento para clientes móviles existentes.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El nuevo valor del enum rompe clientes con uniones TS locales | Actualizar `src/app/models/ofertas.ts` y badges de UI en la misma fase |
| Retry no cubre colisiones en `duplicar` | Duplicar usa el mismo generador; test de colisión dedicado |
| Expiración perezosa en lecturas agrega writes inesperados | `updateMany` solo toca filas vencidas `PENDIENTE`; mockeado en tests |
| Ofertas históricas sin `fechaVencimiento` | Nunca expiran (guarda `lt: now` sobre campo nullable) |

## Rollback

Fases independientes y commiteadas por separado: revert por fase. La migración del
enum es aditiva (`ADD VALUE`); revertir el código no exige revertir la base.
