# Design: Remediación de integridad en ventas, crédito y emisión fiscal

## Enfoque técnico

Materializar cupo comercial cuando nace una obligación CxC por productos, servicios o préstamos cash; crear `PEDIDO` sin deuda no reserva cupo. Un protocolo compartido serializa por `(tenantId, clienteId)` **todos** los cambios de saldo o límite, incluidos pagos y operaciones manuales. El mismo commit guarda obligación y auditoría; un escritor no migrado queda bloqueado, nunca autorizado por lectura optimista. Los reportes de comisión se derivan del mes de venta original y sus devoluciones, sin prometer cierres inexistentes. La emisión individual reclama solamente la factura pedida y conserva resultados inciertos sin reenvío hasta reconciliación documentada. El servidor compara el vuelto declarado opcional con el derivado en centavos.

## Decisiones de arquitectura

### 1. Serialización de crédito en PostgreSQL

**Elección:** en toda entrada que altere cupo, abrir una transacción interactiva y bloquear la fila `Cliente` con `SELECT ... FOR UPDATE` filtrado por `id` y `tenantId` antes de releer `limiteCredito` y **todas** las CxC vivas del cliente mediante `tx`, sin filtrar por origen (productos, servicios, préstamos cash y asientos manuales). Usar una sola definición de saldo neto exigible que incorpore pagos, anulaciones y devoluciones sin doble conteo. El crédito requerido es el incremento neto de exposición confirmado por la operación; validar cambios de saldo manuales positivos con el mismo límite y override explícito, y serializar también los negativos y cambios de límite para evitar lecturas obsoletas. Mantener el bloqueo hasta completar efectos y auditoría; orden de locks cliente → recurso de origen → serie → CxC, ajustando escritores existentes que bloqueen en orden inverso. Preferir `Serializable` además del lock cuando sea compatible; capturar `P2034`/deadlock y reintentar **la transacción completa** hasta 3 veces con jitter, nunca sólo el cálculo. Tras agotar, `CREDITO_CONFLICTO` sin aprobación optimista. No hacer llamadas externas dentro de la transacción. Cliente ajeno/inexistente: rechazo; límite nulo: sin tope, no sin protocolo.

**Condición imprescindible:** inventario de escritores observado en Engram #3946: `facturacion-workflow.ts`, `venta-mutation-service.ts`, `venta-lifecycle-service.ts`, venta de servicios, `actions-cuentas.ts`, reconciliación de ventas (API/actions/service), devoluciones y cancelación, préstamos cash (API/handlers/service) y `accounting-accounts-service.ts`. Añadir cambios de `Cliente.limiteCredito` futuros al mismo contrato (no se observó writer actual). La serialización sólo funciona cuando **cada** escritor entra al protocolo; `Serializable` en uno de ellos no protege frente a otro en `READ COMMITTED`. Centralizar las mutaciones de CxC o instalar una barrera transitoria transaccional de base de datos comprobable para bloquear escritores legacy; no activar cupo nuevo mientras haya caminos que eludan ambas. Todo endpoint no migrado retorna error explícito de mantenimiento antes de escribir CxC, aun si ello suspende temporalmente la operación; no delegar el fail-closed a un flag sólo en UI. Evitar dependencia cíclica: mover la lectura previa de crédito dentro de la transacción y releer venta/cliente dentro de `facturarVenta`; no reutilizar `clienteLimiteCredito` capturado fuera. Verificar que resolución de turno externa no deje cobros irreversibles tras rechazo. Revisar diff del `facturacion-workflow.ts` sucio antes de implementar, sin sobrescribirlo.

**Alternativas descartadas:** consulta previa más `updateMany` sobre Venta (no bloquea ventas independientes); reserva en `PEDIDO` (contradice alcance); mutex en memoria (no funciona entre instancias). **Costo:** contención por cliente y reintentos; preservar un error explicable al usuario.

### 2. Cantidad autorizada y override consistente

**Elección:** calcular `montoRequerido` como incremento neto de CxC de cualquier origen, no como simple total de venta: MIXTO, crédito completo, vencimiento en `applyFacturacionCobroWorkflow`, servicio, desembolso de préstamo cash y ajuste manual deben usar el mismo cálculo; rechazar combinaciones ambiguas antes de escribir. Conservar `saldoVivoCliente` y `superaLimiteCredito` como reglas puras con centavos exactos. Al **exceder** el cupo, solicitar override explícito, permiso `ventas.venta.credito-override` (o permiso equivalente específico que se defina para servicios/préstamos/manuales) y motivo acotado no vacío; permiso o motivo aislados no autorizan. `AuditLogService.logStrict(..., tx)` registra tenant, actor, cliente, origen/ID, saldo anterior, límite, delta, exceso y motivo; si falla revierte el commit. No auditar éxito de override en rechazos o dentro de cupo.

**Alternativa:** permiso implícito como hoy; descartada porque no expresa intención ni evidencia. **Tradeoff:** nuevo campo opcional de input, UI sólo lo solicita ante excepción; clientes antiguos sin motivo reciben rechazo únicamente si intentan exceder límite.

### 3. Período de comisión y gate de cierre

**Elección:** seleccionar ventas por `Venta.createdAt` en ventana `[desde, hasta)` del período reportado y `tenantId`/empleado, luego sumar **una sola vez** devoluciones `REGISTRADA` por `ventaId`, sin filtrar por fecha de devolución. Respetar parcialidades e IDs únicos (`@@unique([tenantId, idempotencyKey])` existente); recalcular reporte derivado en consulta, sin escribir ajustes ni ejecutar backfill en esta fase. Mostrar «Cálculo actualizado», no «Liquidación». `PeriodoContable`, `CierreContable` y `Pagosalario` no acreditan liquidación de comisiones: no crear modelo de liquidación ahora ni inferir cierre. Bloquear **ajustes de períodos liquidados** y cualquier importación/backfill que altere resultados cerrados hasta una fase posterior con registro verificable de liquidación, política y mecanismo de ajuste único referenciado a venta/devolución/período; sin esa evidencia, sólo se corrige el cálculo informativo por mes original.

**Alternativa:** agrupar por fecha de devolución o inferir cierre del calendario contable; descartada por imputación incorrecta y falsa garantía. **Tradeoff:** un informe antiguo derivado puede cambiar al aparecer nuevas devoluciones; etiquetarlo como cálculo actualizado.

### 4. Emisión específica y recuperación fiscal fail-closed

**Elección:** reemplazar en las acciones individuales `procesarSiguientePendiente(tenantId, adapter)` por `procesarFacturaPendiente({tenantId, facturaId, adapter})`. Consultar documento y factura por ambos IDs y tenant; claim condicional `PENDIENTE → PROCESANDO` sobre `(fiscalDocumentId, tenantId, estado)`; perdedores leen estado actual sin llamar al adaptador. `TIMBRADA` no se reenvía. El procesador de cola general, si se conserva para workers, invoca el procesador dirigido con el ID elegido y no se usa desde acciones individuales.

Introducir estado explícito `INCIERTA` (migración aditiva) y un registro durable de intento previo al envío, `FiscalAttempt` o equivalente con `(tenantId, fiscalDocumentId, attemptId)` único, estado, hora, referencia externa, hash/metadatos redactados de solicitud/respuesta y eventos append-only. El claim atómico tenant+factura+documento `PENDIENTE → PROCESANDO` crea `attemptId` persistido **en la misma transacción**; sólo el proceso dueño de ese intento puede finalizar por CAS `(tenantId, fiscalDocumentId, estado=PROCESANDO, attemptId)`. Enviar fuera de la transacción; guardar resultado+evento en una transacción. Un crash tras claim puede dejar intento sin enviar: aun así es incierto hasta demostrarlo externamente; nunca decidir reenvío por timestamp. Adaptar clasificación de **todas las excepciones post-envío** en `fiscal-emision-service.ts` y adaptadores: únicamente rechazo explícito, autenticado y correlacionado al intento permite `RECHAZADA`; timeout, desconexión, error de parseo, excepción genérica, resultado dudoso o fallo al guardar confirmación dejan `PROCESANDO`/`INCIERTA` sin retry. Los `RECHAZADA` históricos sin prueba definitiva se tratan como inciertos y se excluyen de cualquier retry automático; `PROCESANDO` histórico se inspecciona y marca incierto por CAS, sin reenvío. Un `RECHAZADA` con rechazo definitivo comprobado podrá iniciar **nuevo intento dirigido** tras decisión autorizada; no confundir con evidencia negativa de no emisión para un caso incierto. Inspección externa o operador fiscal autorizado con motivo y prueba verificable (emisor, tenant, factura, número, importes, identidad del intento) confirma sin llamar al adaptador, o habilita reintento sólo si prueba no emisión; identidad cruzada bloquea la operación y conserva historial. El `LocalAdapter` con UUID sintético no cuenta como prueba de PAC real.

**Alternativa:** cron que reprocesa `PROCESANDO` o marcar toda excepción `RECHAZADA`; ambas arriesgan duplicar comprobantes. **Tradeoff:** intervención humana y estado pendiente más largo, a cambio de seguridad fiscal. `LocalAdapter` no demuestra comportamiento remoto: pruebas con adaptador falso que simule envío y timeout.

### 5. Vuelto compatible

**Elección:** `createVentaSchema` conserva `cambioDevuelto` opcional/nullable; cuando se proporciona un número, exigir `montoRecibidoEfectivo` y comparación exacta en centavos con `validarCobro` (EFECTIVO/MIXTO: recibido menos `montoEfectivo`; otros métodos: no admitir vuelto positivo). Revalidar en el servicio antes de efectos, persistiendo siempre el valor derivado, no el declarado. Campo ausente o `null` mantiene cálculo previo y consumidores legacy. No usar floats ni tolerancia arbitraria: esquema actual usa enteros centavos.

**Alternativa:** confiar en POS; descartada porque el campo se acepta hoy sin validación. **Tradeoff:** declaraciones inconsistentes antes toleradas pasan a error específico `CAMBIO_INCONSISTENTE`.

## Flujo de datos

```text
POS / facturar pedido → Server Action existente (withAction, tenant/auth)
  → Zod pago + override opcional → tx PostgreSQL → lock Cliente del tenant
  → releer límite + CxC → regla pura → rechazo o autorización
  → venta / servicio / préstamo / ajuste + CxC + AuditLog strict → commit

Factura seleccionada → emitirFiscalAction(facturaId) → claim dirigido tenant+factura
  → claim + attemptId durable → adapter.generar → TIMBRADA / RECHAZADA probada / INCIERTA
  → reconciliación autorizada con evidencia → decisión CAS + evento (sin envío)

Reporte(tenant, empleado, período origen) → ventas del período
  → devoluciones por ventaId (cualquier fecha) → comisión derivada actual
```

## Archivos afectados previstos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/features/ventas/services/credito-transaccional.ts` | Crear | Lock tenant/cliente, consulta vía `tx`, decisión y retry acotado compartidos. |
| `src/features/ventas/services/venta-mutation-service.ts` | Modificar | Eliminar lectura de crédito fuera de tx; validar vuelto; consumo, override y auditoría en commit. |
| `src/features/ventas/services/venta-lifecycle-service.ts` | Modificar | Releer pedido dentro de tx, crédito al facturar antes de reclamar estado, override y auditoría atómicos. |
| `src/features/ventas/services/facturacion-workflow.ts` | Revisar/modificar mínimo | Determinar crédito real de CxC según vencimiento; preservar cambios concurrentes del worktree. |
| `src/features/ventas/services/venta-servicios*.ts` y rutas/actions de servicios (confirmar rutas exactas en implementación) | Modificar | Alta de CxC de servicios entra al mismo lock y verificación. |
| `src/features/contabilidad/actions-cuentas.ts`, `src/features/contabilidad/actions-reconciliacion.ts`, servicios de reconciliación de ventas y `accounting-accounts-service.ts` | Modificar | Pagos, cargos y ajustes manuales serializados; prohibir escritura legacy no migrada. |
| Rutas/actions de reconciliación ventas y devoluciones/cancelación (`src/features/ventas/`, `src/app/api/ventas/`) | Modificar | Aplicar protocolo y orden de locks a cambios netos de CxC. |
| Rutas/handlers/services de préstamos cash (`src/app/api/`, `src/features/`; confirmar nombres exactos) | Modificar | Desembolso y cambios de saldo comparten cupo comercial y barrera fail-closed. |
| `src/features/ventas/schemas.ts` | Modificar | Motivo/solicitud override opcionales en creación/facturación; refinamiento de vuelto presente. |
| `src/features/crm/services/credito-calculo.ts` | Revisar | Conservar regla pura; sólo adaptar normalización monetaria si hace falta. |
| `src/features/empleados/services/comision-service.ts` y vista de reporte existente | Modificar | Devoluciones por IDs de ventas originales, rango semiabierto, etiqueta de cálculo derivado; sin liquidación nueva. |
| `src/features/facturas/services/fiscal-emision-service.ts` | Modificar | Claim específico, clasificación de incertidumbre, eventos atómicos y reconciliación. |
| `src/features/facturas/actions-fiscal.ts` | Modificar | Emisión/reintento dirigidos; nueva acción de reconciliación autorizada y tenant-scoped. |
| `src/features/facturas/components/fiscal-panel-dialog.tsx`, `src/features/facturas/components/fiscal-badge.tsx` | Modificar | Estado incierto, evidencia y opción manual sólo para permiso autorizado; no auto-retry. |
| `prisma/schema.prisma`, `prisma/migrations/<timestamp>_fiscal_incierta/` | Modificar/crear | Estado `INCIERTA`, intento durable y unicidad/índices tenant+documento+intento; sin modelo de liquidaciones. |
| `src/features/ventas/**/__tests__/*.test.ts`, `src/features/facturas/**/__tests__/*.test.ts`, `src/features/empleados/**/__tests__/*.test.ts` | Crear/modificar | Contratos y regresiones enfocadas. |
| `src/features/ventas/**/__integration__/*.test.ts`, `src/features/facturas/**/__integration__/*.test.ts` | Crear | Concurrencia, aislamiento y CAS sobre PostgreSQL real. |

## Contratos y límites UI/servidor

```ts
interface SolicitudCreditoOverride {
  solicitarCreditoOverride?: boolean;
  motivoCreditoOverride?: string | null;
}
interface ConciliacionFiscalManual {
  facturaId: string;
  decision: 'CONFIRMAR' | 'HABILITAR_REINTENTO';
  attemptId: string;
  referenciaExterna: string;
  motivo: string;
  evidencia: { emisor: string; numeroFactura: string; totalCentavos: number; comprobante: string };
}
```

El cliente puede mostrar cupo estimado, diferencia de vuelto y motivo antes de enviar, pero nunca concede crédito ni valida evidencia fiscal como autoridad. `withAction`/servicio verifican permisos, tenant, estado, centavos y CAS; rutas HTTP legacy deben aplicar las mismas garantías. Toast de cupo excedido: «La operación supera el límite de crédito. Solicita autorización e indica un motivo.»; conflicto: «No se pudo confirmar el crédito por una operación simultánea. Vuelve a intentarlo.»; escritor pendiente de migración: «Esta operación no está disponible temporalmente para proteger el saldo del cliente.»; vuelto: «El cambio declarado no coincide con el efectivo recibido.»; incertidumbre fiscal: «La emisión requiere verificación. No se enviará de nuevo automáticamente.» No mostrar botón «Reintentar emisión» para `PROCESANDO`/`INCIERTA` ni `RECHAZADA` sin rechazo probado; formulario manual sólo para autorizado, evidencia visible antes de confirmar. No revelar datos de otro tenant en mensajes.

## Dirección visual

Sin rediseño del POS: intervención **libro de control fiscal** en el diálogo existente, tono documental y sobrio. Sobre la superficie shadcn actual, usar acento ámbar oscuro `#9A6200` con fondo pálido `#FFF5DE` para «Requiere verificación»; verde existente sólo para confirmación y rojo sólo para rechazo probado. Mantener la tipografía de interfaz existente para continuidad; numeración, UUID y timestamps en monoespaciada tabular. Layout de dos bandas: estado y factura identificada arriba; cronología de intentos/evidencias con bordes finos debajo; pie contextual con acción manual sin botón de reenvío prominente. A 320 px, bandas apiladas y acciones visibles sin cubrir evidencia. Motivo y referencia externa obligatorios y etiquetados; foco visible, `aria-live` para cambios de estado y errores asociados a inputs. Transición de opacidad de 120–160 ms al cargar evidencia, sin animación celebratoria ni spinner persistente para incertidumbre; respetar `prefers-reduced-motion`. La comisión muestra una línea de período original y sello «Cálculo actualizado» sin semántica de liquidación. Este carácter de expediente distingue incertidumbre de error sin gradientes ni dashboard genérico.

## Pruebas (TDD)

| Capa | Casos | Método |
|---|---|---|
| Unitarias | saldo/cupo, permiso+motivo, componente mixto/CxC por vencimiento, vuelto presente/ausente/null, parcialidades de comisión, clasificación fiscal | Vitest; mock obligatorio de Prisma en unitarias, fixtures de centavos. |
| Integración PostgreSQL | directa vs pedido, servicio vs producto, préstamo cash vs pedido, cargo manual vs servicio y pago/devolución/cancelación concurrentes; fallo de escritor legacy, cambio de límite, rollback de auditoría, retries y tenants; claims A/B, caída entre claim/envío y envío/persistencia, `RECHAZADA` histórica incierta y reconciliación CAS | `src/**/__integration__/` con config `pnpm test:integration`, `DATABASE_URL_TEST` aislada; barreras de concurrencia y adaptador falso; verificar ausencia de efectos parciales o reenvíos. |
| UI | estados de fiscal y toasts, formulario de evidencia, foco/ARIA, pantalla pequeña; rechazo visible de override/vuelto | Testing Library + vitest-axe; E2E Playwright sólo recorrido crítico si fixture fiscal disponible. |

## Migración, rollout y rollback

1. Confirmar rutas reales de todos los escritores, matriz CxC por vencimiento, enum fiscal y consulta del proveedor; revisar diff sucio antes de tocar `facturacion-workflow.ts`. Migrar esquema aditivo primero (estado `INCIERTA`, identidad durable de intento y evidencia/eventos); verificar compatibilidad con workers antiguos **antes** de habilitar emisión. No almacenar XML sensible en logs.
2. Desplegar barrera fail-closed en cada escritor CxC no migrado y congelar reintentos fiscales inciertos/históricos `PROCESANDO` y `RECHAZADA` sin prueba. Migrar progresivamente producto, servicios, préstamos cash, manuales, pagos, devoluciones/cancelación y reconciliación al protocolo común. Durante transición no activar crédito nuevo si hay un camino alternativo que pueda escribir sin lock; probar carreras mixtas reales en cada etapa. Telemetría por tenant y origen de escritor bloqueado.
3. Activar por tenant sólo tras inventario exhaustivo, tests mixtos y cero escritores legacy activos. Inspeccionar intentos históricos, conservar evidencia y clasificar por CAS **sin enviar nada**. Corregir reporte derivado de comisiones con vista previa por tenant/período; no ejecutar backfill de liquidaciones supuestas. Ajustes de períodos liquidados permanecen bloqueados hasta fase posterior.
4. Ante regresión, detener nuevas operaciones fiscal/manual y backfill; revertir código compatible sin revertir columnas/enum ni borrar AuditLog, intentos o evidencias. Un `INCIERTA` jamás vuelve automáticamente a `PENDIENTE` por rollback. Compensar ajustes de comisión ya publicados sólo con registro trazable.

## Riesgos y preguntas abiertas

- **Bloqueante antes del rollout:** confirmar todos los escritores y protegerlos con lock o barrera fail-closed, incluida infraestructura de escrituras manuales; `Serializable` unilateral no sustituye el protocolo común.
- **Bloqueante de conciliación positiva:** definir prueba externa aceptable por jurisdicción y permiso concreto de operador fiscal; nunca interpretar una captura no verificable como confirmación o no emisión.
- **Gate explícito:** no se crea modelo de liquidación ahora; quién aprueba política y mecanismo futuro de ajustes queda fuera de esta fase.
- Examinar enum/constraints vigentes de `EstadoFiscalDocumento` y compatibilidad de despliegue con workers anteriores; impedir que un worker legacy reencole un estado incierto.

## Discrepancias que requieren actualización de spec antes de implementación

- `specs/integridad-ventas/spec.md` §§9–44 y 138–149 sólo explicita ventas directas/pedidos; ampliar cupo comercial para CxC de servicios, préstamos cash, cargos manuales, pagos, reconciliación, devoluciones/cancelación, cambio de límite y rechazo fail-closed de escritores no migrados, con carreras mixtas y permisos de override por origen.
- §§89–101 y 149–154 describen ajuste separado y conciliación/backfill condicionados; precisar que **en esta entrega sólo cambia el reporte derivado**, sin crear liquidación, ajuste persistido ni ejecutar backfill sobre períodos liquidados; la fase de liquidaciones es futura.
- §§117–134 no menciona `RECHAZADA` histórica de resultado incierto ni CAS por `attemptId`: añadir prohibición de reenvío automático también para esos casos, clasificación estricta de excepciones post-envío y evidencia externa previa a cualquier autorización.
- El proposal todavía alude a backfill/compensación histórica y sólo menciona crédito de ventas; alinear alcance documental con las decisiones expresas del usuario sin modificar proposal en esta tarea.
