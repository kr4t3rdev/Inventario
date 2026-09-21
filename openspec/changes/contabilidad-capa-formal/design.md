# Diseño técnico — Capa de contabilidad formal (serie CTA)

## Arquitectura de la solución

```
      flujo existente (SIN CAMBIOS operativos)                capa nueva (aditiva)
┌───────────────────────────────────────────┐
│ server action / API route                 │
│   prisma.$transaction(async (tx) => {     │
│     …lógica actual (venta, reconciliación)│
│                                           │      guard períodos (ya existe)
│     await postEvento(tx, evento)  ────────┼────► posting-engine (puro)
│   })                                      │        │  flag off → no-op
└───────────────────────────────────────────┘        │  shadow → intenta, loguea, nunca lanza
                                                     │  enforce → asienta o rechaza
                                                     ▼
                                   PlantillaAsiento (evento → líneas por rol)
                                   CuentaRolTenant (rol → CuentaContable del tenant)
                                                     ▼
                                   Asiento + AsientoLinea (debe=haber, cuadrado)
                                     · Diario + numeración por período (advisory lock)
                                     · fxEvidence heredado de la reconciliación
                                     · hash encadenado por tenant
                                                     ▼
                          Libro diario / mayor / comprobación / balance por cuentas
                                                     ▼
                          Conciliación cruzada vs balance calculado (caja) actual
```

Principio rector: **la base caja es el subsistema operativo; la capa formal es el subsistema auditivo**. La única intersección en tiempo de ejecución es `postEvento(tx, evento)` dentro de las transacciones ya existentes, y el guard de períodos que ya intercepta la escritura.

## §1 Modelo de datos (CTA-0)

Seis modelos aditivos, todos `tenantId`-scoped (nacen clasificados `scoped` en la clasificación del change `aislamiento-sistemico-tenant`). Ninguno referencia tablas existentes como FK obligatoria hacia atrás: el vínculo con la operación es blando (`origenTipo`/`origenId` strings), deliberadamente, para no acoplar migraciones ni romper los 18 writers.

```prisma
/// Plan de cuentas del tenant. Árbol: padreId self-relation, codigo tipo "1.2.01".
model CuentaContable {
  cuentaContableId String            @id @default(cuid())
  tenantId         String
  /// Código jerárquico único por tenant: "1", "1.1", "1.1.01"…
  codigo           String
  nombre           String
  tipo             TipoCuentaContable
  naturaleza       NaturalezaCuenta
  padreId          String?
  nivel            Int               @default(1)
  /// false = cabecera de agrupación (no admite líneas de asiento)
  aceptaMovimiento Boolean           @default(true)
  activa           Boolean           @default(true)
  esDeSistema      Boolean           @default(false)  // sembradas por plantilla; reglas de borrado
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  padre            CuentaContable?   @relation("PlanJerarquia", fields: [padreId], references: [cuentaContableId])
  hijas            CuentaContable[]  @relation("PlanJerarquia")
  tenant           Tenant            @relation(fields: [tenantId], references: [tenantId])
  lineas           AsientoLinea[]
  roles            CuentaRolTenant[]

  @@unique([tenantId, codigo])
  @@index([tenantId, tipo, activa])
  @@index([tenantId, padreId])
  @@map("cuentas_contables")
}

/// Diarios contables: agrupan asientos y llevan consecutivo por período.
model Diario {
  diarioId String    @id @default(cuid())
  tenantId String
  /// VENTAS | COMPRAS | CAJA | BANCOS | NOMINA | AJUSTES | APERTURA_CIERRE
  tipo     TipoDiario
  codigo   String // "VTA", "CMP", "CAJ", "BAN", "NOM", "AJU", "APE"
  nombre   String
  activo   Boolean           @default(true)
  createdAt DateTime  @default(now())
  asientos Asiento[]
  tenant   Tenant     @relation(fields: [tenantId], references: [tenantId])

  @@unique([tenantId, codigo])
  @@index([tenantId, tipo])
  @@map("diarios_contables")
}

/// Asiento de partida doble. Cuadrado por construcción (validación en tx).
model Asiento {
  asientoId      String        @id @default(cuid())
  tenantId       String
  diarioId       String
  periodoId      String        // período contable resuelto por el guard a fecha del asiento
  /// Consecutivo por (diarioId, periodoId) bajo advisory lock. Legible: "VTA-2026-09-0017"
  numero         Int
  fecha          DateTime
  descripcion    String
  estado         EstadoAsiento @default(CONTABILIZADO)
  /// Idempotencia fuerte: un evento de negocio = un asiento por tenant.
  origenTipo     String        // "venta" | "reconciliacion_venta" | "pago_cxp" | …
  origenId       String
  /// Integridad: SHA256(canonical(lineas + numero + fecha + hashAnterior))
  hash           String
  hashAnterior   String?       // cadena por tenant (último asiento previo)
  revertidoPorId String?
  observaciones  String?
  createdBy      String
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  diario         Diario        @relation(fields: [diarioId], references: [diarioId])
  periodo        PeriodoContable @relation(fields: [periodoId], references: [periodoId])
  tenant         Tenant        @relation(fields: [tenantId], references: [tenantId])
  lineas         AsientoLinea[]

  @@unique([tenantId, origenTipo, origenId])
  @@unique([diarioId, periodoId, numero])
  @@index([tenantId, fecha])
  @@index([tenantId, periodoId])
  @@index([tenantId, hash])
  @@map("asientos")
}

model AsientoLinea {
  lineaId         String         @id @default(cuid())
  asientoId       String
  orden           Int
  cuentaId        String
  /// MONTO EN MONEDA FUNCIONAL (posteado): exactamente uno de los dos > 0
  debe            Decimal        @default(0) @db.Decimal(20, 4)
  haber           Decimal        @default(0) @db.Decimal(20, 4)
  /// Valoración original: la reconciliación emisora ya resolvió esto (heredada, no recalculada)
  monedaOriginal  String
  montoOriginal   Decimal        @db.Decimal(20, 4)
  tasaCambio      Decimal?       @db.Decimal(20, 10)
  fxEvidenceFingerprint String?
  /// Etiqueta libre para el mayor ("Factura 2301", "Cobro préstamo 15")
  referencia      String?
  asiento         Asiento        @relation(fields: [asientoId], references: [asientoId], onDelete: Cascade)
  cuenta          CuentaContable @relation(fields: [cuentaId], references: [cuentaContableId])

  @@index([asientoId, orden])
  @@index([cuentaId])
  @@map("asiento_lineas")
}

/// Plantilla global (plataforma): evento de negocio → líneas con roles de cuenta.
/// El tenant NO edita la plantilla; remapea roles → sus cuentas via CuentaRolTenant.
model PlantillaAsiento {
  plantillaId String   @id @default(cuid())
  evento      TipoEventoContable
  orden       Int
  lado        LadoAsiento       // DEBE | HABER
  rolCuenta   RolCuenta         // CAJA_PRINCIPAL, VENTAS_PRODUCTOS, …
  /// Cómo tomar el monto del payload del evento
  montoRegla  ReglaMontoEvento  // TOTAL | MONTO_PAGADO | COSTO_FIFO | INTERESES | …
  /// Condición opcional interpretada por el motor (CTA-1): FX_POSITIVA | FX_NEGATIVA | SIN_DIFERENCIA_FX
  condicion   String?
  version     Int      @default(1)
  activa      Boolean  @default(true)

  @@unique([evento, orden, version])
  @@map("plantillas_asiento")
}

/// Mapeo por tenant: rol semántico → cuenta real de su plan.
model CuentaRolTenant {
  cuentRolId  String         @id @default(cuid())
  tenantId    String
  rol         RolCuenta
  cuentaId    String
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  cuenta      CuentaContable @relation(fields: [cuentaId], references: [cuentaContableId])
  tenant      Tenant         @relation(fields: [tenantId], references: [tenantId])

  @@unique([tenantId, rol])
  @@map("cuentas_roles_tenant")
}
```

```prisma
enum TipoCuentaContable { ACTIVO PASIVO PATRIMONIO INGRESO COSTO GASTO }
enum NaturalezaCuenta   { DEUDORA ACREEDORA }
enum TipoDiario         { VENTAS COMPRAS CAJA BANCOS NOMINA AJUSTES APERTURA_CIERRE }
enum EstadoAsiento      { CONTABILIZADO ANULADO }   // nunca se edita: se anula y se re-hace
enum LadoAsiento        { DEBE HABER }

enum RolCuenta {
  CAJA_PRINCIPAL BANCOS INVENTARIOS CXC_CLIENTES ANTICIPOS_CLIENTES
  PRESTAMOS_OTORGADOS CXP_PROVEEDORES ANTICIPOS_PROVEEDORES DEUDAS_RECIBIDAS
  CAPITAL_SOCIAL RESULTADOS_ACUMULADOS RESULTADO_PERIODO
  VENTAS_PRODUCTOS VENTAS_SERVICIOS OTROS_INGRESOS INTERESES_GANADOS DIFERENCIA_CAMBIARIA_INGRESO
  COSTO_VENTAS GASTOS_OPERATIVOS GASTOS_NOMINA GASTOS_FINANCIEROS
  MERMAS DIFERENCIA_CAMBIARIA_GASTO
}

enum ReglaMontoEvento {
  TOTAL MONTO_PAGADO COSTO_FIFO INTERESES TOTAL_MENOS_INTERESES
  DIFERENCIA_FX TOTAL_MENOS_DIFERENCIA TOTAL_MAS_DIFERENCIA
}

enum TipoEventoContable {
  VENTA_CONTADO VENTA_CREDITO COBRO_CXC COSTO_VENTA_DEVENGADO DEVOLUCION_VENTA
  VENTA_SERVICIO COBRO_SERVICIO
  COMPRA_CONTADO COMPRA_CREDITO PAGO_CXP
  GASTO_CONTADO GASTO_CREDITO PAGO_GASTO_CREDITO
  PAGO_NOMINA
  ANTICIPO_CLIENTE_RECIBIDO ANTICIPO_CLIENTE_APLICADO
  ANTICIPO_PROVEEDOR_ENTREGADO ANTICIPO_PROVEEDOR_APLICADO
  PRESTAMO_OTORGADO COBRO_PRESTAMO
  DEUDA_RECIBIDA PAGO_DEUDA
  AJUSTE_BANCARIO_CARGO AJUSTE_BANCARIO_ABONO
  TRANSFERENCIA_BANCARIA
  INYECCION_CAPITAL PAGO_DEUDA_CAPITAL
  MERMA_INVENTARIO PRODUCCION_SALIDA DIFERENCIA_CAMBIARIA
  APERTURA_PERIODO CIERRE_PERIODO
}
```

**Decisiones y razones:**

1. **`origenTipo/origenId` blando, no FK.** Evita que el ciclo de vida de la capa formal toque las tablas operativas y permite backfill de períodos históricos sin migrations de datos. La trazabilidad se resuelve por convención estable (`origenTipo` enum-cerrado en código) con índice para drill-down.
2. **Edición prohibida; anulación reversible.** Un asiento contabilizado nunca se edita ni borra: se anula (`estado = ANULADO`, `revertidoPorId` apunta al asiento de contrapartida generado). Esto preserva la cadena de hash intacta — la anulación es un evento nuevo, no una mutación.
3. **Hash encadenado por tenant** (`hash = SHA256(lineasCanonical + numero + fecha + hashAnterior)`): reutiliza la filosofía de `hashIntegridad` del cierre. Permite verificar off-line que ningún asiento histórico fue alterado (script de verificación, CTA-3).
4. **Dual moneda por línea, heredada.** `debe/haber` están siempre en **moneda funcional** (lo que cuadra los libros); `monedaOriginal/montoOriginal/tasaCambio/fxEvidenceFingerprint` documentan la valoración con la misma evidencia que la reconciliación origen — la capa **nunca recalcula tasas**, nunca rompe el contrato FX.
5. **Roles semánticos, no códigos en templates.** Las plantillas hablan de `CXC_CLIENTES`; el tenant mapea ese rol a su cuenta `1.2.01` o como la llame. Esto desacopla la semántica contable del plan de cada país y es lo que hace al plan editable sin romper el motor.
6. **Plantilla global + remapeo por tenant** (no plantilla por tenant): 20 eventos × ~3 líneas de plantilla se siembran una vez por plataforma; cada tenant solo edita sus 23 filas de `CuentaRolTenant` cuando quiere un plan distinto del default.
7. **Numeración por diario+período** tomando el último `numero` bajo advisory lock (`AccountingTenantLockService`, ya existe) — mismo patrón que los consecutivos de factura, sin secuencias Postgres nuevas.

### Plan por defecto (seed al activar el flag; ~40 cuentas)

```
1 ACTIVO
  1.1 Efectivo y equivalentes        → 1.1.01 Caja general [CAJA_PRINCIPAL] · 1.1.02 Bancos [BANCOS]
  1.2 Exigible                       → 1.2.01 Clientes [CXC_CLIENTES] · 1.2.02 Anticipos de clientes (pasivo-side ref 2.2.02)
                                       1.2.03 Préstamos otorgados [PRESTAMOS_OTORGADOS]
  1.3 Inventarios [INVENTARIOS]
2 PASIVO
  2.1 Proveedores y cuentas por pagar [CXP_PROVEEDORES] · 2.2 Deudas recibidas [DEUDAS_RECIBIDAS]
  2.2.02 Anticipos de clientes [ANTICIPOS_CLIENTES]
3 PATRIMONIO
  3.1 Capital social [CAPITAL_SOCIAL] · 3.2 Resultados acumulados [RESULTADOS_ACUMULADOS]
  3.3 Resultado del período [RESULTADO_PERIODO]
4 INGRESOS
  4.1 Ventas de productos [VENTAS_PRODUCTOS] · 4.2 Ventas de servicios [VENTAS_SERVICIOS]
  4.3 Otros ingresos [OTROS_INGRESOS] · 4.4 Intereses ganados [INTERESES_GANADOS]
  4.5 Diferencia cambiaria (ingreso) [DIFERENCIA_CAMBIARIA_INGRESO]
5 COSTOS
  5.1 Costo de ventas [COSTO_VENTAS]
6 GASTOS
  6.1 Gastos operativos [GASTOS_OPERATIVOS] · 6.2 Nómina [GASTOS_NOMINA]
  6.3 Gastos financieros [GASTOS_FINANCIEROS] · 6.4 Mermas [MERMAS]
  6.5 Diferencia cambiaria (gasto) [DIFERENCIA_CAMBIARIA_GASTO]
```

Naturaleza derivada del tipo (ACTIVO/COSTO/GASTO → DEUDORA; PASIVO/PATRIMONIO/INGRESO → ACREEDORA), editable solo por cabecera. El seed también crea los 7 diarios y el `CuentaRolTenant` completo apuntando a estas cuentas. Todo el seed es idempotente (upsert por `@@unique([tenantId, codigo])`).

## §2 Motor de asientos (CTA-1)

Servicio puro en `src/features/contabilidad-formal/services/posting-engine.ts`; sin I/O propia excepto el `tx` que recibe:

```ts
export interface EventoContableInput {
  tipo: TipoEventoContable;
  fecha: Date;
  descripcion: string;
  origen: { tipo: string; id: string };
  // Valoración ya resuelta por la capa caja — la capa formal hereda, no recalcula:
  monto: Decimal;             // en moneda original
  moneda: string;
  tasaCambio: Decimal | null; // null si moneda == funcional
  montoFuncional: Decimal;
  fxEvidenceFingerprint?: string;
  auxiliares?: { costoFifo?: Decimal; intereses?: Decimal; diferenciaFx?: Decimal };
  referencia?: string;
}

export async function postEvento(
  tx: PrismaTx, ctx: { tenantId: string; userId: string; modo: 'off'|'shadow'|'enforce' },
  evento: EventoContableInput,
): Promise<{ asientoId?: string; estado: 'OMITIDO'|'SIMULADO'|'CONTABILIZADO'|'ERROR_SHADOW' }>
```

**Algoritmo** (todo dentro del `tx` del writer):

1. `modo off` → retorna `OMITIDO` sin tocar DB.
2. Resolver período por fecha vía `PeriodoContableService`; **guard `verificarEscritura`** (`tipoOperacion: 'asiento'`). Período cerrado: `enforce` → `ActionError(PERIODO_CERRADO)`; `shadow` → log `ASIENTO_SHADOW_BLOCKED` y retorna.
3. Cargar plantilla activa del evento + `CuentaRolTenant` del tenant. Rol sin mapeo: `enforce` → `ActionError(CUENTA_SIN_MAPEAR)`; `shadow` → log y retorna.
4. Construir líneas desde `montoRegla` (`TOTAL`, `COSTO_FIFO`, `INTERESES`, `DIFERENCIA_FX`, `MONTO_PAGADO`). Validar: toda línea cae en cuenta con `aceptaMovimiento`, ninguna línea con debe y haber a la vez, **Σdebe = Σhaber** (comparación decimal exacta).
5. Numeración: advisory lock por `(diarioId, periodoId)` → `MAX(numero)+1` → insert asiento + líneas.
6. Hash encadenado: leer último `hash` del tenant (misma query ordenada por createdAt/numero bajo el lock) → SHA256 → persistir.
7. Errores del motor en `shadow`: **jamás** escapan; se loguean estructurado (`console.error` + contador) y la transacción del writer continúa intacta.

**Puntos de enganche (los 18 writers medidos)** — uno por transacción, p.ej.:

- `ventas` / `facturacion-workflow`: `VENTA_CONTADO` (caja/banco vs ventas) + `COSTO_VENTA_DEVENGADO` (costo FIFO ya calculado por el módulo) + `DIFERENCIA_CAMBIARIA` si la tasa de cobro difiere de la de reconocimiento.
- `contabilidad/actions-reconciliacion` + handlers legacy: `COBRO_CXC`, `COBRO_SERVICIO`, `PAGO_GASTO_CREDITO`, `COBRO_PRESTAMO` (descompone `INTERESES`), `PAGO_DEUDA` (idem).
- `compras-productos`/`compras-servicios`: `COMPRA_*`; `pago-salario`: `PAGO_NOMINA`; anticipos, ajustes, transferencias bancarias, inyección de capital, mermas y producción según taxonomía de §1.

**Diferencia cambiaria:** el evento lo emite la reconciliación cuando `tasaCobro ≠ tasaReconocimiento` que ella misma ya persiste; la plantilla `DIFERENCIA_CAMBIARIA` lleva la línea a `DIFERENCIA_CAMBIARIA_INGRESO` o `_GASTO` según el signo. Con esto el único hueco de registro multimoneda queda cerrado.

## §3 Libros formales (CTA-2)

Server actions nuevas en `src/features/contabilidad-formal/actions-*.ts` (patrón `withAction` + `requireFeature(user, 'contabilidad-formal', …)`); ninguna ruta API nueva:

- **Libro diario**: asientos del período ordenados por diario/numero con líneas; filtros por diario, rango, origen; paginado cursor-based (los volúmenes los manda un tenant con miles de ventas/mes).
- **Libro mayor**: por cuenta `aceptaMovimiento`, movimientos del período con saldo corrido según naturaleza; saldo inicial = asiento de apertura o acumulado previo.
- **Balance de comprobación**: 4 columnas (sumas debe/haber, saldos deudor/acreedor) a nivel de cuenta de movimiento, con total cuadrado garantizado.
- **Balance y P&L por cuentas**: agregación por tipo/naturaleza; se **publican al lado** de los actuales, no los sustituyen.
- **Panel de conciliación cruzada**: por rubro (efectivo, bancos, inventario, CxC, CxP, capital) compara saldo-por-cuentas vs saldo-calculado-caja; tolerancia configurable; cada divergencia enlaza al detalle. Es la radiografía permanente que hace seguro el `enforce`.

UI: nueva sección "Contabilidad formal" en el módulo contabilidad (flag-gated), componentes < 200 líneas según AGENTS.md, toasts en español neutro.

## §4 Cierre formal (CTA-3)

- Al **aprobar** un cierre (`PeriodoContable.estado → APROBADO`): se genera el **asiento de cierre** en el diario `APERTURA_CIERRE`: cargan las cuentas de ingreso/costo/gasto por su saldo, abona `RESULTADO_PERIODO` (o al revés si hay pérdida). El resumen resultante se incluye en `resumenJson` del período → el `hashIntegridad` existente del cierre ahora cubre también el libro formal.
- Al **abrir** el período siguiente: **asiento de apertura** desde `AperturaPeriodo` (saldos caja/banco/CxC/CxP/inventario/capital/resultados ya existen ahí — diseño convergente) + traspaso de `RESULTADO_PERIODO` → `RESULTADOS_ACUMULADOS`.
- Script `verificar-cadena-hash` por tenant: recomputa y detecta alteraciones; se cuelga del reporte de salud contable (`actions-health`).

## §5 Backfill histórico (CTA-4, opt-in)

Replay cronológico por tenant/período: lee las fuentes (ventas, reconciliaciones, gastos…) y emite los eventos contra el motor en modo especial `replay` (no toca guard ni emite auditoría de escritura: los períodos históricos están cerrados por definición; los asientos de backfill nacen con `origenTipo` normal + marca `replayRunId`). Dry-run obligatorio con conteos de omitidos/sin-fx/ambiguos antes de ejecutar (patrón de los backfills AS-05 y FX). Gate explícito del usuario; sin backfill, la capa opera desde el período en curso con asiento de apertura.

## §6 Rollout y modos

- Env: `CONTABILIDAD_FORMAL_MODE=off|shadow|enforce` (default `off`) × feature flag `contabilidad-formal` por plan/tenant (mismo doble gate que `categorias-ean13`). El modo destraba el motor; el flag destraba la UI.
- **Waves sugeridas:** staging `shadow` → 1 tenant real `shadow` (medir latencia y cobertura de eventos) → `enforce` en ese tenant con conciliación cruzada verde 1 período completo → resto.
- Métricas shadow mínimas: eventos recibidos/contabilizados/omitidos por tipo, latencia del hook p95, errores por rol sin mapear.

## §7 Validación (cliente/servidor) y UX

- Toda mutación de configuración (crear/renombrar/desactivar cuentas, remapear roles) cumple el patrón server action + Zod estricto + `requireFeature`; el cliente usa react-hook-form con los mismos schemas compartidos y toasts en español neutro (p. ej. «Cuenta creada correctamente», «No se puede desactivar: la cuenta tiene movimientos en el período abierto»).
- Reglas server que el cliente nunca decide: no borrar cuentas con movimientos (solo `activa=false`), no remapear un rol hacia una cuenta de otro tipo salvo compatibilidad documentada, no asientos manuales en diarios automáticos (v1: todo asiento tiene `origenTipo`; el asiento manual queda para una iteración posterior con su propia plantilla).
- Copys de error nuevos: `PERIODO_CERRADO` → «El período contable está cerrado para esa fecha»; `CUENTA_SIN_MAPEAR` → «Falta asignar la cuenta para {rol} en Configuración contable»; `ASIENTO_DESCUADRADO` → «El asiento no cuadra: debe y haber difieren».

## §8 Estrategia de tests (TDD estricto, memoria del proyecto)

- Unitarios con prisma mockeado (contrato MM-B intacto): resolución de plantillas, construcción de líneas desde reglas de monto, cuadre, numeración, hash encadenado, seed idempotente. Rutas explícitas: `pnpm exec vitest run src/features/contabilidad-formal`.
- Integración real en `src/features/contabilidad-formal/__integration__/` con `DATABASE_URL_TEST`: cuadre imposible de violar, idempotencia de reintento, aislamiento entre tenants, cierre→apertura, conciliación cruzada contra balance calculado con fixtures.
- Componentes: Testing Library + `vitest-axe` en formularios de configuración y vistas de libros.
- Evidencia RED documentada por fase en `tasks.md` antes de cada GREEN; commits por fase con stage selectivo (worktree compartido).
