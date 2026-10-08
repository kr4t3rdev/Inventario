# Spec delta — Capa de contabilidad formal

## ADDED Requirements

### Requirement: Plan de cuentas por tenant

Cada tenant con el flag `contabilidad-formal` activo MUST disponer de un plan de cuentas propio sembrado de forma idempotente (diarios, cuentas jerárquicas y mapeo de roles completo). Cada cuenta MUST tener código único por tenant, tipo (`ACTIVO|PASIVO|PATRIMONIO|INGRESO|COSTO|GASTO`) y naturaleza coherente (`DEUDORA` para activo/costo/gasto, `ACREEDORA` para pasivo/patrimonio/ingreso). Las cuentas con flag `aceptaMovimiento=false` MUST NOT recibir líneas de asiento.

#### Scenario: Activación del flag en un tenant nuevo

- **Given** un tenant sin plan de cuentas
- **When** se ejecuta `inicializarPlanContableAction`
- **Then** el tenant obtiene 7 diarios, el plan por defecto (~32 cuentas, 23 hojas con movimiento) y los 23 roles mapeados, y una segunda ejecución no crea duplicados

#### Scenario: Código duplicado

- **Given** un tenant con una cuenta `1.1.01`
- **When** se intenta crear otra cuenta `1.1.01`
- **Then** la operación es rechazada con error de unicidad

### Requirement: Generación de asientos desde eventos de negocio

Todo evento de negocio que hoy produce una escritura de reconciliación (venta, cobro, compra, pago, gasto, nómina, anticipo, préstamo, deuda, ajuste, transferencia, inyección de capital, merma, producción) MUST generar su asiento contable dentro de la misma transacción cuando el motor está en modo `enforce`. En modo `off` el motor MUST ser no-op; en modo `shadow` MUST intentar el asiento y MUST NOT propagar ninguna excepción al flujo de negocio.

#### Scenario: Venta al contado en modo enforce

- **Given** un tenant en modo `enforce` con plantilla `VENTA_CONTADO` mapeada
- **When** se confirma una venta cobrada
- **Then** en la misma transacción se persiste un asiento en el diario de ventas que carga caja/bancos y abona ventas por el total

#### Scenario: Error del motor en modo shadow

- **Given** un tenant en modo `shadow` con un rol de cuenta sin mapear
- **When** se confirma una venta
- **Then** la venta se completa con normalidad y el error queda registrado en el log del motor

### Requirement: Cuadre de partida doble

Un asiento MUST persistirse si y solo si la suma de `debe` iguala la suma de `haber` en moneda funcional, con comparación decimal exacta. Ninguna línea MUST tener `debe` y `haber` a la vez.

#### Scenario: Asiento descuadrado rechazado

- **Given** un evento cuya plantilla produce líneas que no cuadran
- **When** el motor intenta persistirlo en modo `enforce`
- **Then** la transacción falla con `ASIENTO_DESCUADRADO` y no queda asiento ni líneas huérfanas

### Requirement: Idempotencia por origen

Cada asiento MUST registrar `origenTipo` y `origenId` únicos por tenant. Reintentar el mismo evento MUST NOT crear un segundo asiento.

#### Scenario: Reintento de cobro

- **Given** un cobro CxC que ya generó su asiento
- **When** el mismo evento se reintenta (red, reintento de cliente)
- **Then** no existe un segundo asiento con el mismo `(tenantId, origenTipo, origenId)`

### Requirement: Gobernanza de períodos sobre asientos

Toda inserción de asiento MUST pasar por el guard de períodos. Un asiento con fecha en período cerrado MUST ser rechazado en modo `enforce` y el intento MUST quedar en `AuditoriaPeriodo` con evento `INTENTO_BYPASS`.

#### Scenario: Asiento contra período cerrado

- **Given** un período en estado `APROBADO`
- **When** un evento con fecha dentro de ese período intenta asentarse
- **Then** se rechaza con `PERIODO_CERRADO` y existe una fila `INTENTO_BYPASS` con actor y motivo

### Requirement: Integridad encadenada

Cada asiento MUST persistir `hash = SHA256(representación canónica de líneas + número + fecha + hashAnterior)`, formando una cadena por tenant. Debe existir un verificador que recomputa la cadena y detecta cualquier alteración.

#### Scenario: Detección de manipulación

- **Given** un tenant con asientos encadenados
- **When** una línea histórica se altera directamente en base de datos
- **Then** el verificador de cadena señala el asiento exacto donde la cadena se rompe

### Requirement: Valoración multimoneda heredada

Las líneas MUST registrar `montoOriginal`, `monedaOriginal`, `tasaCambio` y `fxEvidenceFingerprint` heredados de la escritura origen. La capa formal MUST NOT recalcular tasas de cambio ni emitir evidencia FX propia.

#### Scenario: Cobro en moneda extranjera

- **Given** una reconciliación en USD con evidencia FX
- **When** se genera su asiento
- **Then** las líneas muestran `debe/haber` en moneda funcional y conservan el fingerprint de la evidencia original

### Requirement: Diferencia cambiaria asentada

Cuando la tasa de cobro difiere de la tasa de reconocimiento, el motor MUST generar líneas en las cuentas `DIFERENCIA_CAMBIARIA_INGRESO` o `DIFERENCIA_CAMBIARIA_GASTO` según el signo de la diferencia.

#### Scenario: Cobro con tasa favorable

- **Given** una cuenta por cobrar reconocida a una tasa y cobrada a una tasa mayor
- **When** se registra el cobro
- **Then** el asiento incluye el abono del excedente en la cuenta de diferencia cambiaria de ingreso

### Requirement: Libros formales

El sistema MUST ofrecer por tenant: libro diario (asientos por período con líneas, filtros y paginación), libro mayor por cuenta (movimientos con saldo corrido según naturaleza) y balance de comprobación de 4 columnas cuyo total de saldos deudores MUST igualar el de acreedores.

#### Scenario: Comprobación cuadrada

- **Given** un período con asientos de varios diarios
- **When** se genera el balance de comprobación
- **Then** las columnas de sumas y de saldos cuadran y el reporte indica el período y la moneda funcional

### Requirement: Conciliación cruzada contra la base caja

El sistema MUST ofrecer un panel que compare, por rubro (efectivo, bancos, inventario, CxC, CxP, capital), el saldo por cuentas contra el saldo del balance calculado actual, mostrando divergencias con detalle.

#### Scenario: Divergencia visible

- **Given** un evento que falló en shadow y dejó la capa formal sin su asiento
- **When** se abre el panel de conciliación cruzada
- **Then** el rubro afectado muestra la divergencia con monto y enlace al detalle

### Requirement: Cierre y apertura formales

Al aprobarse un cierre de período MUST generarse el asiento de cierre (saldo de cuentas de resultado contra `RESULTADO_PERIODO`). Al abrirse el período siguiente MUST generarse el asiento de apertura desde los saldos de `AperturaPeriodo` y el traspaso de `RESULTADO_PERIODO` a `RESULTADOS_ACUMULADOS`. El resumen del cierre MUST incluir los totales del libro formal.

#### Scenario: Cierre aprobado

- **Given** un período `EN_CIERRE` con asientos del ejercicio
- **When** el segundo aprobador aprueba el cierre
- **Then** existe el asiento de cierre contabilizado en el diario `APERTURA_CIERRE` y los saldos de cuentas de resultado quedan en cero

### Requirement: Inmutabilidad de asientos contabilizados

Un asiento contabilizado MUST NOT editarse ni borrarse. La corrección MUST realizarse anulándolo mediante un asiento inverso (`revertidoPorId`), preservando la cadena de hash.

#### Scenario: Corrección de asiento

- **Given** un asiento contabilizado con un importe erróneo
- **When** el usuario solicita su anulación
- **Then** el asiento original queda en estado `ANULADO` y existe un asiento inverso nuevo que lo referencia

### Requirement: Aislamiento multi-tenant

Los modelos de la capa formal MUST estar clasificados como `scoped`; ningún asiento, cuenta, diario o libro de un tenant MUST ser legible ni modificable desde otro tenant.

#### Scenario: Lectura cruzada

- **Given** dos tenants con asientos contabilizados
- **When** un usuario del tenant A consulta el libro diario
- **Then** solo ve asientos del tenant A, aunque conozca identificadores del tenant B

## MODIFIED Requirements — remediación 2026-09-23

### Requirement: Generación de asientos desde eventos de negocio

Reemplaza el requisito anterior: para cada evento soportado y cada writer incluido en la matriz de cobertura, `enforce` MUST persistir exactamente un asiento válido junto con la operación de caja en la misma transacción o MUST rechazar la transacción completa. Plan no inicializado, plantilla o rol ausente y valoración insuficiente MUST NOT considerarse éxito. `off` MUST conservar la operación sin posteo; `shadow` MUST conservar la operación aunque falle el posteo, registrar evento, resultado y causa, y MUST NOT dejar asientos o líneas parciales del intento fallido. La salida observable MUST ser compatible con los contratos transaccionales reales y el typecheck completo MUST quedar libre de errores, sin suprimir diagnósticos.

#### Scenario: Evento correctamente configurado

- **Given** un tenant en `enforce` con plan, roles y plantilla válidos y un evento soportado
- **When** el writer confirma la operación
- **Then** operación y asiento cuadrado con origen único quedan confirmados juntos

#### Scenario: Tenant sin plan en enforce

- **Given** un tenant en `enforce` sin plan inicializado
- **When** se intenta confirmar una venta soportada
- **Then** se rechazan la venta y su reconciliación, y no se registra un asiento

#### Scenario: Rol o plantilla faltante

- **Given** un tenant en `enforce` cuyo plan carece de un rol o plantilla requerida
- **When** se intenta confirmar un evento soportado
- **Then** se rechaza toda la transacción con causa de configuración identificable

#### Scenario: Shadow falla tras iniciar el posteo

- **Given** un tenant en `shadow` y un fallo después de procesar una parte del asiento
- **When** se confirma la operación de negocio
- **Then** la operación se completa y no quedan ni cabecera ni líneas parciales de ese asiento
- **And** se registra el tipo de evento, resultado fallido y causa para ese tenant

La evidencia shadow MUST almacenarse en un outbox del mismo writer, fuera del savepoint
revertido. Su visibilidad MUST implicar commit de la operación; un rollback MUST
eliminarla. La entrega tras commit MUST ser idempotente por id, sin contabilizar
`SIMULADO` como asiento persistido; un fallo de evidencia MUST NOT anunciar éxito.

#### Scenario: Desactivación

- **Given** un tenant en `off` con eventos soportados
- **When** confirma una operación de negocio
- **Then** se conserva su comportamiento de caja sin generar un nuevo asiento formal

### Requirement: Cuadre de partida doble

Reemplaza el requisito anterior: sumas de debe/haber y validaciones de conciliación MUST operar en decimal a una precisión funcional definida antes de activar `enforce`; MUST NOT convertir importes a `number` ni aceptar diferencias por epsilon. Los importes MUST normalizarse conforme a la escala y regla de redondeo aprobadas antes de comparar; cualquier diferencia distinta de cero tras esa normalización MUST impedir persistencia en `enforce`. Una tolerancia de visualización de reportes MUST NOT alterar la integridad del asiento ni declarar verde una conciliación descuadrada.

**Decisión posterior (2026-09-23, prevalece sobre «normalizar/redondear»):** moneda funcional
global de exactamente cuatro posiciones decimales como máximo; MUST rechazar importes
funcionales no representables sin cuantizar ni redondear. Los ceros finales MAY eliminarse
al serializar; la comparación MUST ser Decimal exacta. No existe regla de empate porque
ninguna aproximación está permitida. Tasas y valores originales mantienen evidencia propia.

#### Scenario: Precisión funcional excesiva

- **Given** un importe funcional de `1.23456` o `0.00001`
- **When** se valida antes de construir un asiento
- **Then** se rechaza con causa de precisión y no se reduce silenciosamente a cuatro decimales

#### Scenario: Valor representable con ceros finales

- **Given** un importe funcional `1.23000`
- **When** se valida y serializa
- **Then** se acepta como `1.23` sin cambiar su valor

**Shadow elegido (2026-09-23):** cualquier intento de escritura formal en shadow MUST
aislarse con savepoint comprobado sobre la misma conexión/transacción del writer, y
MUST revertir íntegramente el intento fallido sin abortar la operación. MUST NOT
habilitarse hasta demostrar ese comportamiento y la telemetría ligada al commit mediante
prueba de integración; elegir savepoint no equivale a validarlo.

#### Scenario: Diferencia subcentésima

- **Given** líneas funcionales cuyo debe supera al haber en 0,005 después de la normalización aprobada
- **When** se intenta contabilizar en `enforce`
- **Then** se rechaza la transacción por descuadre y no se persisten líneas

#### Scenario: Conciliación con diferencia real

- **Given** saldos de caja y cuentas que difieren después de aplicar la misma política monetaria
- **When** se calcula la conciliación
- **Then** la discrepancia se informa y el resultado no se declara conforme

### Requirement: Gobernanza de períodos sobre asientos

Reemplaza el requisito anterior: el guard MUST rechazar posteo ordinario en períodos protegidos y registrar `INTENTO_BYPASS` con el actor autenticado real y contexto de operación, incluso cuando se revierte la transacción intentada; MUST NOT atribuir a `system` una acción de usuario. Las operaciones automatizadas sin usuario MUST identificar explícitamente su actor de servicio. Ningún flujo MUST admitir un tenant o permiso decidido solo en cliente.

#### Scenario: Usuario intenta postear en período cerrado

- **Given** una usuaria autenticada del tenant A y un período `APROBADO`
- **When** intenta postear un asiento fechado en ese período
- **Then** se rechaza la operación y queda un `INTENTO_BYPASS` atribuible a esa usuaria, tenant, fecha y operación

#### Scenario: Llamada automatizada

- **Given** una tarea autorizada sin sesión de usuario
- **When** el guard registra un intento prohibido
- **Then** se identifica al actor de servicio y no se inventa una identidad humana

### Requirement: Cierre y apertura formales

Reemplaza el requisito anterior: el cierre MUST saldar ingresos y gastos con líneas no negativas y signo contable correcto tanto para utilidad como para pérdida, cuadrar antes de persistir y usar una fecha incluida en el período cerrado. La apertura MUST usar exclusivamente el período inmediatamente anterior del mismo tenant; MUST NOT sustituirlo por otro cierre más antiguo ni crear asiento si falta ese período, si la fecha está fuera del período entrante o si los saldos no cuadran. El traspaso de resultado del ejercicio a acumulados MUST conservar su signo económico.

#### Scenario: Ejercicio con utilidad

- **Given** ingresos netos mayores que costos y gastos en un período en cierre
- **When** se aprueba el cierre y se abre el período inmediatamente siguiente
- **Then** cierre y apertura cuadran, todas las líneas son no negativas y el resultado acumulado aumenta

#### Scenario: Ejercicio con pérdida

- **Given** gastos netos mayores que ingresos en el período
- **When** se aprueba el cierre y se abre el período inmediatamente siguiente
- **Then** cierre y apertura cuadran, ninguna línea tiene importe negativo y el resultado acumulado disminuye

#### Scenario: Falta cierre del período inmediato

- **Given** existe un cierre antiguo del tenant, pero no uno del período inmediatamente anterior
- **When** se solicita la apertura
- **Then** se rechaza sin tomar el cierre antiguo y sin crear asiento

#### Scenario: Fecha fuera del límite

- **Given** un cierre cuyo período termina antes de la fecha actual
- **When** se aprueba el cierre
- **Then** el asiento usa una fecha contable válida dentro del período o la aprobación se rechaza sin asiento

#### Scenario: Apertura descuadrada

- **Given** saldos de apertura que no cuadran después de aplicar la política monetaria
- **When** se intenta abrir el período siguiente
- **Then** no se persiste asiento de apertura ni apertura formal incompleta

### Requirement: Apertura formal sustentada y aprobación independiente

`AperturaPeriodo` MUST permanecer como cabecera/compatibilidad operativa y MUST NOT ser autoridad del estado de aprobación. `AperturaRevision` append-only MUST ser la autoridad única para estado, presentador/revisor, permisos, versión/digest y referencias de evidencia; líneas MUST FK a la revisión exacta. Una revisión legacy inexistente significa no aprobada. R0.1 aplica a cada importe original/funcional: máximo 4 decimales exactos, sin redondeo ni cuantización, y rechazo si supera precisión o rango de `Decimal(20,4)` (16 enteros). La moneda funcional del diario es CUP; no aceptar otra hasta que un contrato contable verificado demuestre soporte. Para línea CUP, importe funcional=nativo y tasa `1` o `null`. Toda línea en moneda extranjera MUST conservar importe y moneda original/funcional, tasa, fecha efectiva, fuente/provenance y fingerprint; aprobación MUST recomputar conversión/fingerprint desde evidencia inmutable versionada. Una declaración manual puede probar el saldo declarado, pero MUST NOT considerarse prueba de FX. Sin evidencia de valoración funcional, la línea extranjera queda nativa/no valorada y MUST NOT alimentar el mayor/posting. Datos ambiguos/no confiables MUST pasar por captura manual declarada y evidencia, no por suma automática.

El digest MUST usar dominio y versión de contrato explícitos, SHA-256 y serialización determinista: fechas UTC ISO, moneda uppercase, importes Decimal texto plano sin exponentes ni ceros finales, orden estable por identidad de revisión/línea, tenant, período, fecha, rol/cuenta, moneda, monto, identidad/tipo de fuente, versión+hash inmutable de evidencia y todos los campos FX. La aprobación MUST recomputar el digest y hash de evidencia desde los datos persistidos dentro de la misma transacción.

Presentar MUST requerir el permiso activo tenant-scoped `contabilidad.apertura.presentar`; aprobar MUST requerir `contabilidad.apertura.aprobar`, ambos evaluados contra membresía/tenant vigente en servidor. No basta un permiso genérico de lectura. La presentación congela la revisión, sus líneas y evidencia: SQL MUST impedir UPDATE/DELETE de evidencia/líneas de revisiones `PRESENTADA`/`APROBADA`; toda rectificación crea una nueva revisión append-only que referencia la anterior. Quien aprueba MUST ser distinto de quien presentó y estar autorizado para ese tenant. La aprobación MUST revalidar ambos actores/permisos, tenant/período, revisión/digest y hashes de evidencia, límites Decimal, rol/cuenta, fecha, moneda, FX y cuadre exacto; MUST NOT crear un ajuste compensatorio ni plug para cuadrar. La transición de esa revisión a aprobada y su único asiento de apertura MUST ocurrir en una misma transacción, con idempotencia; rollback implica que ninguno persiste. Un `AperturaPeriodo` legacy sin revisión MUST permanecer no aprobado y MUST NOT convertirse en fuente de asiento.

#### Scenario: Captura manual ante fuentes no confiables

- **Given** que los agregados históricos mezclan monedas o no prueban todos los rubros
- **When** se prepara una apertura
- **Then** no se usan esos agregados como saldo aprobado y se exige captura manual por rol/cuenta y moneda con evidencia y revisión independiente

#### Scenario: Rechazo de autoaprobación

- **Given** una apertura presentada por una persona del tenant
- **When** esa misma persona intenta aprobarla
- **Then** la aprobación y cualquier asiento asociado se rechazan sin cambiar el estado ni persistir asiento

#### Scenario: Evidencia cambia tras presentación

- **Given** una apertura presentada con digest de evidencia
- **When** una línea o evidencia difiere antes de aprobar
- **Then** el digest no coincide, la aprobación falla y no se genera asiento

#### Scenario: Apertura legacy sin revisión

- **Given** un `AperturaPeriodo` histórico con agregados y sin estado/evidencia de aprobación
- **When** se solicita generar su asiento formal
- **Then** se trata como no aprobado y no se usa como fuente del asiento

#### Scenario: Valoración funcional no disponible

- **Given** un saldo nativo extranjero sin tasa o conversión respaldada
- **When** se intenta aprobar/publicar en el mayor funcional
- **Then** se conserva como nativo no valorado o se rechaza el posteo; no se inventa tasa ni se crea plug

#### Scenario: Roll-forward desde cierre inmediato

- **Given** un período anterior contiguo aprobado y un cierre formal completo del mismo tenant
- **When** se abre el período siguiente
- **Then** los saldos se copian por cuenta y moneda desde ese cierre y el resultado se traspasa exactamente una vez

#### Scenario: Sin período anterior

- **Given** una primera apertura sin cierre anterior
- **When** se prepara su asiento formal
- **Then** requiere saldos iniciales evidenciados y aprobados independientemente, sin derivarlos de datos vivos agregados

#### Scenario: Cierre de período sin actividad

- **Given** un período abierto que no tiene líneas de resultado contabilizadas para cerrar
- **When** se solicita el cierre en modo `enforce`
- **Then** el cierre es opcional y la solicitud se rechaza si no puede producirse un asiento formal, sin cambiar el estado del período ni crear un asiento de importe cero

#### Scenario: Movimientos compensatorios con resultado neto cero

- **Given** un período abierto con líneas de resultado contabilizadas cuyos saldos entre cuentas se compensan
- **When** se solicita el cierre en modo `enforce`
- **Then** el sistema produce el asiento formal de cierre desde las líneas de cierre verificables y no trata el resultado neto cero como ausencia de actividad
- **And** ninguna transición a `CERRADO` o `APROBADO` se confirma sin un asiento formal de cierre

## ADDED Requirements — remediación 2026-09-23

### Requirement: Preflight y replay histórico controlado

El replay opt-in MUST limitarse al tenant y período autorizados y MUST requerir preflight persistido y vinculado a la ejecución, autorización verificable, exclusión concurrente, origen idempotente y un `replayRunId` rastreable. El preflight MUST tener una vigencia predeterminada de 24 horas, aprobada por el usuario el 2026-09-26; el plazo comienza cuando se genera el preflight, según confirmó el usuario el 2026-09-26. El dry-run MUST clasificar la totalidad de fuentes en reproducibles, omitidas, ambiguas y sin FX indispensable, con causas y conteos; MUST NOT contabilizar merma a cero cuando falta valoración derivable. El replay MUST omitir individualmente las fuentes ambiguas, sin FX indispensable, sin costo verificable o fuera del período, registrar identidad y causa de cada omisión, y continuar con las fuentes reproducibles autorizadas. El replay MUST dejar evidencia de conteos y conciliación posterior; MUST NOT declararse conforme ni habilitar `enforce` mientras haya fuentes omitidas o discrepancias. Cualquier excepción de escritura en período protegido MUST quedar acotada al replay autorizado y auditada, sin abrir la escritura ordinaria.

El preflight MUST persistir versión y digest SHA-256 de una serialización canónica
y determinista de tenant, período, fuentes ordenadas, valoración, evidencia FX,
clasificación y causas de omisión. La aprobación MUST vincularse a esa versión y
digest. El servidor MUST recomputarlos bajo lock antes del replay; cualquier cambio
MUST invalidar la aprobación y exigir un nuevo preflight y nueva aprobación.

Cada replay de período MUST confirmar todos los asientos válidos y su estado de run en
una sola transacción, o MUST revertirlos todos ante un fallo; MUST NOT confirmar lotes
parciales. Las fuentes omitidas con causa permanecen omitidas, no se convierten en asientos.

La aprobación MUST provenir de un manager autenticado, con permiso vigente para el tenant,
cuya identidad sea distinta de la persona que solicitó el replay. El servidor MUST
rechazar la autoaprobación y MUST revalidar identidad, pertenencia y permiso al ejecutar.

#### Scenario: Fuente o valoración cambiada después de aprobar

- **Given** un preflight aprobado cuyo digest versionado corresponde al snapshot original
- **When** cambia una fuente, su valoración, evidencia FX o causa de omisión antes del replay
- **Then** el servidor rechaza la ejecución sin postear y exige otro preflight y aprobación

#### Scenario: Fallo a mitad del replay de un período

- **Given** un período autorizado con varias fuentes reproducibles
- **When** falla el posteo de una fuente después de construir asientos anteriores
- **Then** ningún asiento ni avance del run para ese período queda confirmado

#### Scenario: Autoaprobación o permiso insuficiente

- **Given** un preflight generado por una persona del tenant
- **When** esa misma persona intenta aprobarlo, o el manager aprobador carece del permiso vigente
- **Then** se rechaza la aprobación sin habilitar el replay

#### Scenario: Merma con valoración y evidencia suficientes

- **Given** una merma histórica con costo funcional derivable de su fuente y evidencia FX requerida disponible
- **When** se ejecuta el replay autorizado de su tenant y período
- **Then** se contabiliza el costo real con origen único y queda asociado al `replayRunId`

#### Scenario: Merma sin costo derivable

- **Given** una merma cuyo costo no puede determinarse sin suposiciones
- **When** se ejecuta el dry-run
- **Then** se clasifica como omitida con causa; no se propone un asiento por cero ni se detiene el replay de otras fuentes válidas

#### Scenario: FX indispensable ausente

- **Given** una fuente multimoneda que requiere evidencia FX y no la conserva
- **When** se ejecuta el dry-run
- **Then** se cuenta como omitida sin FX con causa verificable, no se inventa una tasa y no se detiene el replay de otras fuentes válidas

#### Scenario: Fuente fuera del período o ambigua

- **Given** una fuente fuera del período autorizado o con origen/valoración ambiguos
- **When** se ejecuta el replay autorizado
- **Then** se omite esa fuente con causa auditable y continúan las fuentes reproducibles; la cobertura no se declara conforme

#### Scenario: Preflight ajeno, vencido o modificado

- **Given** un preflight que no corresponde al tenant, período, contenido o vigencia de la ejecución solicitada
- **When** se intenta ejecutar el replay
- **Then** se rechaza sin contabilizar fuentes

#### Scenario: Ejecución concurrente o reintento

- **Given** un replay en curso o fuentes ya posteadas del mismo origen
- **When** se lanza otro replay para el mismo alcance
- **Then** no se duplican asientos ni se producen ejecuciones simultáneas conflictivas

#### Scenario: Conciliación posterior divergente

- **Given** un replay autorizado que termina con diferencias contra el balance o snapshot de referencia
- **When** se calcula el resultado final
- **Then** el run expone `replayRunId`, conteos, diferencias y estado no conforme; no se anuncia éxito contable

### Requirement: Gate verificable de habilitación y reversión

Antes de activar `enforce` para cada tenant, el sistema MUST disponer de matriz de cobertura de eventos y writers, typecheck completo limpio, lint y suites focalizadas/relacionadas verdes, pruebas RED→GREEN de los fallos de remediación y evidencia de `shadow` de al menos una semana con cobertura, latencia, fallos y conciliación por tenant y tipo de evento. MUST existir aprobación responsable y criterio de reversión registrados. Las pruebas unitarias MUST aislar Prisma; las pruebas con base real MUST usar exclusivamente la configuración de integración. Ante un incidente, MUST poder detener nuevos posteos y replay del tenant, preservar asientos/evidencia existentes y exigir nuevo gate antes de reactivar; MUST NOT eliminar registros publicados ni usar rollback destructivo del schema en producción.

#### Scenario: Shadow observado y aprobado

- **Given** un tenant con al menos siete días de evidencia continua, métricas completas, conciliación conforme y cobertura validada
- **When** la persona responsable aprueba `enforce`
- **Then** la aprobación conserva evidencia y criterio de reversión específicos del tenant

#### Scenario: Shadow incompleto o fallido

- **Given** menos de siete días de observación o fallos, eventos sin cobertura o conciliación divergente
- **When** se solicita `enforce`
- **Then** no se habilita y se informan las causas pendientes

#### Scenario: Error luego de publicar asientos

- **Given** un tenant en `enforce` con asientos ya publicados y una discrepancia detectada
- **When** se ejecuta la reversión operativa
- **Then** se detienen nuevos posteos y replays del tenant, se preserva la evidencia y se abre conciliación
- **And** ninguna tabla ni asiento publicado se elimina por el rollback

### Requirement: Cobertura no evaluable y autorización del replay

Una conciliación de período parcial o de rubro sin fuente comparable MUST informarse
como `NO_EVALUABLE`, MUST NOT presentarse como conforme y MUST bloquear la promoción
a `enforce`. El autorizador de replay MUST ser manager autenticado y autorizado para
el tenant y MUST ser distinto del solicitante. Las fuentes no reproducibles se
omiten individualmente con causa, pero no acreditan conformidad; el digest SHA-256
versionado de snapshot canónico fue aprobado el 2026-09-26 y cada período se confirma
atómicamente. La duración
predeterminada de 24 horas desde la generación se aprobó por separado el 2026-09-26.

#### Scenario: Período parcial sin cobertura verificable

- **Given** un período parcial o un rubro sin fuente comparable
- **When** se evalúa la conciliación para promover a `enforce`
- **Then** el estado es `NO_EVALUABLE` y se bloquea la promoción

### Requirement: Evidencia FX persistida por el writer de origen

Un writer que opera en moneda extranjera MUST persistir en la fuente o en un snapshot
de valoración transaccional su moneda original, importe funcional, tasa, fecha efectiva,
procedencia y fingerprint antes de llamar a `postEvento`. El asiento MUST heredar esa
misma evidencia; MUST NOT reconstruir un fingerprint solo en memoria ni inferir la tasa
desde un saldo de cuenta. Si el modelo de origen no puede persistir la evidencia, el
writer MUST rechazar la operación extranjera con error identificable y sin alterar caja.

#### Scenario: Ajuste bancario extranjero con evidencia

- **Given** un ajuste USD con tasa válida y fecha efectiva de aplicación
- **When** se persiste el ajuste y se genera el asiento
- **Then** la fila AjusteBancario conserva fingerprint y valoración funcional y las
  líneas del asiento heredan ese fingerprint exactamente

#### Scenario: Transferencia entre cuentas con moneda extranjera y funcional

- **Given** una transferencia USD→CUP con tasa efectiva persistida en la fila de origen
- **When** el motor postea los dos lados de tesorería
- **Then** el snapshot FX y el asiento conservan la misma tasa, monto funcional y fingerprint

#### Scenario: Transferencia entre dos monedas extranjeras sin cotización cruzada

- **Given** cuentas USD y EUR y un único tipo de tasa sin cotización cruzada documentada
- **When** se solicita la transferencia
- **Then** se rechaza con `FX_INSUFICIENTE` sin modificar saldos ni crear asiento

#### Scenario: Compra a crédito en moneda extranjera

- **Given** una compra PAGO_PARCIAL en USD con tasa y fecha efectiva de compra
- **When** se crea el documento y su cuenta por pagar
- **Then** CompraDocumento conserva monto funcional y fingerprint y el asiento COMPRA_CREDITO hereda ambos
- **And** si falta tasa o fecha, no se crea documento, CxP ni asiento

#### Scenario: Inyección o pago de capital en moneda extranjera

- **Given** una cuenta bancaria USD activa y una tasa con fecha efectiva
- **When** se registra la inyección o pago de deuda de capital
- **Then** la fuente conserva el snapshot FX y el asiento hereda el mismo fingerprint
- **And** la cuenta en moneda distinta o evidencia incompleta se rechaza antes de mutar

#### Scenario: Fuente FX incompleta

- **Given** un writer en moneda extranjera que no posee tasa, fecha efectiva o destino
  persistente para la evidencia
- **When** se solicita la operación en modo `enforce`
- **Then** se rechaza antes del movimiento de saldo y no se crea asiento
