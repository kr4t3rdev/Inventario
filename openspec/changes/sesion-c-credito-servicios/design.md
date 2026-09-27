# Design — Sesión C: crédito y servicios

Referencias de código medidas sobre `main` (b4be12ba). Rutas relativas a `src/` salvo indicación.

## 0. Decisiones de arquitectura (resumen)

| # | Decisión | Alternativas descartadas |
|---|---|---|
| D1 | El límite de crédito se edita con action dedicada + dialog en la vista 360, no dentro del formulario general del cliente | Campo más en `clientes-form`: mezclaría una política financiera sensible con el CRUD de contacto, y la auditoría por cambio (anterior→nuevo) se pierde entre edits |
| D2 | El enforcement del tope reutiliza el permiso `ventas.venta.credito-override` y las reglas puras de `features/crm/services/credito-calculo.ts`; un helper compartido `credito-enforcement.ts` lo aplica a servicios y facturación | Permiso separado por módulo: fragmentaría la autorización del mismo acto de negocio (vender sobre el tope) |
| D3 | El costo server-side de servicios es **costo estándar en catálogo** (`Servicios.costo`), snapshot en la venta | Derivar del último `CompraServicio.costoUnitario`: FIFO de servicios introduce ambigüedad (¿qué compra anula el costo?) para un valor que hoy es cero/no fiable; el costo estándar es predecible y editable |
| D4 | El modo mixto se reescribe con una `$transaction` interactiva (patrón legacy de `createVentaServicioAction`), no con arrays paralelos | Mantener dos tx y compensar: una compensación entre tx no es atomicidad |
| D5 | Delete de venta con CxC activa se rechaza (no se borra la CxC en cascada) | Cascada de CxC activa: destruiría deuda real con un delete; anularla primero es explícito y auditable |
| D6 | "Factura-documento" para servicios = **extender `Factura`** con `ventaServicioId @unique`; no se crea una tabla nueva ni estados propios de `VentaServicios` | Tabla `DocumentoServicio` aparte: duplicaría numeración, serie, estado e impresión; `FiscalDocument` ya es el anexo opt-in sobre `Factura` |
| D7 | El helper de numeración de serie se extrae a servicio compartido y lo consumen facturar (productos) y facturar (servicios) | Duplicar la lógica de serie en venta-servicios: dos fuentes de verdad del consecutivo |

## 1. C-1 — Límite de crédito editable

### Contrato de la action

`updateLimiteCreditoClienteAction(input: { clienteId: string; limiteCredito: number | null })` en `features/clientes/actions.ts`:

1. `requireTenant` + `requireFeature(user, 'clientes', …)` + `requirePermission(user, 'operaciones.clientes.limite-credito', 'editar el límite de crédito del cliente')`.
2. Schema Zod `limiteCreditoSchema`: `limiteCredito: z.number().int().min(0).nullable()` — `null` = sin tope (semántica existente del campo).
3. Cliente del tenant o `NOT_FOUND`.
4. Persistencia + auditoría en una transacción: `prisma.$transaction` con `cliente.update` y `AuditLogService.logStrict({ accion: 'UPDATE', entidad: 'CLIENTE', entidadId: clienteId, usuarioId, detalles: { tipo: 'LIMITE_CREDITO_ACTUALIZADO', valorAnterior, valorNuevo } }, tx)`.
5. `revalidatePath('/busy/cliente')`.

### Soporte

- Union `AuditEntity` de `lib/services/audit-log-service.ts` gana `'CLIENTE'` y `'VENTA_SERVICIO'` (esta última la usa C-2).
- Permiso nuevo en `lib/auth/permission-registry.ts`: `operaciones.clientes.limite-credito`, category `operaciones`, `defaultRoles: ['manager']`, `sensitive: true`. Se actualiza el fixture `src/lib/auth/__tests__/__fixtures__/permission-parity.json`.
- UI: componente nuevo `features/clientes/components/editar-limite-credito-dialog.tsx` (<200 líneas, JSDoc, español neutro): dialog shadcn invocado desde `cliente-360.tsx` junto al bloque "Límite de crédito"; input numérico en la unidad ya usada por la vista (ver formateo existente al implementar); toasts `sileo`; `router.refresh()`.
- `cliente-360` muestra saldo vs límite; el dialog reutiliza esa lectura (prop `cliente`).

## 2. C-2 — Enforcement del tope en servicios y al facturar

### Helper compartido `features/crm/services/credito-enforcement.ts`

```ts
export interface ExigirLimiteCreditoParams {
  client: Pick<Prisma.TransactionClient, 'cliente' | 'cuentaPorCobrar'>;
  tenantId: string;
  clienteId: string;
  montoRequerido: number;
  user: AuthenticatedUser;
  cuentaExcluidaId?: string; // update: la CxC propia sale del saldo y vuelve como montoRequerido
}
export interface ResultadoLimiteCredito { overrideUsado: boolean; saldoVivo: number; limiteCredito: number | null; }
export async function exigirLimiteCredito(params): Promise<ResultadoLimiteCredito>
```

- Lee `cliente.limiteCredito` (tenant-scoped; `NOT_FOUND` si no existe) y `cuentaPorCobrar.findMany({ estado: { not: 'ANULADA' } })` (select `montoDeuda/montoPagado/estado/cuentaPorCobrarId`).
- `cuentaExcluidaId`: resta el saldo de esa cuenta del total y lo suma a `montoRequerido` — evita doble conteo en update.
- Si `superaLimiteCredito(...)` y `!hasPermission(user, 'ventas.venta.credito-override')` → `ActionError('La venta a crédito supera el límite del cliente. Saldo: … , requerido: …, límite: …', 'CREDITO_EXCEDIDO')` (mensaje alineado con `venta-mutation-service.ts:328`). Si tiene permiso → `overrideUsado: true` (el caller audita dentro de su transacción).
- `montoRequerido <= 0` o límite `null` → retorna sin consultar permiso (fast-path).

### Puntos de llamada

1. **`createVentaServicioAction` — mixto**: tras validar cliente y antes de escribir, `exigirLimiteCredito` con `montoRequerido = Σ cantidad × precio` cuando `condicionPago === 'CREDITO'`. Si `overrideUsado`, auditoría `CREDITO_OVERRIDE` (entidad `VENTA_SERVICIO`, primera venta creada) dentro de la nueva transacción única (C-4).
2. **`createVentaServicioAction` — legacy**: idem, con `montoRequerido = remanente estimado = ventaTotal − Σ anticipos.montoAplicado` (≥0). Auditoría dentro de la tx existente.
3. **`facturarVenta` (`VentaLifecycleService`, PVE)**: dentro de la tx, tras el guard de estado y antes de resolver serie: `montoRequerido = input.montoCredito ?? (input.metodoPago === 'CREDITO' ? venta.total : 0)`; si > 0 → `exigirLimiteCredito`; `overrideUsado` → `AuditLogService.logStrict({ tipo: 'CREDITO_OVERRIDE', … }, tx)` igual que POS. La venta ya exige `clienteId`, no hay caso sin cliente.

### Decisión: facturar servicios NO revalida el tope

La CxC de una venta de servicio nace (y se valida) en la creación (C-2) y se ajusta en update (C-4); facturarla solo emite documento y enlaza la CxC existente, no crea exposición nueva. Revalidar duplicaría el chequeo sobre deuda ya contada. Documentado en spec.

## 3. C-3 — Costo server-side

- Schema: `Servicios.costo Int @default(0)` con comentario de semántica (costo estándar unitario, misma unidad que `precio`). Migración `servicios_costo_catalogo`.
- CRUD de catálogo (`features/servicios/actions.ts` + schemas + form): el costo se edita igual que `precio` (misma superficie de permisos; sin permiso nuevo).
- `assertServiciosDelTenant` pasa a seleccionar `costo` y devolver `{ moneda, precio, costo }`.
- Create mixto y legacy: `costo: catalogo.costo` (snapshot). El valor del payload se ignora porque los schemas dejan de declararlo y son `.strict()` → payload con `costo` es rechazado con `VALIDATION_ERROR` (misma postura que el precio manipulado).
- `updateVentaServicioSchema`: sin `costo`; `updateVentaServicioAction` deja de escribirlo (el snapshot histórico es inmutable).
- UI: `servicios-cart.tsx` pierde el input/updateCosto (muestra el costo del catálogo como referencia si la fila lo trae); `servicios-prestados-form.tsx` pierde el campo costo. `revalidatePath('/busy/venta-servicios')` → `/busy/servicios` (ruta real, bug menor corregido de paso en los archivos que se tocan).
- Verificación previa con grep: writers móviles/API de venta de servicios (si existen) reciben el mismo schema; se listan en la evidencia de la fase.
- Consumidores de `VentaServicios.costo` (reporte `actions-reconciliacion.ts:950-966`, política `SOLD_SERVICE_COST`) no cambian: ahora leen el costo del catálogo congelado a la venta.

## 4. C-4 — Atomicidad modo mixto + update coherente

### Modo mixto (reescritura del bloque actions.ts:112-148)

Una sola `$transaction(async (tx) => { … })`:

1. Crear todas las filas `VentaServicios` con `tx` (snapshot precio/moneda/costo del catálogo).
2. Si `CREDITO`: crear una CxC por fila creada (mismo `tx`).
3. Si `overrideUsado` (C-2): auditoría `CREDITO_OVERRIDE` con el mismo `tx`.
4. Respuesta idéntica a la actual (`mode`, `lineasProcesadas`, `ventasServicios`) para no romper la UI.

`withPeriodValidation` se conserva como wrapper.

### Update

`updateVentaServicioAction` reescrito con una transacción interactiva:

1. Lectura: venta (tenant) + CxC activa por `ventaServicioId` (`estado != 'ANULADA'`) + count de `reconciliacionServicio`.
2. Cambio de `cantidad` con `reconciliacionServicio > 0` → `ActionError('HAS_REFERENCES')` (los cobros exigen monto == total; renumerar deuda con cobros parciales registrados corrompe la reconciliación).
3. Nuevo total ≠ deuda en CxC y `estado === 'PAGADA'` → `ActionError('CXC_PAGADA', 'No se puede modificar una venta cuya deuda está pagada')`. `ANULADA` no se toca (sigue fuera del guard).
4. Cambio de `clienteId` con CxC activa → `exigirLimiteCredito` del nuevo cliente (`cuentaExcluidaId` = la CxC propia) y `CxC.clienteId` actualizado en la misma tx; override auditado.
5. Cambio de `cantidad` con CxC activa y sin cobros → `ventaServicios.update` + `cuentaPorCobrar.updateMany({ where: { cuentaPorCobrarId, estado: { in: ['PENDIENTE','PARCIAL'] } }, data: { montoDeuda: nuevoTotal } })` (claim de estado: si entre lectura y escritura cambió el estado, el updateMany no toca nada y la tx falla con `CXC_ESTADO_CAMBIO`).

## 5. C-5 — Delete con protección de CxC

- Guard nuevo en `deleteVentaServicioAction` después del guard de reconciliaciones: `cuentaPorCobrar.findFirst({ ventaServicioId: id, estado: { not: 'ANULADA' } })` → `ActionError('VENTA_CON_CXC_ACTIVA', 'No se puede eliminar la venta: tiene una cuenta por cobrar activa; anula primero la cuenta por cobrar')`.
- Si solo hay CxC `ANULADA`: se eliminan junto con la venta en una `$transaction` interactiva (la FK Restrict lo exige y evita basura referencial).
- Schema: relación `CuentaPorCobrar.ventaServicio` → `onDelete: Restrict` (migración `cxc_servicio_restrict`; defensa en profundidad contra writers futuros). Las CxC ya huérfanas (`ventaServicioId = null`) no se ven afectadas.
- Test estático de contrato: `prisma/schema.prisma` declara `onDelete: Restrict` en esa relación (patrón de contrato estático del proyecto).

## 6. C-6 — Factura-documento para servicios

### Decisión D6 en detalle

- `Factura` es el único documento de venta del sistema (numeración por `SerieFacturacion`, estados `PENDIENTE|PAGADA|ANULADA`, impresión `/busy/invoice/print`). Para servicios se **extiende** con `ventaServicioId String? @unique` + relación (migración `factura_venta_servicio`). `ventaId` sigue nullable: una factura referencia la venta de productos **o** la fila de venta de servicio.
- `VentaServicios` **no gana campo `estado`** en v1. Ciclo real: la fila nace y se cobra (`reconciliado`), la deuda vive en `CxC.estado`, el documento vive en `Factura.estado`. Una máquina de estados propia (PEDIDO/ENTREGADA/…) no modela nada real: la venta de servicio es instantánea, sin entrega diferida.
- `FiscalDocument` no se toca: es anexo timbrable opt-in (feature `facturacion-fiscal`) y funcionará sobre estas facturas sin cambios adicionales cuando se active.

### Numeración compartida (D7)

`features/ventas/services/serie-facturacion-service.ts`: `resolverSerieYNumero(tx, tenantId)` → `{ serie, numeroFactura }` replicando la resolución actual de `facturarVenta` (serie por defecto → primera → crea "FV"; incrementa `consecutivo`; `numeroFactura = prefijo + padStart(6, '0')`). `facturarVenta` (productos) se migra al helper con su regresión completa verde antes de usarlo desde servicios.

### `facturarVentaServicioAction`

`features/venta-servicios/actions.ts`:

1. `requireTenant` + `requireFeature('servicios')` + `requireFeature('facturacion')` + `requireFeature('ventas-factura')` + `requirePermission('ventas.servicios.facturar', …)` (permiso nuevo: category `ventas`, `defaultRoles: ['manager']` + fixture de paridad).
2. Validaciones: venta del tenant; `clienteId` presente (`FACTURA_REQUIERE_CLIENTE` — la `Factura` exige cliente); sin `Factura` previa por `ventaServicioId` (`VENTA_YA_FACTURADA`).
3. Transacción única: `resolverSerieYNumero` → `factura.create({ ventaServicioId, clienteId, numeroFactura, serieId, total, subtotal: total, impuestos: 0, descuento: 0, estado: venta.reconciliado ? 'PAGADA' : 'PENDIENTE', fechaEmision: hoy, fechaVencimiento? })`; si existe CxC activa de la venta → `update` de `facturaId`, `numeroFactura` y `fechaVencimiento` (la deuda no cambia: ya existe desde la creación).
4. No se revalida el tope (ver §2, decisión documentada).
5. `revalidatePath('/busy/servicios')`.

### Cierre del ciclo en el cobro

`AccountingReconciliationService.reconcileService` (usado por web y móvil), dentro de su transacción, tras marcar `ventaServicios.reconciliado = true`:

- `Factura` de la venta (por `ventaServicioId`) → `estado: 'PAGADA'` si estaba `PENDIENTE`.
- CxC enlazada (por `ventaServicioId`) → `montoPagado = montoDeuda`, `estado: 'PAGADA'` (claim con `updateMany` + `estado: { not: 'PAGADA' }`).

Esto cierra el hallazgo de que una CxC `tipoCuenta: 'VENTA_SERVICIO'` jamás pasaba a `PAGADA`.

### UI

Botón "Facturar" en el historial de ventas de servicios (`servicios-content.tsx`, visible solo con `hasPermission('ventas.servicios.facturar')`): dialog con fecha de vencimiento opcional; deshabilitado si la venta no tiene cliente o ya tiene factura. Link a impresión solo si la página `/busy/invoice/print` resuelve facturas sin `ventaId` a bajo costo; si requiere refactor, queda como pendiente documentado en tasks.md (la factura ya existe y es válida).

## 7. Migraciones

| Migración | Contenido | Reversible |
|---|---|---|
| `servicios_costo_catalogo` | `ALTER TABLE servicios ADD COLUMN costo INTEGER NOT NULL DEFAULT 0` | Sí (drop column) |
| `cxc_servicio_restrict` | FK `CuentaPorCobrar.ventaServicioId`: SetNull → Restrict | Sí |
| `factura_venta_servicio` | `ALTER TABLE facturas ADD COLUMN ventaServicioId … UNIQUE` + FK | Sí |

Generadas con `prisma migrate dev --create-only` (o diff manual si no hay DB local), SQL revisado antes de aplicar; Railway además aplica `db-push` con el schema.

## 8. Invariantes transversales

- Ningún writer nuevo acepta del cliente un valor que el servidor debe resolver (precio LP-0, total, costo).
- Toda creación/ajuste de deuda (CxC) ocurre en la misma transacción que la operación que la origina.
- Toda acción sensible audita con `AuditLogService.logStrict` dentro de su transacción.
- Copys de UI y mensajes de error en español neutro internacional.
- Tests unitarios con `@/lib/prisma` mockeado (barrera MM-B); nada toca DB real.

## 9. Riesgos técnicos específicos

- **`.strict()` y costo:** rechazar payloads con `costo` es intencional; se verifica con grep que la UI y cualquier writer servidor se actualizan en el mismo commit.
- **`reconcileService` compartido:** lo consumen web y móvil; el cambio de estado de Factura/CxC es condicional (si existen filas) y cubierto por su suite.
- **Helper de serie:** la extracción es movimiento puro; regresión `venta-lifecycle.test.ts` + `facturacion-ventas-workflow.test.ts` como gate.
- **Decimal vs Int:** `CxC.montoDeuda` es `Decimal` y `VentaServicios.total` es `Int`; los ajustes de deuda usan el `Int` del total directamente (mismo comportamiento que la creación actual, que persiste `venta.total` en `montoDeuda`).
