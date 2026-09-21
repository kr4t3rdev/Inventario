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
| Schema | 142 modelos | **+6 modelos aditivos**, ninguno toca tablas existentes; una migración `--create-only` + revisión SQL (protocolo ya usado en fx-evidence) |
| Writers de reconciliación | 18 archivos | Cada uno recibe **una llamada** `postEvento(tx, …)` dentro de su transacción; en modo `off` la función retorna sin hacer nada (guardia de flag al inicio) |
| Guard de períodos | 1 servicio + 3 modos | Reutilizado tal cual: los asientos pasan por `verificarEscritura` con `tipoOperacion: 'asiento'` |
| Multimoneda | FxEvidence en las 3 reconciliaciones | El asiento hereda `fxEvidenceFingerprint`; la capa **no** recalcula tasas |
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
