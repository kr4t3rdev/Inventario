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

## §9 Remediación de aceptación — diseño vigente (Explore #3899, Propose #3902, Spec #3904)

**Estado:** CTA-0–CTA-4 ya tienen implementación parcial. Este apartado prevalece donde §§1–8 describen una intención que contradice el código o la spec modificada. No se habilita `enforce` ni se interpreta una tarea marcada como hecha como evidencia de aceptación. En particular quedan reemplazados: omisión de tenants sin plan (§2), captura de errores después de escribir en `shadow` (§2), tolerancia monetaria (§3), bypass irrestricto del guard en replay (§5), rollback destructivo (§6) y la suposición de que existen `asiento-service.ts`/`actions-health.ts`: no existen hoy.

### Arquitectura técnica y fronteras

```
writer (API legacy / action, tenant + actor autenticados)
  └─ tx Prisma existente ── postEvento(tx, ctx, evento)
       ├─ gate servidor: licencia/flag por tenant + modo efectivo (off/shadow/enforce)
       ├─ validación de evento, moneda, plan, roles, plantilla y período
       ├─ cálculo puro Decimal → líneas normalizadas → cuadre exacto
       ├─ shadow: simular sin escrituras formales; observar resultado tras commit
       └─ enforce: lock tenant → número/hash → insert cabecera+líneas en tx
  └─ commit/rollback operación y asiento conjuntamente

aprobación período → tx: cierre firmado + total libro en resumen/hash → transición
apertura período → tx: período inmediato + saldos firmados + traspaso → apertura
preflight persistido → autorización servidor → replay bajo lock → conciliación → run auditado
```

El motor no puede decidir el modo únicamente por `CONTABILIDAD_FORMAL_MODE`: el **doble gate** requiere flag/licencia del tenant verificada en servidor y modo efectivo explícito; sin licencia, `off`; con licencia pero plan incompleto, `enforce` rechaza (nunca interpreta falta de roles como flag apagado). Para habilitar `enforce`, además se exige aprobación por tenant del gate de §9.6. Si la política vigente de flags no admite habilitación individual de modo, agregar control persistido por tenant antes de cualquier activación, sin derivarlo de la UI. Los writers existentes conservan su API y transacción; inventariar la matriz real de evento→writer→origen→valoración, incluyendo rutas legacy y cierres, antes de afirmar cobertura. Una operación que requiere varios asientos usa orígenes deterministas distintos sin violar la unicidad por origen.

**Typecheck:** reemplazar los contratos estructurales incompatibles `PostingTx`/`CierreTx` y los casts `tx as never` por `Prisma.TransactionClient` (import desde `@/generated/prisma`) o por puertos derivados de operaciones Prisma reales, con tipos `Prisma.*GetPayload`/selects exactos; helpers de lock, inserción, cierre y replay comparten el mismo cliente transaccional. No tipar delegates como funciones manuales de retorno `Promise` cuando Prisma devuelve `PrismaPromise`; resolver causas de los ~34 diagnósticos reportados, no silenciarlos con casts ni `skipLibCheck`. Capturar baseline completo en RED y verificar `pnpm run typecheck` limpio en GREEN; si hay errores ajenos, identificarlos y bloquear el gate hasta eliminarlos, sin atribuir su autoría.

**Dinero e integridad:** `EventoContableInput`, auxiliares, líneas, grupos, saldos y diferencias viajan como `Prisma.Decimal` o strings decimales validados; nunca `Number(...)`, `Math.round`, `Math.abs` ni epsilon en cálculo contable. Centralizar parseo finito, normalización monetaria y serialización canónica decimal en helper compartido; comprobar Σdebe.eq(Σhaber), positivos exclusivos y moneda funcional consistente **antes** de persistir. El hash debe serializar importes normalizados como strings estables e incluir identidad de origen/fecha/orden; migrar o versionar la verificación para no invalidar silenciosamente hashes publicados. La escala de almacenamiento `Decimal(20,4)` no determina automáticamente la escala funcional ni su regla de redondeo. Hasta su aprobación, **bloquear enforce y replay que publiquen nuevos importes**; opción conservadora a evaluar: normalizar cada línea una sola vez a la escala funcional acordada, rechazar diferencia residual y registrar cualquier ajuste mediante línea explícita, jamás tolerancia escondida. Conciliación usa igual política sin declarar `OK` por diferencia real; presentación puede redondear solo al renderizar y debe distinguir «sin cobertura» de «conforme».

**Snapshot FX de writers fuera de reconciliaciones:** `AjusteBancario`, `TransferenciaBancaria`, `InyeccionCapital`, `PagoDeuda` y `CompraDocumento` no poseían evidencia completa en la fuente; R0.5 añade campos nullable (`montoConvertido`, `functionalCurrency`, `rateEffectiveAt`, `fxProvenanceKind/Source`, `fxCatalogRateId`, `fxEvidenceJson`, `fxEvidenceFingerprint`, `fxEvidenceVersion`, con `tasaCambio` donde faltaba) por migraciones aditivas 20260926000000–003. Ajuste, capital y compra extranjera exigen tasa/fecha efectiva y el asiento hereda evidencia. Transferencias USD→CUP están probadas; dos divisas no funcionales distintas se bloquean si no hay cotización cruzada. No hay backfill inferido para filas históricas. `PAGO_COMPLETO` de compras requiere definir el writer de tesorería; no se declara cubierto por el hook de COMPRA_CREDITO.

**Shadow atómico — decisión técnica condicionada:** preferir simular lectura/resolución/cálculo/hash provisional **sin escribir Asiento/AsientoLinea**, y emitir evidencia durable de evento, resultado, causa y latencia fuera de la operación, ligada al commit (outbox o mecanismo equivalente; nunca anunciar asiento persistido). Esto conserva operación ante fallo del motor y evita el estado PostgreSQL abortado después de un error SQL capturado dentro de `prisma.$transaction`. Si se necesita probar persistencia en shadow, diseñar savepoint SQL con conexión/tx comprobablemente compartidos y rollback de intento; no abrir otra transacción Prisma anidada ni hacer `catch` de `P2002` seguido de consultas en la misma transacción abortada. Si falla telemetría, contabilizar un hueco de cobertura y bloquear promoción. Probar inyección de error tras el punto de construcción/insert y ausencia de cabecera/líneas parciales. `off` mantiene no-op.

**Auditoría del guard:** `PeriodoGuard.assertWritable` actualmente fija `actor: 'system'` y crea `PeriodoGuard` sin audit service, por lo que no persiste el bypass en esa ruta. Pasar contexto explícito `{tenantId, actorId, actorTipo, tipoOperacion, origen, fecha}` desde el writer, conectar `AuditoriaPeriodo` real y dejar `INTENTO_BYPASS` durable **fuera del tx que se revierte**, con período real y causa (no `N/A` si existe). El fallo al auditar un rechazo no se interpreta como auditoría exitosa: fallar cerrado o entregar evidencia durable comprobable. Actor de servicio solo para jobs identificados; permisos y pertenencia de tenant se verifican en actions y en servicios invocables directamente.


### R3 — Apertura formal con evidencia revisada (contrato aprobado)

La apertura formal deja de tratar los agregados legacy de `AperturaPeriodo` como fuente publicable. El servicio actual suma `resumenJson.saldosPorMoneda` como si fuera una sola moneda y asigna cero a rubros sin resolver; el camino de datos vivos suma bancos/CxC/CxP en `number`, también sin moneda funcional ni evidencia reproducible. Por tanto esos datos no se migran ni se aprueban implícitamente.

**Modelo aditivo mínimo, pendiente de implementar:** `AperturaPeriodo` permanece como cabecera/compatibilidad operativa, sin autoridad de lifecycle ni campos nuevos de aprobación. Crear `AperturaRevision` append-only como única fuente de estado, presentador/revisor, permisos, versión y digest; todas las líneas y referencias de evidencia MUST pertenecer mediante FK a una revisión exacta. La revisión contiene identidad tenant/período, estado (`BORRADOR`, `PRESENTADA`, `APROBADA`/`RECHAZADA`), `presentadaPor/At`, `revisadaPor/At`, versión/digest canónico y versión/hash inmutable de evidencia. La revisión nueva para corregir/sustituir una anterior apunta a la revisión reemplazada; nunca se muta evidencia ya presentada/aprobada. Añadir líneas de apertura por revisión: fecha efectiva de origen, rol/cuenta destino, moneda nativa ISO, importe Decimal, tipo/identificador de fuente y fingerprint/hash de evidencia. SQL triggers deben impedir UPDATE/DELETE de evidencia/líneas de revisiones `PRESENTADA`/`APROBADA`; transición de estado solo por operación autorizada y auditada. Aplicar desde la entrada la decisión R0.1: **máximo cuatro decimales exactos, sin cuantización/redondeo**, rechazo de precisión superior y del rango que exceda `Decimal(20,4)` (hasta 16 dígitos enteros); ceros finales se eliminan al canonicalizar. Líneas contables del diario solo admiten CUP funcional por ahora; no inferir soporte multi-funcional solo porque `functionalCurrency` sea string. Reabrir esa limitación únicamente cuando un contrato/writer contable verificado soporte explícitamente otra moneda funcional.

Cada línea MUST pertenecer a una revisión exacta, tenant, período y cuenta; la fecha efectiva debe quedar sustentada por la evidencia y ser aplicable a la fecha de apertura; rol/cuenta, código ISO de moneda y monto son obligatorios. Para moneda nativa CUP, el importe funcional es el mismo y la tasa puede ser `1` o `null`; toda moneda extranjera exige importe original y funcional, moneda funcional CUP, tasa positiva, fecha efectiva, fuente/provenance y fingerprint cuya relación se recompute desde evidencia inmutable, no desde campos editables. Una declaración manual de saldo no constituye prueba FX: capturas extranjeras sin evidencia verificable quedan no valoradas y no se postean. La tasa conserva la escala/procedencia que admite el contrato existente (`Decimal(20,10)`), pero el importe contable original/funcional no excede cuatro decimales ni `Decimal(20,4)`. El digest MUST tener dominio y versión de contrato explícitos y cubrir serialización canónica con fechas UTC ISO, códigos de moneda uppercase, montos Decimal en texto plano sin exponentes/ceros finales, tenant, período, revisión, fecha efectiva, rol/cuenta, fuente, versión+hash de evidencia inmutable y todos los campos FX. Si el origen no es confiable o no permite resolver importe/moneda, exigir captura manual declarada y evidencia adjunta, sin importar/sumar el agregado mixto.

La presentación congela revisión, líneas y evidencia (correcciones mediante una nueva revisión append-only que identifica la anterior, nunca edición silenciosa). Presentar requiere permiso activo tenant-scoped `contabilidad.apertura.presentar`; aprobar requiere permiso activo tenant-scoped `contabilidad.apertura.aprobar` (no basta acceso de lectura/gestión genérica). La aprobación requiere actor autenticado autorizado distinto de quien presentó y revalida en esa transacción tenant/período/fechas, permisos activos, revisión/version/digest, hash de evidencia, cuenta/rol, moneda, FX, límites Decimal y cuadre; la evidencia FX se vuelve a resolver y fingerprint se recomputa desde snapshot inmutable. No se permite asiento de ajuste/plug para forzar balance. La aprobación de una revisión y su asiento de apertura se confirman en la misma transacción con idempotencia por revisión, de modo que cualquier rechazo/rollback no deja estado aprobado ni asiento parcial. Un `AperturaPeriodo` legacy sin `AperturaRevision` permanece no aprobado y nunca se usa para generar un asiento.

**Dos orígenes distintos:** una primera apertura sin período anterior es un alta de saldos iniciales respaldada por evidencia/manual, revisada independientemente; no se fabrica desde el snapshot operativo actual. Un rollover solo puede derivarse del cierre formal aprobado y completo del período inmediatamente anterior, mismo tenant y continuidad de fechas/tipo; se conserva cada saldo por cuenta y moneda y se traspasa resultado una sola vez. Período anterior ausente/no conforme impide rollover (no se busca un cierre viejo ni se cae a datos vivos).

**Decisión R3.10 (usuario, 2026-09-30):** cerrar un período sin actividad es opcional; en `enforce`, una transición a `CERRADO` o `APROBADO` requiere asiento formal de cierre dentro de la misma transacción. Si no se puede producir ese asiento, se rechaza y se revierte la transición; el período queda abierto/en su estado previo. No se crea un asiento cero. La ausencia de actividad se identifica por ausencia de líneas de resultado contabilizadas/candidatas a cierre, no por resultado neto igual a cero: líneas compensatorias entre cuentas todavía requieren asiento formal. El contrato de apertura inicial sigue siendo independiente de esta decisión.

**Replay:** `recolectarCandidatos` convierte nulos a cero, asigna `CUP` por defecto y consulta `m.costoTotal`; el plan actual solo contabiliza replayables/ya posteados/sin período. Introducir preflight persistido por tenant+período con snapshot/fingerprint de candidatos, categorías exhaustivas (reproducible, ya posteado/omitido, ambiguo, sin FX, sin costo, fuera de período), causas y expiración de 24 horas desde la generación del preflight. Merma: derivar costo desde valoración fuente histórica demostrable (movimientos/costo FIFO/evidencia de operación) en Decimal; si no es unívoco, omitir esa fuente con causa, jamás inferir cero. La omisión de fuentes ambiguas, sin FX indispensable, sin costo verificable o fuera del período no bloquea por sí sola el replay de las demás fuentes; se registran identidad y causa por fuente y la cobertura permanece incompleta. FX: exigir fingerprint/evidencia cuando la fuente lo requiere; jamás inventar tasa o moneda. Acción `withAction` valida Zod, `requireTenant`, `requireFeature`, permiso servidor, aprobación verificable y vínculo `(preflightId, digest, tenantId, periodoId, actor)`; escribir `replayRunId`, estado, conteos y diferencias. Dentro de lock tenant, revalidar fingerprint, fechas, vigencia, condiciones bloqueantes y orígenes; bypass del guard solo mediante capacidad privada de replay para ese alcance, auditada, nunca `omitirGuard: true` accesible por caller ordinario. Reintentos retornan `YA_EXISTENTE` sin duplicar; discrepancia post-run => estado `NO_CONFORME`, no éxito. Persistir resultado/diagnóstico incluso si falla el trabajo, sin publicar un run falso como conforme. El replay de cada período se confirma en una única transacción bajo lock; un fallo revierte todos sus asientos y avances, sin lotes parcialmente confirmados. La vigencia predeterminada del preflight es de 24 horas. Digest aprobado: SHA-256 versionado (v1) de una serialización canónica y estable que incluya tenant, período, identidad ordenada de cada fuente, clasificación/causa de omisión, valoración decimal normalizada, moneda y evidencia FX. Persistir versión y digest con el preflight y su aprobación; recomputar bajo lock antes del replay. Cualquier cambio invalida la aprobación y exige generar y aprobar otro preflight. La implementación necesita prueba concurrente y plan de recuperación.

### Archivos previstos (solo diseño; ningún código modificado en esta fase)

| Archivo | Cambio futuro propuesto |
|---|---|
| `src/features/contabilidad-formal/services/posting-engine.ts` | Tipos de tx reales, gate, Decimal, simulación shadow, guard con actor, idempotencia/hash. |
| `src/features/contabilidad-formal/services/cierre-formal-service.ts` | Signos, fecha, período inmediato, cuadre, mismo tx y moneda funcional. |
| `src/features/contabilidad/actions-periodos.ts` | Coordinar aprobación/apertura con asiento obligatorio en enforce; eliminar casts falsos. |
| `src/lib/services/periodo-contable-guard.ts` | Actor y auditoría durable en rechazos. |
| `src/features/contabilidad-formal/services/replay-backfill-service.ts` y `actions-backfill.ts` | Preflight y run persistidos, clasificación total, lock, autorización, costo merma y conciliación. |
| `src/features/contabilidad-formal/services/conciliacion-cruzada-service.ts` | Decimal, cobertura y períodos/moneda comparables; no tolerancia que oculte diferencias. |
| `src/features/contabilidad-formal/actions-libros.ts`, `components/conciliacion-panel.tsx`, `components/libros-page-client.tsx` | Solo estados de salud/conciliación y replay si se aprueba el gate; no nuevas pantallas por defecto. |
| `prisma/schema.prisma` y migración aditiva revisada | Persistencia de preflight/run, `replayRunId`/evidencia y aprobación tenant si los modelos actuales no la cubren; no borrar datos publicados. |
| `src/features/contabilidad-formal/__tests__/`, `__integration__/`, `content/docs/modules/contabilidad/`, `docs/GLOSSARY.md` | Matriz, RED→GREEN, runbook de activación/incidente y semántica monetaria aprobada. |

Los nombres de nuevas tablas/archivos de salud quedan por concretar después de revisar el esquema y la autorización; **no** presuponer `actions-health.ts` existente. La tabla de archivos expresa impacto previsto, no cambios ejecutados.

### Dirección visual (limitada a superficies operativas existentes)

No hay rediseño de producto en el alcance de remediación. Para estados nuevos del panel de conciliación y eventual preflight, dirección **libro de control editorial**: usar layout y tokens existentes del módulo contabilidad, fondo papel neutro `#F7F5F0`, tinta `#252B2A`, verde petróleo `#185B52` solo para conformidad verificada y ámbar `#98641F`/rojo profundo `#A33D35` para cobertura incompleta/bloqueo; tokens CSS locales compatibles con light/dark y contraste WCAG, no imponerlos globalmente. Encabezado compacto de período + moneda + estado, tabla densa con importes tabulares alineados a la derecha, columna fija «Diferencia», y banda visible de «Sin cobertura» distinta de cero; desgloses accesibles por teclado antes que tarjetas KPI decorativas. Conservar tipografía instalada para cuerpo y usar números tabulares (`font-variant-numeric: tabular-nums`); no añadir fuentes remotas ni animación ornamental. Solo transición de estado/foco de 120–160 ms, deshabilitada con `prefers-reduced-motion`. Errores del servidor via toast en español neutro y detalle persistente en panel; no presentar éxito si falla conciliación o hay ambiguos. Validación cliente (Zod/formulario: período, confirmación y vigencia visible) es ayuda; el servidor decide tenant, roles, digest, permisos y capacidad de replay. Ningún color sustituye texto/icono/ARIA para comunicar estado. Esta propuesta visual es **condicional** a cambios de UI realmente necesarios y no autoriza nuevas vistas.

### §9.6 TDD y gate operacional

Orden estricto por fallo: escribir test RED reproducible → corrección mínima GREEN → regresión. Unitarios de Decimal, hash, gate de modos, plan/plantilla faltantes, utilidad/pérdida y clasificación replay con Prisma mockeado (`DATABASE_URL` MM-B inaccesible); integración exclusivamente `src/**/__integration__/` con `DATABASE_URL_TEST`, fixtures por tenant, inyección de error SQL en shadow, rollback completo enforce, audit durable pese al rollback, colisión de origen/concurrencia, cierre/apertura real y replay con lock. Testing Library + `vitest-axe` para estados de panel/toasts cuando cambie UI. Validar suite focalizada y writers de ventas/compras/contabilidad en off, shadow y enforce, lint de archivos tocados y `pnpm run typecheck` completo; no marcar gate verde sin ejecución/evidencia.

Matriz de cobertura por writer/evento/origen + métricas shadow durables por tenant, tipo, causa y latencia p95 + conciliación exacta comprobable durante **al menos siete días** + responsable y criterio de reversión registrados. La promoción a enforce se bloquea si falta cualquier evidencia, si hay divergencia o si la política monetaria/preflight permanece sin resolver. Ante incidente: apagar nuevos posteos y replay del tenant, congelar evidencia, investigar y reabrir gate shadow; `off` no borra asientos ni elimina tablas. Correcciones de asientos publicados mediante contrapartidas auditadas, nunca borrado destructivo en producción.

### §9.7 Decisiones abiertas (sin atribuirlas al usuario)

**Decisión explícita del usuario (2026-09-23):** escala funcional global EXACTA de cuatro
decimales. Frontera: antes de construir/persistir líneas funcionales y antes del cuadre;
rechazar todo valor con dígitos significativos más allá de cuatro posiciones decimales.
No hay regla de empate ni redondeo porque no se cuantiza; los ceros finales no cuentan como
precisión adicional. Tampoco se crea ajuste automático. Los importes originales y las tasas
FX conservan su evidencia/escala propia; cualquier resultado funcional no representable
se rechaza sin truncar. El helper `decimal-contable.ts` valida esta frontera; su existencia
aislada NO implica que todos los writers ya la apliquen ni habilita enforce/replay.

**Shadow:** usuario elige savepoint comprobado. Queda condicionado a demostrar mediante
integración PostgreSQL que SAVEPOINT/ROLLBACK TO SAVEPOINT se ejecutan en la misma conexión
del `Prisma.TransactionClient` del writer, incluso ante error SQL; recuperación y telemetría
ligada al commit requieren pruebas separadas. No implementar un shadow de escrituras ni
promoverlo mientras no exista esa demostración. R0.3 y R0.4 siguen abiertos: «sí» a replay
y conciliación no establece vigencia, autorizaciones, bloqueos ni cobertura parcial.

**Decisión R2 (2026-09-24):** la simulación de inserción se revierte siempre en el
savepoint del writer; una fila `ShadowPosteoOutbox` se inserta *después* de liberarlo,
en la transacción exterior. Un rollback exterior revierte la evidencia. `SIMULADO`
solo describe la prueba, nunca un asiento confirmado. Clave de deduplicación:
`(tenantId, tipoEvento, origenTipo, origenId)`. El consumidor lee exclusivamente
filas confirmadas, bloquea por `FOR UPDATE SKIP LOCKED` y requiere un sink idempotente
por id; no es seguro incrementar un contador externo no idempotente antes del ACK.
La migración aditiva crea la tabla; el despliegue requiere aplicarla antes de
habilitar shadow. Un fallo al escribir evidencia bloquea el writer (hueco no oculto).
Todavía no existe un sink/reportador de métricas ni prueba integral del motor contra
PostgreSQL con fixture de tenant; NO habilitar shadow operativamente ni enforce.

- [x] **Escala funcional:** cuatro decimales exactos globales, rechazo sin cuantización ni empate; integración de la frontera en todos los posteos aún pendiente.
- [x] **Aislamiento shadow elegido:** savepoint real; validación técnica, aislamiento y telemetría ligados al commit aún pendientes. **Bloquea promoción shadow→enforce.**
- [ ] **Preflight replay:** vigencia predeterminada aprobada: 24 horas desde la generación; el manager aprobador debe ser una persona distinta de la solicitante y tener permiso vigente para el tenant. Las fuentes ambiguas, sin FX, sin costo o fuera de período se omiten con causa sin detener las demás; digest SHA-256 versionado del snapshot canónico (tenant, período, fuentes, valoración, omisiones) aprobado; cualquier cambio exige nuevo preflight y aprobación; cada período usa una sola transacción (sin lotes confirmados parcialmente); fallos de autorización, vigencia o integridad del preflight sí impiden el run y se revalida todo bajo lock. **Bloquea replay histórico.**
- [ ] **Cobertura formal versus caja:** decidir criterio de períodos parciales y rubros sin fuente funcional suficiente (p. ej. inventario/capital) antes de declarar conciliación conforme; mostrar `SIN_COBERTURA` mientras tanto. **Bloquea certificación de gate.**

**Decisiones confirmadas después:** el autorizador de replay es manager; un período parcial o
un rubro sin fuente comparable se califica `NO_EVALUABLE` y bloquea `enforce` (no equivale
a conciliación conforme). El usuario confirmó **24 horas** de vigencia predeterminada
desde la generación del preflight el 2026-09-26; aún no está implementada. El usuario
aprobó SHA-256 versionado del snapshot canónico de tenant, período, fuentes,
valoración y causas de omisión; un cambio exige nuevo preflight y aprobación. El
replay de cada período debe ser atómico en una sola transacción: un fallo revierte
todo el período. El manager aprobador debe ser otra persona con permiso vigente
para el tenant; el servidor rechaza la autoaprobación. No ejecutar replay hasta
implementar y verificar estos controles.
