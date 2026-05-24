# Proposal: Tanda 2 — Apertura Formal, Jerarquía y Aprobación Multinivel

## Intent

Agregar los modelos y lógica de la rama legacy que dan valor contable real: apertura formal con arrastre de saldos, jerarquía explícita de períodos (DIARIO → MENSUAL → ANUAL) y aprobación multinivel.

## Scope

### Incluye (5 items)

1. **Jerarquía explícita con `periodoPadreId`** — Períodos se organizan en árbol: DIARIO hijo de MENSUAL, MENSUAL hijo de ANUAL. Al cerrar un período padre, todos sus hijos deben estar cerrados. La validación de `validarHijosCerrados()` remplaza la actual búsqueda genérica por fechas.

2. **`AperturaPeriodo` model** — Asiento de apertura formal con desglose de saldos: caja, banco, cuentas por cobrar, cuentas por pagar, inventario, capital, resultados acumulados. Se genera al abrir un período, arrastrando saldos del período anterior o usando datos vivos si es el primero.

3. **Aprobación multinivel** — Después de CERRADO, el período pasa a APROBADO. Validación: quien cerró el período NO puede ser quien lo aprueba (segregación de funciones). `segundoAprobadorId` permite doble aprobación opcional.

4. **Auditoría por transición** — Cada cambio de estado registra quién lo hizo en campos dedicados (`abiertoPorId`, `cerradoPor`, `aprobadoPor`, `reabiertoPorId`). Complementa la auditoría existente en `AuditoriaPeriodo`.

5. **`codigo` único por tenant** — Código legible como `M-2026-03`, `D-2026-03-15`, `A-2026`. Reemplaza la dependencia de `@@unique([tenantId, tipo, fechaInicio, fechaFin])`.

### Excluye
- `SnapshotPeriodo` versionado (ya tenemos SaldoSnapshot + resumenJson/hashIntegridad de Tanda 1)
- `categoria` fiscal / `cierreAutomatico` (complejidad extra sin valor inmediato)
- Períodos DIARIOS como feature activo (solo se crean como hijos de MENSUAL)

## Schema Changes

```prisma
model PeriodoContable {
  // Existente:
  periodoId        String    @id @default(cuid())
  tenantId         String
  tipo             TipoPeriodo
  fechaInicio      DateTime
  fechaFin         DateTime
  estado           EstadoPeriodo @default(BORRADOR)
  observaciones    String?
  resumenJson      Json?
  hashIntegridad   String?
  cerradoPor       String?
  cerradoAt        DateTime?
  aprobadoPor      String?
  aprobadoAt       DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  // NUEVOS:
  codigo           String             /// ej: "M-2026-03", "D-2026-03-15"
  periodoPadreId   String?
  abiertoPorId     String?
  fechaApertura    DateTime?
  reabiertoPorId   String?
  fechaReapertura  DateTime?
  segundoAprobadorId String?
  aperturaAutomatica Boolean @default(false)
  motivoReapertura String?

  // Relaciones
  tenant           Tenant             @relation(fields: [tenantId], references: [tenantId])
  snapshots        SaldoSnapshot[]
  auditoria        AuditoriaPeriodo[]
  periodoPadre     PeriodoContable?   @relation("PeriodoHierarchy", fields: [periodoPadreId], references: [periodoId], onDelete: SetNull)
  subperiodos      PeriodoContable[]  @relation("PeriodoHierarchy")
  apertura         AperturaPeriodo?

  @@unique([tenantId, codigo])
  @@index([tenantId, estado])
  @@index([tenantId, periodoPadreId])
  @@map("periodos_contables")
}

model AperturaPeriodo {
  aperturaId                String   @id @default(cuid())
  periodoId                 String   @unique
  tenantId                  String
  origenPeriodoId           String?
  saldoCajaInicial          Decimal  @default(0)
  saldoBancoInicial         Decimal  @default(0)
  saldoCuentasCobrarInicial Decimal  @default(0)
  saldoCuentasPagarInicial  Decimal  @default(0)
  saldoInventarioInicial    Decimal  @default(0)
  saldoCapitalInicial       Decimal  @default(0)
  saldoResultadoAcumInicial Decimal  @default(0)
  detalleJson               Json?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  periodo    PeriodoContable @relation(fields: [periodoId], references: [periodoId], onDelete: Cascade)
  tenant     Tenant          @relation(fields: [tenantId], references: [tenantId])

  @@index([tenantId])
  @@index([origenPeriodoId])
  @@map("apertura_periodos")
}
```

## Flujos actualizados

### Abrir Período
1. Generar `codigo` (buildPeriodCode)
2. Buscar período padre por fecha (para MENSUAL, padre = ANUAL que contiene sus fechas)
3. Crear período en BORRADOR → ABIERTO
4. Crear `AperturaPeriodo` con saldos arrastrados del período anterior (o vivos)
5. Registrar `abiertoPorId` + `fechaApertura`
6. Auditoría

### Cerrar Período
1. Validar que todos los `subperiodos` (hijos) están CERRADOS o APROBADOS
2. Generar snapshot + resumen (Tanda 1)
3. Cerrar período con `cerradoPor` + `cerradoAt`
4. Auditoría

### Aprobar Período (NUEVA validación)
1. Solo desde CERRADO
2. Validar que `cerradoPor !== usuarioId` (quien cierra no puede aprobar)
3. Si ya tiene `aprobadoPor`, es segunda aprobación → registrar `segundoAprobadorId`
4. Auditoría

## Tradeoffs

| Item | Riesgo | Mitigación |
|------|--------|-----------|
| Migración con datos existentes | Períodos existentes no tienen codigo | Generar codigo retroactivo en migration script |
| Jerarquía para períodos existentes | No tienen periodoPadreId | Migración con valor null (backfill opcional) |
| AperturaPeriodo para existentes | Nuevos períodos tendrán apertura, existentes no | AperturaPeriodo es opcional (relación 1:1 opcional) |
