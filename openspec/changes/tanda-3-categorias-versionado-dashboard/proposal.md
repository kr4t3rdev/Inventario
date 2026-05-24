# Proposal: Tanda 3 — Categoría Fiscal, Snapshot Versionado, Dashboard

## Intent

Completar los 3 features restantes del gap con la rama legacy (excluyendo subledger completo que se tratará aparte).

---

## Item 1: Categoría Fiscal en Períodos

### Qué
Agregar campo `categoria` a `PeriodoContable` para clasificación fiscal:
- **ORDINARIO** — Período contable estándar (default)
- **EXTRAORDINARIO** — Período fuera del ciclo normal (ej: cierre anticipado)
- **RECTIFICATIVO** — Período para correcciones de ejercicios anteriores

### Cómo
- Prisma enum `CategoriaPeriodo` con los 3 valores
- Campo `categoria CategoriaPeriodo @default(ORDINARIO)` en `PeriodoContable`
- En `abrirPeriodo` service: aceptar `categoria` opcional en input (default ORDINARIO)
- En `abrirPeriodoAction`: agregar campo al schema Zod
- En UI: mostrar badge de categoría en listado, selector al crear
- `prisma db push`

### Archivos
- `prisma/schema.prisma` — enum + campo
- `src/lib/services/periodo-contable-types.ts` — opcional: re-export del enum
- `src/lib/services/periodo-contable-service.ts` — input acepta categoria
- `src/features/contabilidad/actions-periodos.ts` — schema Zod
- `src/features/contabilidad/components/periodos/periodos-page-client.tsx`
- `src/features/contabilidad/components/periodos/abrir-periodo-dialog.tsx`

---

## Item 2: SnapshotPeriodo Versionado

### Qué
Agregar modelo `SnapshotPeriodo` para historificar versiones de snapshots de cierre.
Cada vez que se cierra (o re-cierra) un período, se crea un nuevo SnapshotPeriodo
con versión auto-incremental.

### Schema

```prisma
model SnapshotPeriodo {
  snapshotId          String   @id @default(cuid())
  periodoId           String
  version             Int      @default(1)
  baseCajaJson        Json?    /// Datos crudos del snapshot en base caja
  baseDevengoJson     Json?    /// Datos crudos del snapshot en base devengo
  resumenJson         Json?    /// Resumen agregado (mismo que PeriodoContable.resumenJson)
  hashIntegridad      String?  /// SHA256 del resumenJson
  createdAt           DateTime @default(now())

  periodo  PeriodoContable @relation(fields: [periodoId], references: [periodoId], onDelete: Cascade)

  @@unique([periodoId, version])
  @@index([periodoId, createdAt])
  @@map("snapshot_periodos")
}
```

### Flujo actualizado en `cerrarPeriodoAction`
1. Generar `SaldoSnapshot[]` (existente)
2. Generar `resumenJson` + `hashIntegridad` (existente)
3. Persistir `resumenJson`/`hashIntegridad` en `PeriodoContable` (existente)
4. **NUEVO**: Determinar próxima versión (`max(version) + 1`)
5. **NUEVO**: Crear `SnapshotPeriodo` con versión, snapshots serializados, resumen, hash

### Dependencias
- Item 1 no requiere (schema independiente)

---

## Item 3: Dashboard de Períodos

### Qué
Nueva vista/resumen en la sección de contabilidad con indicadores de estado
de todos los períodos: cuáles están listos para cerrar, cuáles tienen blockers,
y un timeline visual del ciclo contable.

### Componentes
1. **Summary cards**: total períodos por estado (ABIERTO, CERRADO, APROBADO, REABIERTO)
2. **Close readiness**: períodos ABIERTO sin blockers → "Listos para cerrar"
3. **Issues**: períodos con blockers (sin hash, hijos abiertos, etc.)
4. **Últimos cierres**: timeline de los últimos N cierres/aprobaciones
5. **Jerarquía visual**: árbol ANUAL → MENSUAL → DIARIO con indicador de estado

### Datos
- Nueva Server Action `obtenerDashboardPeriodosAction` que consulta:
  - `GROUP BY estado` para counts
  - Períodos con blockers (join con auditoría, chequeo de hash)
  - Últimos 10 eventos de cierre/aprobación
- Reusa `listarPeriodosAction` existente para datos de tabla

### UI
- Nuevo componente `PeriodosDashboard` en la carpeta de componentes
- Sección de cards + sección de tabla (reusa la existente)
- Enlace desde la página de períodos o como vista alternativa

### Archivos
- `src/features/contabilidad/actions-periodos.ts` — nueva action
- `src/features/contabilidad/components/periodos/periodos-dashboard.tsx` — NUEVO
- `src/features/contabilidad/components/periodos/` — posible refactor

---

## Orden de Implementación

1. **Item 1** → schema `prisma db push` → service → actions → UI
2. **Item 2** → schema `prisma db push` → service → actions → tests
3. **Item 3** → action → UI → tests

Sin dependencias entre items, excepto que Item 2 comparte el schema push.
