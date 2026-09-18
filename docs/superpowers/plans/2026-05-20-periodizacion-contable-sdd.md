# Periodización Contable SDD Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Incorporar periodización contable real al módulo de contabilidad para habilitar
aperturas y cierres diarios, mensuales y anuales con bloqueo efectivo de operaciones fuera
de período.

**Architecture:** El cambio se construye en capas. Primero se define un modelo de período
explícito con estados y jerarquía; después se agrega un guard central que valide cualquier
escritura contable; luego se conectan aperturas/cierres, snapshots y auditoría; por último
se migran los flujos legacy y la UI. El objetivo es que `createdAt` deje de ser la verdad
contable y pase a existir una fecha/periodo canónico por operación.

**Tech Stack:** Next.js 16, TypeScript estricto, Prisma, Server Actions, route handlers
legacy, Vitest, Playwright, Tailwind CSS, Radix/shadcn UI.

---

## Contexto funcional

Hoy el módulo de contabilidad:
- calcula cierres legacy con `CierreContable`;
- filtra movimientos por `createdAt`, `fechaReconciliacion`, `fechaTransferencia`, etc.;
- usa `periodo` en algunas tablas, pero sin una regla central;
- no impide escrituras tardías cuando un período ya debería estar cerrado.

La referencia previa ya existe en:
- `docs/plans/2026-04-23-periodos-contables-design.md`

Ese diseño propone un enfoque mixto caja/devengo y entidades como `PeriodoContable`,
`AperturaPeriodo`, `SnapshotPeriodo` y `AuditoriaPeriodo`. Este plan convierte esa idea en
una ruta de implementación concreta.

---

## SDD Phase 0: `sdd-init` ya completado

**Estado actual**
- stack detectado;
- Strict TDD activo;
- persistencia recomendada: `hybrid`;
- exploración inicial del módulo contable ya hecha;
- memoria persistida en Engram para contexto y descubrimientos.

**Checkpoint de memoria**
- guardar el resumen de esta fase en Engram con `topic_key: workflow/periodizacion-contable-plan`.

---

## SDD Phase 1: `sdd-explore`

**Objetivo:** mapear el sistema real de escrituras, cierres y reportes para definir todos
los puntos de control.

### Alcance
- identificar todos los flujos que escriben o agregan información contable;
- listar dónde se usa `periodo` hoy y dónde no;
- separar qué parte es caja, qué parte es devengo y qué parte es legacy;
- detectar qué acciones y handlers pueden saltarse un future guard si no se centraliza.

### Archivos de lectura obligatoria
- `prisma/schema.prisma`
- `src/lib/services/cierreContableService.ts`
- `src/features/contabilidad/actions-cierres.ts`
- `src/features/contabilidad/actions.ts`
- `src/features/contabilidad/actions-reconciliacion.ts`
- `src/features/contabilidad/actions-ajustes-bancarios.ts`
- `src/features/contabilidad/actions-anticipos.ts`
- `src/features/contabilidad/actions-deudas-cash.ts`
- `src/features/contabilidad/actions-prestamos-cash.ts`
- `src/features/cuadre-diario/actions.ts`
- `src/features/contabilidad/api/handlers.ts`
- `src/features/contabilidad/api/handlers-reconciliacion-gastos.ts`
- `src/app/busy/contabilidad/cierres/page.tsx`
- `src/features/contabilidad/components/cierres/*`

### Entregables
- mapa de flujos de escritura;
- mapa de flujos de lectura/reportes;
- inventario de entidades afectadas;
- lista de huecos de validación;
- riesgos de mezcla entre `createdAt`, `periodo` y fechas de negocio.

### Pruebas / verificación
- no hay cambios de código todavía;
- solo lectura y validación del mapa.

### Memoria
- guardar un resumen del mapa de superficie en Engram.

---

## SDD Phase 2: `sdd-propose`

**Objetivo:** definir la estrategia funcional y los tradeoffs antes de tocar schema o
servicios.

### Decisiones a fijar
1. El período contable será explícito y jerárquico:
   - diario
   - mensual
   - anual
2. Solo estados operables podrán recibir escrituras:
   - `ABIERTO`
   - `REABIERTO`
3. El cierre será inmutable una vez aprobado.
4. Reabrir exigirá motivo y auditoría.
5. El sistema usará una zona contable explícita para resolver fechas.

### Política recomendada
- **Caja** para cuadre diario, tesorería y conciliaciones reales.
- **Devengo** para resultado mensual/anual y consistencia fiscal-contable.

### Resultado esperado
- propuesta con alcance, no-alcance, riesgos y tradeoffs;
- decisión sobre convivencia con `CierreContable` legacy:
  - mantenerlo temporalmente como compatibilidad;
  - o mapearlo a una capa nueva de `PeriodoContable`.

### Memoria
- guardar la decisión de enfoque mixto y la compatibilidad con legacy.

---

## SDD Phase 3: `sdd-spec`

**Objetivo:** transformar la propuesta en requisitos verificables.

### Historias / requisitos
- abrir período diario;
- cerrar período diario;
- abrir período mensual;
- cerrar período mensual;
- abrir período anual;
- cerrar período anual;
- reabrir período con control;
- bloquear escritura si el período está cerrado;
- impedir cierre padre si hay hijos abiertos;
- impedir modificación de período aprobado sin reapertura o ajuste;
- registrar auditoría de toda transición.

### Escenarios críticos
- operación con fecha anterior intenta entrar en un período ya cerrado;
- reconciliación intenta usar un mes ya cerrado;
- cierre mensual se intenta ejecutar con diarios abiertos;
- cierre anual se intenta ejecutar con meses abiertos;
- backdating accidental por zona horaria;
- corrección post-cierre.

### Entregable
- spec con escenarios `Dado / Cuando / Entonces`;
- escenarios negativos;
- reglas de auditoría;
- criterios de aceptación.

### Memoria
- guardar el set de reglas finales y casos borde.

---

## SDD Phase 4: `sdd-design`

**Objetivo:** diseñar la arquitectura concreta y la forma de persistencia.

### Nuevo modelo sugerido
#### `PeriodoContable`
- `periodoId`
- `tenantId`
- `tipo` = diario | mensual | anual
- `estado` = BORRADOR | ABIERTO | EN_CIERRE | CERRADO | APROBADO | REABIERTO
- `fechaInicio`
- `fechaFin`
- `padreId?`
- `codigoPeriodo`
- `zonaHoraria`
- `cerradoPor?`
- `aprobadoPor?`
- `observaciones?`

#### `AperturaPeriodo`
- saldos iniciales;
- arrastre desde snapshot previo;
- referencia a caja/bancos/cuentas/inventario/capital.

#### `SnapshotPeriodo`
- foto inmutable del estado al cerrar;
- totales caja/devengo;
- inconsistencias;
- metadata de cierre.

#### `AuditoriaPeriodo`
- evento;
- actor;
- timestamp;
- entidad afectada;
- motivo;
- payload mínimo.

### Servicio central
Crear un servicio de dominio tipo:
- resolver período activo por fecha;
- validar si una operación puede escribirse;
- bloquear operaciones fuera de período;
- cerrar con transacción;
- reabrir con auditoría;
- construir snapshot.

### Puntos de integración obligatorios
- Server Actions de contabilidad;
- legacy route handlers de contabilidad;
- cuadre diario;
- reportes financieros;
- conciliación de gastos, ventas y servicios;
- ajustes bancarios;
- transferencias;
- anticipos;
- deuda/préstamo cash.

### Diseño de migración
1. agregar schema nuevo;
2. agregar servicio sin romper legacy;
3. enganchar guard en flows de escritura;
4. migrar cierres legacy;
5. retirar duplicación.

### Memoria
- guardar la arquitectura aprobada y la estrategia de migración.

---

## SDD Phase 5: `sdd-tasks`

**Objetivo:** partir la implementación en slices chicos, testeables y revisables.

### Task 1: Fundaciones del dominio
**Files**
- `prisma/schema.prisma`
- `src/lib/services/periodo-contable-service.ts`
- `src/lib/services/periodo-contable-types.ts`
- `src/lib/services/__tests__/periodo-contable-service.test.ts`

**Meta**
- reglas puras de apertura/cierre/estado/jerarquía.

### Task 2: Guard central de escrituras
**Files**
- `src/lib/services/periodo-contable-guard.ts`
- `src/features/contabilidad/actions-*.ts`
- `src/features/contabilidad/api/handlers*.ts`

**Meta**
- bloquear cualquier escritura fuera de período.

### Task 3: Apertura y cierre
**Files**
- `src/features/contabilidad/actions-periodos.ts`
- `src/features/contabilidad/components/periodos/*`
- `src/app/busy/contabilidad/periodos/*`

**Meta**
- abrir, cerrar, reabrir, consultar historial.

### Task 4: Snapshots y auditoría
**Files**
- `src/lib/services/periodo-snapshot-service.ts`
- `src/lib/services/periodo-audit-service.ts`
- `src/lib/services/__tests__/periodo-snapshot-service.test.ts`

**Meta**
- garantizar inmutabilidad del cierre y trazabilidad.

### Task 5: Integración con flujo contable real
**Files**
- `src/features/contabilidad/actions-reconciliacion.ts`
- `src/features/contabilidad/actions.ts`
- `src/features/contabilidad/actions-ajustes-bancarios.ts`
- `src/features/contabilidad/actions-anticipos.ts`
- `src/features/contabilidad/actions-deudas-cash.ts`
- `src/features/contabilidad/actions-prestamos-cash.ts`
- `src/features/cuadre-diario/actions.ts`

**Meta**
- que el guard se ejecute en todos los writes críticos.

### Task 6: UI de períodos
**Files**
- `src/app/busy/contabilidad/periodos/page.tsx`
- `src/features/contabilidad/components/periodos/*`

**Meta**
- mostrar estado activo, próximos cierres y bloqueos.

### Task 7: Migración de legacy
**Files**
- `src/features/contabilidad/actions-cierres.ts`
- `src/lib/services/cierreContableService.ts`
- `src/app/busy/contabilidad/cierres/*`

**Meta**
- coexistencia temporal con `CierreContable` y ruta clara de deprecación.

### Memoria
- guardar avance por task y estado de dependencia.

---

## SDD Phase 6: `sdd-apply`

**Objetivo:** implementar con TDD estricto y sin perder progreso entre slices.

### Orden recomendado de implementación
1. modelo + enums + tests de dominio;
2. servicio central;
3. guard de escritura;
4. aperturas/cierres;
5. snapshot/auditoría;
6. integración por módulo;
7. UI;
8. migración legacy.

### Reglas de ejecución
- cada slice debe dejar tests verdes;
- no mezclar migración de schema con UI en el mismo slice;
- si hay progresión por batches, persistir `apply-progress` en Engram.

### Memoria
- guardar el estado al final de cada batch `apply`.

---

## SDD Phase 7: `sdd-verify`

**Objetivo:** demostrar que el sistema bloquea lo que debe bloquear.

### Verificaciones obligatorias
- no escribe en período cerrado;
- no cierra padre con hijos abiertos;
- no reabre sin auditoría;
- no cambia un snapshot aprobado;
- no deja conciliación fuera de período;
- no deja operación tardía entrar por un handler legacy;
- no rompe reportes.

### Tipos de prueba
- unitarias de reglas puras;
- integración de server actions;
- tests de route handlers legacy;
- e2e de apertura/cierre/bloqueo;
- regresión de cierres legacy.

### Memoria
- guardar el informe de verificación y hallazgos residuales.

---

## SDD Phase 8: `sdd-archive`

**Objetivo:** cerrar el cambio y dejarlo recuperable.

### Contenido del archivo de archive
- decisión final sobre el modelo de período;
- rutas migradas;
- compatibilidad legacy retenida o retirada;
- riesgos aceptados;
- próximos pasos si queda deuda.

### Memoria
- guardar el cierre del cambio y el resumen final.

---

## Criterios de éxito globales

El trabajo se considera correcto cuando:
- hay un modelo de período explícito;
- toda escritura contable relevante pasa por un guard central;
- diarios, mensuales y anuales tienen reglas de transición claras;
- un período cerrado no acepta cambios accidentales;
- el sistema puede reabrir con trazabilidad;
- `CierreContable` legacy no puede saltarse la nueva política;
- los reportes siguen funcionando con datos coherentes.

---

## Riesgos que hay que vigilar

- coexistencia de `createdAt` y fechas de negocio;
- handlers legacy que escriben sin pasar por Server Actions;
- estados libres en `CierreContable`;
- diferencias de zona horaria;
- datos históricos que no traen `periodo` consistente;
- cierres recalculados sobre datos vivos sin snapshot.

---

## Próximo paso recomendado

Si seguimos en automático, el siguiente movimiento lógico es:
1. convertir este plan en spec formal;
2. definir el diseño técnico final;
3. arrancar el primer slice de implementación con TDD.
