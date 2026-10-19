# Propuesta — Contratos fase 2: máquina de estados, RBAC por ruta, config por tenant y cron de vencimientos (serie CTF)

## Why

Hallazgo 7 de la re-auditoría de módulos vs Odoo (2026-09-26), verificado contra el código el mismo día:

1. **No hay máquina de estados.** `EstadoContrato` define 7 estados (BORRADOR, PENDIENTE_APROBACION, APROBADO, RECHAZADO, ACTIVO, FINALIZADO, ANULADO), pero nada valida transiciones: `updateContratoAction` y `updateContratoHandler` aceptan `estado`/`fechaAprobacion`/`aprobadoPor` del cliente tal cual; `bulkUpdateContratoStatusAction` hace `updateMany` a cualquier estado (saltándose aprobación, firma y flujo completo).
2. **PUT insano.** El schema de update del handler (`handlers.ts:50`) acepta `numeroContrato` escribible por el cliente (numeración server-generated con consecutivo por tenant) y `fechaAprobacion`/`aprobadoPor` sin verificar quién aprueba ni cuándo.
3. **Sin RBAC por ruta.** Las 13 rutas API de contratos llaman `authenticateUser(request)` directamente, sin el wrapper `withAuth`: el route-map fail-closed (`route-permissions.ts`) nunca las evalúa. Cualquier autenticado con tenant lista, edita, borra, aprueba y firma contratos. `/api/configuracion/sistema/contratos` (PUT) además no tiene ninguna clave de permiso.
4. **Config global, no por tenant.** `ConfiguracionSistema.diasAvisoVencimientoContrato` es una fila global sin `tenantId` (`model-classification.ts:180` ya documentaba la decisión pendiente de migrar a por-tenant).
5. **Sin cron de vencimientos.** `ContratoAlerta` existe pero solo se crea a mano vía POST; ningún proceso genera alertas de vencimiento próximo o de contrato vencido.
6. **Firma decorativa.** Crear firma no afecta el ciclo de vida: un contrato APROBADO nunca pasa a ACTIVO por firma; el único camino es escribir `estado: 'ACTIVO'` a mano (que la máquina de estados prohibirá).
7. **`Vendor.contrato String?` duplicado.** Campo legacy que replica la relación `Contrato.vendorId`; solo lo escriben las rutas mobile de proveedores.

## What Changes

| Hoy | Objetivo |
|---|---|
| `estado` escribible por cliente, sin validación | Máquina de estados pura con transiciones válidas; el estado cambia solo por la vía dedicada (acción + handler de bulk) que valida transición y audita |
| PUT acepta `numeroContrato`, `estado`, `fechaAprobacion`, `aprobadoPor` | PUT saneado: numeración y ciclo de vida no escribibles por cliente |
| Firma decorativa | Firma FIRMADA sobre contrato APROBADO → transición APROBADO→ACTIVO por la máquina |
| 13 rutas sin gate de permisos | Rutas envueltas en `withAuth` + entradas en `ROUTE_PERMISSION_MAP` (claves existentes + 1 clave nueva `config.contratos.configurar`) |
| `diasAvisoVencimientoContrato` global | Modelo `ConfiguracionContratos` por tenant (aditivo); ruta GET/PUT por tenant; global deprecado |
| Alertas solo manuales | Script idempotente `scripts/alertas-vencimiento-contratos.ts` (alertas próximas + vencidas, dedupe por día) programable por cron externo |
| `Vendor.contrato` escrito por mobile | Campo deprecado en schema; mobile deja de escribirlo |

## No-goals

- **No se toca la numeración**: `numeroContratoGenerator` (consecutivo por tenant, `@@unique([tenantId, tipo, numeroConsecutivo])`) queda igual.
- **No hay auto-transición a FINALIZADO ni renovación automática** en el cron: solo alertas (renovación/re-prorroga es sesión posterior).
- **No se borran columnas**: `Vendor.contrato` y `ConfiguracionSistema.diasAvisoVencimientoContrato` se deprecan (comentario + cese de escritura); su eliminación es higiene posterior (sesión G).
- **No se migra la API a server actions** en esta serie: se sanea el canal API existente (el que usa la UI) y se añade server action para la máquina de estados.
- **No se cambia el permiso de roles custom existentes**: la clave nueva nace con `defaultRoles: ['manager']`.

## Solución propuesta (resumen; detalle en design.md)

Serie **CTF** en 7 fases TDD, cada una con commit propio:

1. **CTF-1 — Máquina de estados.** Módulo puro `estado-contrato-machine.ts` + `cambiarEstadoContratoAction` + bulk que valida por id (reporta fallidos) + flujo de aprobación enrutado por la máquina. Auditoría `AuditLogService` por transición.
2. **CTF-2 — Saneamiento del PUT.** Retirar `estado`/`numeroContrato`/`fechaAprobacion`/`aprobadoPor` de los schemas de update (action + handler); tests de que se ignoran.
3. **CTF-3 — firma→ACTIVO.** `createContratoFirmaHandler` registra firma con estado tipado (PENDIENTE/FIRMADA/RECHAZADA); FIRMADA sobre APROBADO → ACTIVO vía máquina, `fechaFirma` server-side; UI: selector de estado en el diálogo de firmas.
4. **CTF-4 — RBAC por ruta.** Entradas en `ROUTE_PERMISSION_MAP` + rutas envueltas con `withAuth`; clave nueva `config.contratos.configurar` en el registry (drift gate cubre las claves).
5. **CTF-5 — Config por tenant.** Modelo `ConfiguracionContratos` (aditivo) + migración; GET/PUT por tenant con upsert perezoso; backfill opt-in; global deprecado en schema y clasificación.
6. **CTF-6 — Cron de alertas.** Lib puro de cálculo de alertas + script idempotente con JSON summary; entrada en `package.json`; doc de scheduling externo.
7. **CTF-7 — Deprecar `Vendor.contrato`.** Comentario de deprecación en schema, cese de escritura en mobile providers (create/update), tests de que el payload lo ignora.

## Impact

| Elemento | Medición | Afectación |
|---|---|---|
| Schema | 2 cambios aditivos | +1 modelo `ConfiguracionContratos`; comentarios `@deprecated` en `Vendor.contrato` y `ConfiguracionSistema.diasAvisoVencimientoContrato`. Migración SQL nueva (prod corre `db-push`; backfill manual opt-in). |
| Rutas API | 13 archivos de rutas + 3 handlers + 2 actions | Wrappers `withAuth`, schemas saneados, bulk con resultado por id, ruta de config por tenant. |
| UI | 2 componentes | `contratos-content.tsx` (manejo de fallidos del bulk + config por tenant), `add-firma-dialog.tsx` (selector de estado de firma). |
| Registry permisos | +1 clave | `config.contratos.configurar` (category `config`, default `manager`). |
| Scripts | +1 script + 1 entrada package.json | `alertas-vencimiento-contratos.ts`, `contratos:alertas-vencimiento`. |
| Riesgo de merge | `prisma/schema.prisma` | La rama de contabilidad también toca `schema.prisma`; los cambios de esta serie son aditivos en regiones distintas (modelos nuevos + comentarios). Merge tras contabilidad, o viceversa, resuelve limpio salvo colisión en el fin de archivo — resolver manual. |
