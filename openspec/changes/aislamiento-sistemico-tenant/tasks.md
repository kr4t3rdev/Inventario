# Tasks — Enforcement sistémico del aislamiento tenant

Plan SDD/TDD. Reglas (memorias del proyecto): TDD estricto con evidencia del fallo RED, tests con rutas explícitas (`pnpm exec vitest run <rutas>` y para DB real `__integration__` con `DATABASE_URL_TEST`), code review + commit por fase con **stage selectivo**, migraciones con `--create-only` + revisión SQL. Coordinación: **Correcciones Urgentes primero**; solapamiento con `permisos-granulares` solo en `auth-middleware.ts` (ver design §7).

Dependencia de entorno: la extensión requiere Prisma 6.19 (ya instalada). Los tests de la extensión corren contra DB real en `__integration__`; los unitarios mockean.

## AS-01 — Clasificación formal de los 128 modelos

- [ ] **T1 — Inventario verificado.** Generar el listado modelo↔clasificación leyendo el DMMF (`prisma.$dmmf` o parse del schema) en `scripts/audit/model-classification.ts`; resolver las dudas marcadas en design §1 (`Moneda`, `CloudinaryAsset`, `TenantLicense`, `CatalogoReparacionConfig`, `AuditLog`, `ConfiguracionSistema`: confirmar si hoy llevan tenant o son globales de facto) y fijar la lista. Output: `src/lib/db/model-classification.ts` con `scoped/global/child` + comentario de justificación por modelo no-scoped.
- [ ] **T2 — Test de contrato (drift).** Test que compara modelos del schema vs clasificación: un modelo nuevo sin clasificar rompe CI.
  `pnpm exec vitest run src/lib/db/__tests__`
- Commit: `feat(db): clasificación formal de modelos por scope tenant (AS-01)`

## AS-02 — Contexto ALS + cliente extendido (núcleo)

- [ ] **T1 — RED unitarios de transformación.** Para cada operación de la matriz (design §2): findMany/findFirst/count/aggregate/groupBy inyectan; findUnique/update/delete usan where extendido; create/createMany inyectan y **rechazan** tenant ajeno (`TenantMismatchError`); upsert compuesto. Sin contexto: `shadow` registra + pasa; `enforce` lanza `TenantContextRequiredError`.
  `pnpm exec vitest run src/lib/db/__tests__/scoped-prisma.test.ts`
- [ ] **T2 — GREEN extensión.** `src/lib/db/tenant-context.ts` (ALS) + `src/lib/db/scoped-prisma.ts` (`$extends` con `query`). Modo vía `TENANT_ISOLATION_MODE` (default `off` hasta el gate).
- [ ] **T3 — Integración real.** `src/lib/db/__integration__/tenant-isolation.test.ts` con dos tenants sembrados: lectura cruzada devuelve vacío, update/delete cruzados no afectan (count 0), create con tenant ajeno falla, nested create (venta+items) validado, transacción interactiva mantiene el scope.
  `DATABASE_URL_TEST=... pnpm test:integration -- src/lib/db/__integration__/tenant-isolation.test.ts`
- [ ] **T4 — Cableado en los 2 entry points.** `authenticateUser` y `withAction` envuelven con `tenantContext.run`; `src/lib/prisma.ts` exporta el cliente extendido con el mismo nombre (compat) + `src/lib/db/platform-prisma.ts` nuevo.
- [ ] **T5 — Extender contrato de mocks.** Actualizar el test `test-isolation-contract` y helpers de mock para cubrir `platform-prisma` y el ALS (`withTestTenant`).
- Commit: `feat(db): cliente Prisma con enforcement sistémico de tenant (AS-02)`

## AS-03 — PrismaPlatform + allowlist + raw SQL

- [ ] **T1 — RED imports.** Test estático: `platform-prisma` solo importable desde la allowlist (auth, admin, seeds, scripts, affiliate/salesAgent, cron). Hoy debe fallar hasta limpiar imports.
- [ ] **T2 — GREEN migración de consumidores legítimos.** Mover a `platform-prisma`: login/register/onboarding, panel admin, seeds, scripts, afiliados, cron; verificar con el test.
- [ ] **T3 — Inventario raw SQL.** Generar lista de `$queryRaw/$executeRaw` existentes → `raw-sql-allowlist.ts` con motivo y garantía de tenant por entrada; test: raw SQL nuevo fuera de la lista rompe CI.
- Commit: `feat(db): prismaPlatform con allowlist e inventario de raw SQL (AS-03)`

## AS-04 — Modo shadow y saneamiento de violaciones

- [ ] **T1 — Activar shadow en CI/local.** Suite acotada de features críticos (ventas, productos, contabilidad, contratos, ofertas) con `TENANT_ISOLATION_MODE=shadow`; exportar reporte de violaciones.
  `pnpm exec vitest run src/features/ventas src/features/contabilidad src/features/productos src/features/contratos src/features/ofertas`
- [ ] **T2 — Corregir violaciones reales.** Cada violación del reporte se corrige a nivel aplicación (la mayoría deberían ser cero tras Correcciones Urgentes; las numeraciones globales de contratos/transferencias se corrigen aquí si F-01 no las cubrió). Tests RED→GREEN por violación.
- [ ] **T3 — Shadow en staging/prod.** Deploy con shadow + observación (umbral: 0 violaciones inesperadas durante ≥7 días). Gate P-1: aprobación explícita del usuario con el reporte.
- Commit: `fix(*): saneamiento de violaciones detectadas en modo shadow (AS-04)`

## AS-05 — Denormalización de tenantId en modelos child/audit (olas)

Por modelo (prioridad: `TransaccionMoneda` → `AlertHistory`/`ReportHistory`/`ScheduledReport`/`ScenarioSimulation` → `InyeccionCapital`/`PagoDeuda`/`SaldoSnapshot` → `ProductoCostHistory`/`AnticipoMovimiento`):

- [ ] **T-x.1** Migración aditiva `tenantId String?` + índice (create-only + revisión).
- [ ] **T-x.2** Backfill dry-run (conteos resolubles/ambiguos/huérfanos desde el padre) → ejecución aprobada (gate). Escritura dual en writers.
- [ ] **T-x.3** Mover el modelo a `scoped` en la clasificación; test de integración; NOT NULL solo cuando el 100% esté resuelto.
- Commits por modelo: `feat(db): tenant-denormalization <modelo> (AS-05)`

## AS-06 — Enforce + cierre

> **Desbloqueada por pre-enforce-hardening — no ejecutada — 2026-09-12.** Dependencia operativa satisfecha por
> `pre-enforce-hardening`: commits PE-01 `2fc4c1b`, PE-02 `c0ee09d`, PE-03
> `42934dca` y PE-04 `592df816`. Evidencia PE-04: suite real **8/8** en enforce y
> shadow, cleanup **0** residuos, Railway production `TENANT_ISOLATION_MODE=shadow`
> verificado con HTTP 200 y ventana desde `2026-09-12T05:02:57.021Z` UTC;
> detalle archivado en `openspec/changes/archive/2026-09-12-pre-enforce-hardening/`.
> Esta nota desbloquea el gate para ejecución posterior; no activa ni marca AS-06
> como aplicada/completa.

- [ ] **T1 — Regresión enforce.** Suite acotada con `TENANT_ISOLATION_MODE=enforce` verde; Playwright smoke de flujo crítico (venta completa) si aplica.
- [ ] **T2 — Activar enforce.** Por entorno; rollback = volver a `shadow` sin tocar datos.
- [ ] **T3 — Documentar y archivar.** Actualizar `model-classification.ts` final, README del módulo `src/lib/db/`, memorias (`tcp-vs-odoo-multitenant-audit`: gap cerrado), mover change a `openspec/changes/archive/`.
- Commit: `feat(db): activar enforce de aislamiento tenant y cerrar change (AS-06)`

## Gates con aprobación del usuario

- **P-1 (tras AS-04-T3):** activar enforce solo con reporte shadow limpio ≥7 días en producción.
- **P-2 (por cada backfill AS-05):** aprobar ejecución tras revisar dry-run (conteos y regla de unicidad).
- **P-3 (AS-02 antes de merge):** revisión del SQL/índices y del diff de `src/lib/prisma.ts` + auth-middleware.

## Estimación (referencial)

| Fase | Producción | Tests | Schema/Scripts |
|---|---|---|---|
| AS-01 | ~120 (clasificación) | ~80 | — |
| AS-02 | ~350 (extensión+ALS+entrypoints) | ~400 | — |
| AS-03 | ~120 | ~120 | — |
| AS-04 | ~150 (correcciones) | ~150 | — |
| AS-05 | ~200 (10 modelos) | ~250 | ~10 migraciones + scripts |
| AS-06 | ~60 | ~80 | — |

Riesgo concentrado en AS-02 (núcleo) y AS-05 (datos). Mitigación: shadow-first y backfills con dry-run aprobado.
