# Integridad de ventas, crédito, comisiones y emisión fiscal — especificación nueva

## Purpose

Definir las garantías observables al materializar ventas, registrar devoluciones y emitir comprobantes. No existe una especificación principal de estos dominios en `openspec/specs/`; los siguientes requisitos son nuevos y no sustituyen por inferencia otras políticas vigentes.

## Functional Requirements

### Requirement: Crédito al facturar pedidos

El sistema MUST NOT reservar ni consumir cupo de crédito por crear un pedido. Al facturarlo, MUST evaluar el saldo neto exigible vigente y el límite del cliente en ese momento, con la misma definición de cupo comercial usada por todos los orígenes de CxC. MUST rechazar la facturación que exceda el límite sin crear una venta facturada ni efectos parciales.

#### Scenario: Pedido creado y facturado con cupo
- GIVEN un cliente con cupo suficiente y un pedido pendiente
- WHEN se crea el pedido y posteriormente se factura
- THEN la creación no reduce el cupo y la facturación aplica el consumo una sola vez.

#### Scenario: Cupo agotado después de crear el pedido
- GIVEN un pedido pendiente y un cliente cuyo cupo disponible se agotó antes de facturarlo
- WHEN se intenta facturar el pedido
- THEN se rechaza por crédito insuficiente y el pedido permanece sin facturar, sin efectos parciales.

### Requirement: Cupo comercial común para todos los cambios de exposición

El cupo comercial MUST incluir todas las CxC vivas del cliente del tenant, sin excluir ventas de productos, servicios, préstamos cash ni operaciones manuales que alteren el saldo; pagos, anulaciones y devoluciones MUST afectar el saldo neto una sola vez. Toda operación que altere saldo o límite, incluso las que lo reducen, MUST participar de una garantía común de serialización por cliente y tenant y decidir sobre el saldo vigente. El crédito exigido MUST corresponder al incremento neto de exposición, no al importe bruto cuando existe un cobro inmediato. Dos operaciones simultáneas MUST NOT comprometer conjuntamente más cupo que el disponible. Ante conflicto, el sistema MAY reintentar la operación completa de forma acotada con saldo actualizado y MUST rechazar explícitamente sin efectos parciales si no puede determinar un resultado seguro. Un límite sin tope MUST NOT eximir a sus escritores del protocolo común.

#### Scenario: Dos ventas directas compiten por el mismo cupo
- GIVEN cupo suficiente para solo una de dos ventas directas simultáneas del mismo cliente
- WHEN ambas solicitudes se procesan en paralelo contra la base de datos real
- THEN como máximo una se confirma y el saldo comprometido no excede el límite.

#### Scenario: Venta directa y pedido compiten por cupo
- GIVEN un pedido pendiente y una venta directa del mismo cliente cuya suma excede el cupo
- WHEN la facturación del pedido y la venta directa ocurren simultáneamente
- THEN como máximo una se confirma sin que la otra genere efectos parciales.

#### Scenario: Servicio y producto compiten por cupo
- GIVEN un mismo cliente y tenant con cupo suficiente para solo una obligación de servicio o producto
- WHEN ambas operaciones crean CxC simultáneamente
- THEN como máximo una se confirma y el saldo neto confirmado no supera el límite.

#### Scenario: Préstamo cash y facturación de pedido compiten
- GIVEN un préstamo cash y un pedido del mismo cliente cuya exposición conjunta excedería el cupo
- WHEN el desembolso y la facturación compiten
- THEN como máximo una obligación se confirma y la otra no deja efectos parciales.

#### Scenario: Cargo manual frente a servicio y pago concurrente
- GIVEN un cliente con un cargo manual, una venta de servicio y un pago que alteran su saldo
- WHEN los tres cambios concurren para el mismo tenant y cliente
- THEN todos se ordenan bajo la misma garantía y cada aprobación usa el saldo neto vigente, sin perder el pago ni exceder el límite por lecturas obsoletas.

#### Scenario: Devolución o cancelación y cambio de límite concurrentes
- GIVEN un cliente con CxC vigente y una devolución o cancelación que reduce su saldo
- WHEN compite con una nueva obligación o un cambio de límite del mismo cliente
- THEN la decisión de cupo refleja un orden consistente de todos los cambios y ninguna operación confirmada queda parcialmente registrada.

#### Scenario: Escritor aún no protegido durante despliegue
- GIVEN un punto de entrada de CxC que todavía no participa de la garantía común
- WHEN se intenta escribir desde ese punto durante el despliegue gradual
- THEN el servidor rechaza explícitamente la operación antes de alterar saldo, aunque la interfaz permita solicitarla.

#### Scenario: Reintentos agotados
- GIVEN un conflicto de concurrencia que no puede resolverse dentro del límite de reintentos
- WHEN se solicita cualquiera de los dos puntos de entrada
- THEN se devuelve un error explícito y no se confirma ninguna parte de esa operación.

### Requirement: Excepción de crédito autorizada y auditable

En toda operación que incremente la exposición de CxC, el sistema MUST permitir exceder el cupo únicamente con solicitud explícita de override, permiso `ventas.venta.credito-override` para ventas de productos/pedidos o permiso equivalente específico autorizado para servicios, préstamos cash u operaciones manuales, y motivo no vacío. MUST persistir evidencia auditable vinculada a actor, tenant, cliente, origen/operación, saldo anterior, límite, incremento, exceso y motivo. MUST NOT interpretar una solicitud, un motivo o un permiso aislados como autorización; la auditoría y la obligación MUST confirmarse o revertirse juntas. MUST NOT registrar un override exitoso si no existe exceso.

#### Scenario: Override válido
- GIVEN un cliente sin cupo suficiente y un usuario autorizado para el origen con motivo válido
- WHEN factura un pedido, vende productos o servicios, desembolsa un préstamo cash o aplica un cargo manual solicitando override
- THEN la operación se confirma y queda evidencia auditable de la excepción.

#### Scenario: Override incompleto o no autorizado
- GIVEN crédito insuficiente y una solicitud sin intención explícita, sin permiso adecuado al origen o con motivo vacío
- WHEN se intenta crear una obligación de cualquier origen
- THEN se rechaza sin crear la obligación ni registrar un override exitoso.

#### Scenario: Falla la persistencia de auditoría
- GIVEN crédito insuficiente y una excepción autorizada correctamente
- WHEN falla la persistencia de la evidencia auditable
- THEN ni la obligación ni la autorización de exceso se confirman.

### Requirement: Vuelto declarado coherente

Cuando `cambioDevuelto` está presente, el servidor MUST comprobar que coincide con el efectivo recibido menos el efectivo exigible de la operación, con la precisión y redondeo monetarios aplicables al flujo vigente, incluso para pagos mixtos. MUST rechazar valores inconsistentes sin efectos de venta. Si el campo se omite, MUST conservar la compatibilidad previa y calcular el vuelto conforme al flujo existente.

#### Scenario: Efectivo exacto o excedente
- GIVEN una venta con efectivo recibido y efectivo exigible conocidos
- WHEN se envía `cambioDevuelto` igual a su diferencia monetaria
- THEN el servidor acepta la declaración y conserva el resultado coherente.

#### Scenario: Pago mixto inconsistente
- GIVEN una venta mixta donde el componente en efectivo exigible es menor que el total
- WHEN el cliente declara un vuelto distinto del derivado del efectivo recibido y ese componente
- THEN se rechaza la venta sin persistencia parcial.

#### Scenario: Consumidor antiguo omite vuelto
- GIVEN un payload válido sin `cambioDevuelto`
- WHEN se registra la venta
- THEN no se rechaza por ausencia del campo y se mantiene el cálculo previo.

### Requirement: Devoluciones imputadas al período original

El reporte derivado de comisiones MUST seleccionar ventas por su período original y atribuir a ese mismo período las devoluciones registradas de esas ventas, aunque ocurran en otro mes. MUST respetar devoluciones parciales y MUST NOT descontar dos veces la misma devolución. MUST presentar sus cifras como «Cálculo actualizado», no como liquidación histórica; el cálculo informativo de un período anterior MAY cambiar al registrarse una devolución posterior.

#### Scenario: Devolución posterior con mes original abierto
- GIVEN una venta comisionable de agosto sin liquidación de comisiones
- WHEN se registra una devolución parcial en septiembre
- THEN la comisión de agosto se reduce por la porción devuelta y la de septiembre no recibe esa reversión.

#### Scenario: Devolución repetida
- GIVEN una devolución ya reflejada en el cálculo del período original
- WHEN se recalcula el reporte o se reejecuta la conciliación
- THEN el monto de la comisión no se reduce nuevamente.

### Requirement: Sin liquidación ni ajustes de períodos cerrados en esta entrega

Este cambio MUST NOT crear una liquidación propia de comisiones, persistir ajustes separados de cierres, inferir una liquidación de cierres contables o salarios, ni ejecutar backfill que altere resultados liquidados. Si un período está documentado como liquidado, el sistema MUST bloquear cualquier ajuste de esa liquidación en esta entrega hasta que un cambio posterior defina registro verificable, política aprobada y mecanismo de ajuste. El reporte derivado MUST poder mostrar el cálculo actualizado por período original sin afirmar que haya modificado una liquidación cerrada.

#### Scenario: Solicitud de ajuste de una liquidación cerrada
- GIVEN evidencia de liquidación de comisión cerrada de agosto y una devolución posterior
- WHEN se solicita ajustar la liquidación desde este cambio
- THEN la solicitud se bloquea sin reabrirla, reescribirla ni crear un ajuste separado.

#### Scenario: Cierre contable sin liquidación comprobada
- GIVEN un cierre contable o pago salarial sin registro verificable de liquidación de comisiones
- WHEN se registra una devolución de una venta de otro mes y se consulta su reporte
- THEN el reporte atribuye el efecto al mes original como «Cálculo actualizado» sin crear liquidación ni ajuste persistido.

#### Scenario: Backfill de supuestas liquidaciones
- GIVEN una solicitud de importar o conciliar resultados históricos de períodos supuestamente liquidados
- WHEN se intenta aplicar un backfill en esta entrega
- THEN no se modifica ninguna liquidación ni se crean ajustes sobre cierres supuestos.

### Requirement: Emisión fiscal dirigida exclusivamente al comprobante solicitado

La acción individual de emisión MUST reclamar únicamente la factura solicitada y su documento fiscal del tenant autorizado. MUST NOT emitir otra factura pendiente por antigüedad ni afectar datos de otro tenant. Un reclamo concurrente perdedor MUST NOT invocar al proveedor; la emisión duplicada de una factura ya confirmada MUST NOT generar un nuevo comprobante externo.

#### Scenario: Dos facturas pendientes
- GIVEN facturas A y B pendientes del mismo tenant
- WHEN se solicita emitir B
- THEN únicamente B se envía y A permanece sin procesar.

#### Scenario: Factura ajena o inexistente
- GIVEN una solicitud para una factura de otro tenant o un identificador inexistente
- WHEN se solicita emisión
- THEN se rechaza sin emitir ni alterar ninguna factura.

#### Scenario: Dos operadores reclaman la misma factura
- GIVEN una factura pendiente del mismo tenant seleccionada por dos operadores
- WHEN ambos solicitan emitirla simultáneamente
- THEN solo un intento puede reclamarla y como máximo una solicitud se envía al proveedor.

### Requirement: Resultado fiscal incierto y recuperación manual

Cada intento fiscal MUST disponer de `attemptId` durable, asociado a tenant, factura y documento, registrado antes de cualquier envío junto con la evidencia disponible; la confirmación MUST corresponder al mismo intento vigente y persistir resultado e historial de forma consistente. Una solicitud enviada con resultado no verificable, o reclamada sin evidencia de envío tras una caída, MUST permanecer `PROCESANDO` o incierta y MUST NOT reenviarse automáticamente, aun si su antigüedad supera un umbral. Timeout, desconexión, error de parseo, excepción genérica o falla al persistir el resultado tras el envío MUST tratarse como inciertos; sólo una respuesta definitiva, autenticada y correlacionada al intento permite declarar un rechazo. Los registros históricos `PROCESANDO` y `RECHAZADA` sin prueba de rechazo definitivo MUST excluirse de todo reintento automático. Confirmar emisión o habilitar un nuevo intento MUST exigir evidencia externa verificable, identidad coincidente y decisión autorizada y auditable; habilitar reintento de un caso incierto MUST requerir prueba de no emisión. Sin esa prueba MUST conservarse la incertidumbre. Una evidencia sintética local MUST NOT considerarse confirmación del proveedor real.

#### Scenario: Timeout después de enviar
- GIVEN una emisión solicitada para la factura A cuyo proveedor no devuelve resultado verificable
- WHEN vence la espera o se reintenta la acción sobre A
- THEN A queda identificada como incierta con su evidencia disponible y no se reenvía automáticamente.

#### Scenario: Caída tras reclamar antes del envío
- GIVEN A reclamada con `attemptId` persistido sin evidencia confiable de envío
- WHEN el proceso cae y posteriormente se revisa el intento antiguo
- THEN A permanece bloqueada para reenvío automático hasta comprobar externamente si se emitió.

#### Scenario: Falla al persistir confirmación después del envío
- GIVEN A enviada al proveedor y una respuesta de emisión recibida para su `attemptId`
- WHEN falla la persistencia local de la confirmación o su evento
- THEN A no se declara confirmada parcialmente ni se reenvía automáticamente; permanece recuperable como caso incierto con identidad del intento y evidencia disponible.

#### Scenario: Excepción post-envío o rechazo ambiguo
- GIVEN A enviada y una desconexión, error de parseo o respuesta de rechazo no autenticada o no correlacionada
- WHEN se clasifica el resultado
- THEN A permanece incierta y no se habilita un nuevo intento automáticamente.

#### Scenario: Rechazo definitivo verificable
- GIVEN A enviada y un rechazo autenticado y correlacionado a su `attemptId`
- WHEN se registra el resultado de manera consistente
- THEN A queda rechazada con su evidencia, sin confundirse con un resultado incierto.

#### Scenario: Estados históricos no autorizan reenvío
- GIVEN una factura antigua `PROCESANDO` o `RECHAZADA` sin prueba definitiva vinculada a su intento
- WHEN un worker, cron u operador solicita procesarla de nuevo sin evidencia externa
- THEN no se envía al proveedor y el historial permanece disponible para conciliación.

#### Scenario: Confirmación por intervención autorizada
- GIVEN A incierta y evidencia verificable de emisión externa correspondiente a A y su tenant
- WHEN una persona autorizada reconcilia manualmente el caso
- THEN A se marca conforme a la evidencia y se registra actor, momento, fundamento y referencia externa sin nuevo envío.

#### Scenario: No emisión externa demostrada
- GIVEN A incierta con prueba externa verificable de no emisión, identidad del intento coincidente y operador autorizado
- WHEN el operador documenta el motivo y habilita un nuevo intento dirigido a A
- THEN queda auditable la decisión y un intento posterior puede iniciarse sin reutilizar el `attemptId` previo.

#### Scenario: Evidencia insuficiente o conflicto de identidad
- GIVEN A incierta sin prueba verificable o con referencia externa atribuible a otra factura
- WHEN se solicita confirmar o reintentar manualmente
- THEN no se confirma ni reenvía hasta resolver la identidad y se conserva el historial de intervención.

#### Scenario: Confirmación tardía de intento ya sustituido
- GIVEN un intento anterior de A y otro intento vigente documentado
- WHEN llega una confirmación asociada solo al intento anterior
- THEN la confirmación no finaliza el intento vigente ni altera una factura distinta y se conserva para revisión.

## Non-functional Requirements

### Requirement: Aislamiento, atomicidad y trazabilidad

Todas las comprobaciones y efectos de crédito, devoluciones y emisión MUST respetar límites de tenant; los rechazos MUST NOT producir efectos de negocio parciales. Ningún escritor de saldo o límite MUST quedar habilitado durante el despliegue si puede evitar el protocolo común o su bloqueo fail-closed. Las excepciones y decisiones fiscales manuales MUST conservar trazabilidad reproducible sin borrar evidencia anterior; los reportes de comisión MUST distinguir cálculo actual de resultados liquidados no representados.

#### Scenario: Cruce de tenant bajo concurrencia
- GIVEN clientes o facturas con identificadores válidos en tenants distintos
- WHEN se ejecutan operaciones simultáneas o una solicitud apunta a un recurso ajeno
- THEN cada operación utiliza únicamente datos de su tenant y una solicitud ajena no cambia estado alguno.

### Requirement: Verificación y despliegue seguro

La entrega MUST incluir pruebas automatizadas de carreras mixtas sobre base real entre productos, pedidos, servicios, préstamos cash, cargos manuales, pagos y devoluciones/cancelaciones; override y rollback de auditoría; devolución entre períodos; emisión dirigida, `attemptId`, clasificación post-envío e históricos; y vuelto presente, ausente o nulo. La activación de cupo compartido MUST estar condicionada al inventario de todos los escritores de saldo/límite, a su adhesión al protocolo o bloqueo fail-closed verificable, y a pruebas de aislamiento por tenant. La activación de conciliación fiscal MUST estar condicionada a evidencia externa aceptable, autorización del operador y compatibilidad con trabajadores anteriores. Este cambio MUST NOT ejecutar backfill ni ajustes de comisiones liquidadas.

#### Scenario: Reconsulta de reporte histórico
- GIVEN una venta de un tenant con una devolución parcial ya registrada
- WHEN se consulta repetidamente el reporte del período de venta original
- THEN cada consulta refleja la devolución una sola vez sin escribir ajustes ni alterar otro tenant.

#### Scenario: Gate de despliegue con escritor legacy
- GIVEN un escritor de CxC no inventariado o no protegido
- WHEN se evalúa activar el cupo compartido o se invoca ese escritor durante el rollout
- THEN no se activa el cupo y el escritor no confirma cambios hasta quedar protegido.

#### Scenario: Gate fiscal con worker antiguo
- GIVEN un worker anterior que podría reenviar un intento fiscal incierto
- WHEN se evalúa activar la emisión o reconciliación nueva
- THEN no se habilita hasta impedir ese reenvío y preservar los intentos existentes.
