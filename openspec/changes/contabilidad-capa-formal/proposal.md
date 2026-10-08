# Propuesta — Capa de contabilidad formal (plan de cuentas + partida doble) sobre la base caja

## Decisión ejecutiva

Añadir a TCP una **capa de contabilidad formal** —plan de cuentas, diarios, asientos de partida doble— construida como **capa aditiva sobre la base caja existente**: cada evento de negocio que hoy produce una reconciliación (venta, cobro, pago, gasto, compra, nómina, préstamo, deuda, anticipo, ajuste, transferencia, inyección de capital) generará **además** su asiento contable, **dentro de la misma transacción Prisma**, desde una plantilla de mapeo evento→cuentas configurable por tenant. La base caja no se reescribe: sigue siendo la fuente operativa y de reportes actuales; la capa formal es el registro auditable que un contador puede examinar (libro diario, mayor, balance de comprobación) y desde el cual el Balance y el P&L pasan a tener soporte línea a línea. Rollout gobernado igual que los cambios estructurales anteriores: feature flag por plan + modo `shadow` (asienta en silencio y mide) antes de `enforce`, sin riesgo para la operación en producción.

## Why

Verificado contra el código el 2026-09-21 durante la comparativa TCP vs Odoo (dominio Contabilidad): **ninguna fila del análisis ha cambiado**. El estado real hoy:

1. **No existe plan de cuentas ni partida doble.** Entre los 142 modelos del schema no hay ninguno de contabilidad formal (`CuentaContable`/`Diario`/`Asiento`); una búsqueda exhaustiva de "asiento contable" en `src/` solo encuentra comentarios en documentación. TCP es un libro de caja con reconciliaciones tipificadas: sólido operativamente, pero no es contabilidad que un contable/fiscalista pueda llevar a una declaración.
2. **Los reportes financieros son derivados por cálculo, no por registro.** El balance y el P&L de `balance-results-report-service` agregan operaciones (efectivo, inventario, CxC/CxP, patrimonio, ecuación cuadrada) sin rastro auditable asiento por asiento: no hay libro mayor ni balance de comprobación posibles.
3. **La diferencia cambiaria solo se reporta, no se asienta** — y no puede asentarse porque no hay dónde. Es la única pérdida/ganancia económica real del sistema que hoy no tiene contrapartida registrable.
4. **La fortaleza competitiva ya construida exige destino formal.** El cierre gobernado (doble aprobación, hash SHA256, `INTENTO_BYPASS`, advisory locks) y la evidencia FX inmutable son piezas de nivel SOX-light que hoy protegen… un libro de caja. La infraestructura ya supera a Odoo; lo que falta es que lo que protege sea contabilidad de verdad.

Hechos medidos del sistema actual (2026-09-21):

- **142 modelos** Prisma; **0** de contabilidad formal.
- **18 archivos** crean reconciliaciones (fuentes de posteo): 7 rutas API legacy (`/api/contabilidad/*`, producción) y 11 server actions/services (`contabilidad`, `ventas`, `compras-*`, `pago-salario` vía gastos, `productos` restock, `venta-servicios`, workflows de facturación y pago de gastos).
- **3 modelos de reconciliación** (`ReconciliacionVenta/Servicio/Gasto`) que **ya llevan incrustada la evidencia FX** (`fxEvidenceJson`, `fxEvidenceFingerprint`, `montoConvertido`, tasa y procedencia): cada asiento puede heredarla sin abrir el problema multimoneda.
- Infraestructura reutilizable ya en producción: guard de períodos con 3 modos y `INTENTO_BYPASS`, `PeriodoContable` con `modoContable: CAJA|DEVENGO` y snapshots duales (`baseCajaJson`/`baseDevengoJson`), `AccountingTenantLockService` (advisory locks), feature flags por plan (`contabilidad`), y `AperturaPeriodo` con saldos iniciales por rubro (caja, banco, CxC, CxP, inventario, capital, resultados acumulados) — exactamente los saldos de apertura de un plan de cuentas.

## What Changes

_(Qué cambia)_

| Hoy | Objetivo |
|---|---|
| Libro de caja con reconciliaciones tipificadas | Las mismas reconciliaciones **más** su asiento de partida doble generado en la misma transacción |
| Balance/P&L derivados por cálculo, sin drill-down | Balance/P&L con soporte en asientos; los reportes calculados actuales quedan como **conciliación cruzada** (caja ↔ cuentas deben cuadrar) |
| Diferencia cambiaria reportada, no asentada | Asiento automático en cuentas de resultado cambiario, con `fxEvidenceFingerprint` heredado |
| Cierres protegen la caja | Los cierres cierran también el libro: guard de períodos intercepta los asientos, asiento de cierre/apertura automático, hash encadenado por tenant |
| "La contabilidad la llevan aparte" (o en Excel) | Libro diario, mayor y balance de comprobación descargables desde el sistema |

## No-goals

- **No se reescribe ni se depreca la base caja.** Los 18 writers siguen funcionando igual; el asiento es un efecto adicional dentro de su transacción. Ningún reporte actual cambia de fuente en esta serie.
- **No se implementa en esta serie:** motor de impuestos (IVA/retenciones/declaraciones), importación de extractos bancarios y matching, activos fijos/depreciación, presupuestos/centros de costo/analítica. Quedan como series posteriores (orden sugerido en el análisis: extractos → impuestos → activos fijos → presupuestos); la capa formal es **prerequisito** de impuestos y de activos fijos.
- **No se introduce contabilidad multi-compañía ni consolidación** entre tenants.
- **No se modifica el comportamiento de ventas/precios (LP-0)** ni los flujos del POS.
- **No se exige migración histórica obligatoria:** el backfill (CTA-4) es opt-in por tenant; el sistema es plenamente operativo partiendo del período en curso.

## Solución propuesta (resumen; detalle en design.md)

Serie **CTA** en 5 fases:

1. **CTA-0 — Modelo de datos y plan de cuentas.** Modelos nuevos (aditivos): `CuentaContable` (árbol por tenant con naturaleza deudora/acreedora y tipo activo/pasivo/patrimonio/ingreso/costo/gasto), `Diario` (ventas, compras, caja, bancos, nómina, ajustes, apertura/cierre), `Asiento` + `AsientoLinea` (debe/haber, moneda original y funcional, tasa, fingerprint FX, hash encadenado por tenant, idempotencia por `@@unique([tenantId, origenTipo, origenId])`), `PlantillaAsiento` (evento → líneas por rol de cuenta, seeds globales) y `CuentaRolTenant` (rol semántico → cuenta real del tenant, ej. `CAJA_PRINCIPAL → 1.1.01.001`). Plan por defecto estilo PyME (≈40 cuentas) sembrado al activar el flag. Constraint de cuadre: Σdebe = Σhaber validado en servicio dentro de la transacción.
2. **CTA-1 — Motor de asientos (posting engine) + hooks.** Servicio puro `posting-engine` que dado un evento tipado (≈20 eventos: venta contado/crédito, cobro CxC, compra, pago CxP, gasto, nómina, anticipos, préstamo/cobro con interés, deuda/pago con interés, ajustes, transferencias, inyección de capital, costo de venta FIFO, merma, producción, diferencia cambiaria) resuelve plantilla + roles → asiento cuadrado. Integración: una llamada `postEvento(tx, evento)` dentro de cada una de las 18 transacciones writer existentes; el guard de períodos valida la fecha del asiento (período cerrado → rechazo con `INTENTO_BYPASS` ya auditado).
3. **CTA-2 — Libros formales.** Libro diario (paginado, filtrable por diario/período), libro mayor por cuenta con saldo corrido, balance de comprobación de 4 columnas (sumas y saldos), Balance/P&L desde cuentas, y panel de conciliación cruzada caja↔cuentas que explota el balance calculado actual como control.
4. **CTA-3 — Cierre formal.** Asiento de cierre (resultados → resultado del ejercicio) al aprobar el cierre y asiento de apertura (saldos iniciales desde `AperturaPeriodo`) al abrir el período siguiente; hash de período extendido al diario.
5. **CTA-4 — Backfill histórico (opt-in).** Replay cronológico de fuentes → asientos para períodos anteriores, con comparativa contra el balance calculado y snapshot; requiere período en estado controlado y advisory lock.

## Impact

_(Impacto sobre el sistema actual — medido, no estimado)_

| Elemento | Magnitud real | Afectación |
|---|---|---|
| Schema | 142 modelos | **+6 modelos formales aditivos**. La remediación R0.5 agrega snapshots FX nullable a AjusteBancario, TransferenciaBancaria, InyeccionCapital, PagoDeuda y CompraDocumento; migraciones aditivas, sin backfill inferido ni borrado de datos. |
| Writers de reconciliación | 18 archivos | Cada uno recibe **una llamada** `postEvento(tx, …)` dentro de su transacción; en modo `off` la función retorna sin hacer nada (guardia de flag al inicio) |
| Guard de períodos | 1 servicio + 3 modos | Reutilizado tal cual: los asientos pasan por `verificarEscritura` con `tipoOperacion: 'asiento'` |
| Multimoneda | FxEvidence en las 3 reconciliaciones y evidencia en fuentes adicionales si carecen de snapshot | El asiento hereda `fxEvidenceFingerprint`; la capa **no** recalcula tasas. Una fuente sin evidencia persistida no se postea en moneda extranjera. |
| Feature flags | `contabilidad` existe en el registry | Nuevo flag `contabilidad-formal` (par activable por plan/tenant) |
| Tests unitarios | suite con prisma mockeado obligatorio | Los nuevos tests mockean prisma vía contrato existente; la cuadratura real va a `__integration__` contra `DATABASE_URL_TEST` |
| Legacy APIs | 7 rutas `/api/contabilidad/*` | Mismo hook; no se crean rutas nuevas de escritura en esta serie (los libros se sirven por server actions) |

## Criterios de aceptación

1. **Cuadre garantizado:** imposible persistir un asiento descuadrado (validación en transacción; test de integración que intenta forzarlo falla RED→GREEN). En `enforce`, todo evento de negocio deja asiento y todo asiento cuadra y referencia su fuente (`origenTipo/origenId` únicos por tenant).
2. **Idempotencia:** reintentar el mismo evento no duplica asientos (unique constraint + replay seguro).
3. **Libros completos:** para un período cualquiera se generan libro diario, mayor de cualquier cuenta y balance de comprobación; la suma de saldos deudores = acreedores en todo momento.
4. **Conciliación cruzada:** el total de saldos por rubro desde cuentas coincide con el balance calculado (caja, bancos, inventario, CxC, CxP, capital) dentro de tolerancia documentada; discrepancias se muestran en el panel, no se ocultan.
5. **Gobernanza extendida:** un intento de asiento en período cerrado queda en `AuditoriaPeriodo` como `INTENTO_BYPASS`; el hash encadenado detecta alteración de cualquier asiento histórico (test RED→GREEN).
6. **Diferencia cambiaria asentada:** cobro con tasa distinta a la de reconocimiento genera líneas en cuentas de resultado cambiario con fingerprint heredado.
7. **Cero regresión:** suite acotada de contabilidad/ventas/compras verde con flag `off` y con `enforce` (shadow no puede romper nada por construcción).
8. **Aislamiento:** asientos de un tenant invisibles para otro (tests de integración; los modelos nuevos nacen clasificados `scoped` en la clasificación AS).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Doctores contables de cada país esperan planes distintos | El plan por defecto es una plantilla editable: cuentas renombrables/desactivables y roles remapeables por tenant desde UI; la semántica vive en los **roles**, no en los códigos |
| Rendimiento: +1 asiento por evento dentro de transacciones ya pesadas (ventas) | El motor es in-memory hasta el insert; un asiento típico = 2–4 líneas. Medir en staging; shadow corre primero con contadores de latencia |
| Eventos sin mapeo correcto descuadran la conciliación | Modo shadow precisamente para descubrirlo; panel de conciliación cruzada como radiografía permanente; plantillas versionadas |
| Datos históricos inconsistentes (ventas sin reconciliar, fx faltante) rompen el backfill | CTA-4 es opt-in, dry-run con conteos de omitidos/ambigüedad (patrón backfill AS-05); nunca bloquea el uso desde el período en curso |
| Divergencia caja↔asientos por bugs del motor | En shadow el motor loguea y **nunca** lanza excepción que afecte la operación; enforce solo tras gate con reporte de cobertura de eventos |

## Rollback

En cualquier fase: flag `contabilidad-formal` a `off` (o `CONTABILIDAD_FORMAL_MODE=off`) devuelve el sistema a su comportamiento actual; las tablas nuevas son aditivas y ningún flujo existente las lee. Rollback total en desarrollo: migración reversible que elimina las 6 tablas sin tocar datos operativos. No hay cambios destructivos ni backfills obligatorios en ninguna fase.

## Addendum de remediación — 2026-09-23 (Explore #3899)

**Estado:** CTA-0–CTA-4 tienen tareas marcadas como hechas, pero eso no constituye aceptación. El typecheck actual falla (~34 errores, incluidos `PostingTx`/`CierreTx` incompatibles con `Prisma.TransactionClient`); los hallazgos siguientes bloquean `enforce` y el cierre del change. Esta propuesta reemplaza la lectura optimista de los criterios y del rollback anteriores: no se declara lista la capa formal hasta verificar los gates con evidencia.

### Intent y alcance

Terminar la capa existente mediante correcciones de raíz y TDD estricto (RED reproducible → GREEN → regresión), sin reescribir la base caja ni alterar datos históricos automáticamente. Dentro del alcance: corregir compilación y contratos de transacción; comparación `Decimal` exacta en posteo y conciliación; fail-closed de `enforce` si falta plan/roles; cierre/apertura con signo, período anterior correcto, fecha válida y cuadre; replay de merma con valoración real y dry-run honesto (ambiguos/sin FX); gate persistente y autorización explícita del replay con `replayRunId` y conciliación posterior; actor real en auditoría del guard; completar observabilidad shadow, suites, documentación y gate operativo. Fuera del alcance: nuevos impuestos, cambio de fuente de reportes caja, migración histórica forzosa y habilitar `enforce` por defecto.

### Invariantes y límites de validación

- En `enforce`, cada evento soportado MUST producir un asiento cuadrado o rechazar **toda** la transacción; plan no inicializado, plantilla/rol ausente o dato de valoración insuficiente nunca equivalen a éxito. `off` mantiene no-op; `shadow` no rompe la operación, pero registra evento, resultado y causa verificables.
- Debe/haber y conciliación se calculan en `Decimal` a la precisión funcional acordada, sin conversión a `number` ni epsilon que oculte diferencias. Descuadre ≠ conciliación verde; cualquier tolerancia de presentación se separa de la integridad del libro.
- Cierre y apertura deben usar saldos con signo y contraasientos positivos, soportar utilidad y pérdida, respetar la fecha contable del período y referirse solo al período inmediatamente anterior del mismo tenant; no insertar si la apertura no cuadra.
- Replay se restringe a tenant/período y autorización verificable: preflight persistido y vinculado a la ejecución, lock, origen idempotente, `replayRunId`, conteos completos y conciliación post-run con evidencia. Sin costo de merma derivable o FX indispensable, marcar bloqueado/ambiguo; nunca postear importe cero por defecto.
- El guard conserva `INTENTO_BYPASS` con identidad del actor autenticado y contexto de operación, no `system` para llamadas de usuario. Acciones/servicios validan tenant y permisos en servidor; la UI solo muestra estados y errores en español neutro.

### Approach y áreas afectadas

| Área | Cambio propuesto / frontera |
|---|---|
| `src/features/contabilidad-formal/services/posting-engine.ts`, `asiento-service.ts` | Tipar `tx` contra el cliente transaccional real; convertir errores de configuración en rechazo en `enforce`; cuadre Decimal exacto, pruebas por modo y reintento. |
| `src/features/contabilidad-formal/services/cierre-formal-service.ts`, `src/features/contabilidad/actions-periodos.ts` | Corregir signo, período y fecha en la transición transaccional; impedir cierre/apertura incorrectos y demostrar ambos resultados con pruebas. |
| `src/features/contabilidad-formal/services/replay-backfill-service.ts`, `actions-backfill.ts` | Valoración de merma desde fuente válida, preflight persistente/confirmación, trazabilidad del run, conteos y conciliación antes de declarar completado. |
| `src/lib/services/periodo-contable-guard.ts` | Propagar actor autenticado al audit trail, sin degradar el bloqueo de períodos. |
| `src/features/contabilidad-formal/actions-health.ts`, `content/docs/modules/contabilidad/`, `docs/GLOSSARY.md` | Telemetría shadow por tipo/causa, reporte de cobertura y procedimiento de operación, incidentes y activación. |
| Tests en `src/features/contabilidad-formal/` y `__integration__/`, writers relacionados | Casos RED para invariantes, pruebas unitarias con prisma mockeado y pruebas reales solo con `DATABASE_URL_TEST`; completar suites de regresión y typecheck/lint. |

Secuencia: baseline de errores y tests RED → tipos y fail-closed/cuadre → cierre/apertura y actor → replay y gate → observabilidad, documentación y suites → shadow medido antes de cualquier `enforce`. Actualizar specs, design y tasks para reflejar los contratos definitivos antes de implementar; no se altera código en esta fase.

### Riesgos, decisiones pendientes y mitigaciones

| Riesgo / decisión | Mitigación o resolución requerida |
|---|---|
| `shadow` puede escribir parcialmente antes de capturar un error y contaminar la transacción. | Definir savepoint/transacción compatible o simulación sin persistencia y probar fallo intermedio sin afectar operación ni dejar asientos incompletos. |
| Cuadre exacto descubre desfases por redondeo monetario. | Decidir escala y regla de redondeo funcional en specs; ajustar en origen de líneas antes de persistir, sin epsilon silencioso. |
| Replay sobre períodos cerrados elude guard normal. | Decidir quién autoriza y vigencia del preflight, condiciones para aborto por ambiguos/sin FX y reconciliación requerida; auditar excepción y no abrir escritura general. |
| Rollback después de asientos/backfill publicados no se resuelve borrando tablas. | `off` detiene nuevos posteos sin borrar evidencia; congelar/conciliar lo existente, revertir asientos solo mediante contrapartidas auditadas si corresponde. Destruir tablas únicamente en desarrollo sin datos contables publicados. |
| Errores de TypeScript adicionales y writers incompletos impiden evaluar cobertura real. | Inventario con baseline, arreglar causas raíz, demostrar typecheck limpio (sin errores preexistentes ocultos) y matriz de eventos/writers antes de activar. |

### Criterios de salida y rollback operativo

- [ ] RED→GREEN por cada fallo descrito, incluida pérdida, cierre sin período anterior, fecha límite, merma sin valoración, actor real, falta de plan y shadow fallido; evidencia guardada en tasks/verificación.
- [ ] Typecheck completo verde (con memoria suficiente), lint y suites focalizadas/relacionadas verdes; integración real aislada y sin acceso a base real desde tests unitarios.
- [ ] Dry-run clasifica todos los eventos en replayables, omitidos, ambiguos o sin FX; ejecución requiere confirmación ligada al plan y produce `replayRunId` y comparación post-run verificable.
- [ ] Shadow con métricas por evento, latencia, fallos y conciliación por tenant; **≥1 semana** de evidencia verde antes de aprobar `enforce` tenant por tenant, con responsable y criterio de reversión documentados.
- [ ] Ante discrepancia o error en producción: desactivar `enforce`/volver a `off` para el tenant afectado, preservar asientos y evidencia, bloquear nuevos replay y abrir conciliación; no ejecutar rollback de schema ni borrar registros publicados. Reactivar solo tras diagnóstico, corrección probada y nuevo gate shadow.
