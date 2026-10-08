# PRE-GO — Especificación del núcleo TypeScript

## Propósito

Preparar una frontera verificable en `src/dominio` y extraer un primer caso de uso de lectura de productos sin cambiar contratos web/móvil. Esta especificación cubre exclusivamente PRE-GO/0 y PRE-GO/1; no autoriza implementar Go, mover lógica en /0 ni elegir un piloto de escritura.

## Requisitos funcionales

### Requirement: Inventario versionado antes de la extracción (PRE-GO/0)

PRE-GO/0 MUST entregar un mapa versionado de operaciones y consumidores que incluya, por operación, action o route, consumidor web/móvil, firma y entradas, respuesta y errores, autenticación, tenant, permisos, tablas y efectos, pruebas existentes, caso de uso candidato y estado de migración/reversa. MUST registrar explícitamente diferencias entre el resultado de una Server Action y el status/body de una API HTTP. MUST NOT mover lógica ni modificar comportamiento de ejecución.

#### Scenario: Operación compartida inventariada

- GIVEN las lecturas de productos web y móvil existentes
- WHEN se revisa el inventario de PRE-GO/0
- THEN ambas entradas y sus consumidores aparecen vinculados a la operación de lectura
- AND sus contratos, filtros, stock derivado, controles de acceso, efectos y pruebas figuran por separado.

#### Scenario: Operación sin evidencia completa

- GIVEN una operación con efectos o consumidores todavía desconocidos
- WHEN se registra en el inventario
- THEN MUST quedar marcada como pendiente con el dato faltante
- AND MUST NOT aprobarse su extracción basándose en supuestos.

### Requirement: ADR de frontera y propiedad (PRE-GO/0)

PRE-GO/0 MUST registrar un ADR que establezca `src/dominio` como ubicación exclusiva del núcleo TS: reglas deterministas en `domain`, orquestación en `application` y puertos mínimos por capacidad; adaptadores Next y Prisma fuera del núcleo. MUST actualizar o reconciliar la mención anterior a `packages/domain` en el plan PRE-GO para que no quede una ubicación alternativa vigente. El ADR MUST separar PRE-GO/0 de PRE-GO/1 y describir propiedad de autenticación, serialización, errores de transporte y persistencia.

#### Scenario: Revisión de decisión de ubicación

- GIVEN el plan anterior menciona `packages/domain` como posibilidad
- WHEN se revisa el ADR y el plan antes de aprobar PRE-GO/1
- THEN la única frontera aprobada es `src/dominio`
- AND Next y Prisma permanecen explícitamente fuera de ella.

### Requirement: Lectura compartida de productos (PRE-GO/1)

Después de completar /0, `getProductosAction()` y `GET /api/mobile/v1/products` MUST delegar la orquestación de lectura a un mismo caso de uso en `src/dominio`, con puertos mínimos y adaptador Prisma externo. MUST preservar las firmas, entradas, filtros admitidos, orden, stock derivado, forma de respuesta, errores y semántica de vacío de cada superficie según su baseline verificado; no basta con extraer una función pura. Los adaptadores MUST conservar autenticación y traducción/serialización propias de cada transporte.

#### Scenario: Consulta web autorizada

- GIVEN un usuario web autenticado con tenant y productos que coinciden con los filtros admitidos
- WHEN invoca `getProductosAction()` con esos filtros
- THEN recibe el mismo envelope, campos, orden y stock derivado que en el baseline web
- AND la firma de la action permanece compatible con sus consumidores.

#### Scenario: Consulta móvil autorizada

- GIVEN una sesión móvil válida con tenant y productos que coinciden con los filtros admitidos
- WHEN solicita `GET /api/mobile/v1/products` con esos filtros
- THEN recibe el mismo status HTTP, body, campos, orden y stock derivado que en el baseline móvil.

#### Scenario: Filtros y resultado vacío

- GIVEN un filtro admitido que no coincide con productos del tenant
- WHEN se consulta cada superficie
- THEN cada una entrega su representación preexistente de resultado vacío
- AND no aparecen productos de otros tenants ni cambia la semántica de filtros.

#### Scenario: Error de lectura

- GIVEN que la lectura de persistencia falla de forma controlada
- WHEN cada adaptador invoca el caso de uso
- THEN la action mantiene su envelope y código de error observable del baseline
- AND la ruta móvil mantiene su status HTTP y body de error observables del baseline
- AND no se exponen detalles internos de persistencia.

### Requirement: Aislamiento y autorización por tenant

El contexto de actor MUST provenir de autenticación y membresía verificadas, nunca de parámetros del cliente. El caso de uso MUST rechazar actor sin tenant válido o sin autorización pertinente; el puerto de lectura MUST limitar los datos al tenant verificado. MUST NOT aceptar un tenant distinto por filtros, parámetros o cabeceras no confiables.

#### Scenario: Tenant ausente

- GIVEN una identidad sin tenant válido
- WHEN solicita productos mediante la action o la ruta móvil
- THEN la solicitud falla con la representación y status/código correspondientes al contrato previo de cada superficie
- AND no se consulta ni entrega información de productos de otro tenant.

#### Scenario: Tenant ajeno

- GIVEN dos tenants A y B con productos exclusivos y un actor autenticado de A
- WHEN el actor intenta consultar productos de B mediante filtros o identificadores manipulados
- THEN la respuesta no contiene productos de B
- AND el intento no altera la autoridad del actor ni el scope de persistencia.

#### Scenario: Contexto o permisos inválidos

- GIVEN un actor sin permiso requerido o con contexto no verificable
- WHEN accede a cualquiera de las dos superficies
- THEN se rechaza sin entregar productos
- AND cada adaptador conserva su contrato de error de autorización.

## Requisitos no funcionales y puertas de verificación

### Requirement: Límite de dependencias comprobable

PRE-GO/0 MUST establecer un chequeo automatizado que funcione aunque `src/dominio` todavía no exista: MUST validar la configuración/reglas y tratar la ausencia del núcleo como estado transitorio explícito, sin fallar ni declarar verificada una frontera vacía. En PRE-GO/1 el gate MUST fallar ante dependencias directas **o transitivas** desde el núcleo hacia Next, Prisma, `src/app`, adaptadores, globals de request o módulos con efectos de entrada; MUST demostrar que el núcleo se puede importar sin runtime Next ni conexión DB.

#### Scenario: Núcleo ausente en /0

- GIVEN que `src/dominio` aún no existe
- WHEN se ejecuta el chequeo transitorio
- THEN informa que la frontera está pendiente de creación
- AND valida las reglas configuradas sin marcar el aislamiento como comprobado.

#### Scenario: Importación transitiva prohibida en /1

- GIVEN que un módulo del núcleo importa indirectamente un adaptador que depende de Prisma
- WHEN corre el gate de dependencias
- THEN falla con la cadena de imports responsable.

#### Scenario: Importación aislada válida

- GIVEN el núcleo de productos y puertos falsos sin Next ni DB
- WHEN se importa y ejecuta el caso de uso en prueba aislada
- THEN no necesita runtime Next, cliente Prisma ni credenciales de base de datos.

### Requirement: Baseline y TDD estricto por slice

PRE-GO/0 MUST registrar baseline reproducible del slice de productos con comandos, resultados, fixtures, contratos separados web/móvil, filtros, stock, errores y aislamiento tenant, distinguiendo fallos preexistentes. PRE-GO/1 MUST conservar evidencia de un test **nuevo** RED reproducible por ausencia de caso de uso, puerto o contrato antes de escribir GREEN; MUST registrar comando, caso fallido, causa esperada y resultado GREEN, seguido de refactor y regresión. Un test de caracterización ya verde MUST NOT contarse como RED.

#### Scenario: RED válido

- GIVEN baseline de caracterización registrado y nuevo test para la frontera aún inexistente
- WHEN se ejecuta ese test antes de crear el caso de uso o puerto
- THEN falla por la capacidad pendiente documentada
- AND al implementarla pasa sin debilitar sus aserciones.

#### Scenario: Falla preexistente o RED incorrecto

- GIVEN que falla un test de caracterización o que el nuevo test falla por infraestructura
- WHEN se revisa la evidencia de TDD
- THEN la falla se clasifica separadamente y no habilita GREEN como RED del slice.

### Requirement: Gates de paridad, aislamiento y reversa

PRE-GO/1 MUST verificar pruebas unitarias con puertos falsos, integración Prisma con DB aislada, contratos de ambas superficies, casos tenant negativos, E2E crítico, gate de imports y build; las pruebas unitarias MUST mockear Prisma y las de DB real MUST ejecutarse exclusivamente como integración con `DATABASE_URL_TEST` aislada. MUST comparar resultados contra baseline por superficie antes de declarar paridad. MUST demostrar reversa del wiring a `ProductoService.list` sin migraciones ni cambios de datos, y repetir contratos y tenant negativos tras la reversa. PRE-GO/0 MUST mantener la ejecución inalterada; una falla del gate por falso positivo MAY revertir ese gate sin desechar la evidencia del inventario.

#### Scenario: Paridad y salida del piloto

- GIVEN fixtures equivalentes para web y móvil y gates disponibles
- WHEN se ejecutan las verificaciones de /1
- THEN coinciden firmas, respuestas, errores, filtros, stock y aislamiento con los baselines de cada superficie
- AND solo con gates verdes y reversa ensayada se considera completo el slice.

#### Scenario: Reversión del slice

- GIVEN que /1 está conectado al caso de uso nuevo y se detecta una regresión
- WHEN se revierte el wiring de ambas superficies al servicio anterior
- THEN los contratos y tests tenant negativos vuelven a pasar
- AND no se requiere migración de esquema, pérdida de datos ni corte de tráfico Go.

#### Scenario: Trabajo concurrente

- GIVEN cambios ajenos no relacionados en el árbol de trabajo
- WHEN se prepara o revisa una entrega PRE-GO
- THEN solo se modifican artifacts y archivos autorizados para la fase
- AND los cambios concurrentes permanecen intactos.

## Fuera de alcance

PRE-GO/0 MUST NOT crear el núcleo funcional ni mover lógica. PRE-GO/1 MUST NOT migrar escritura, cambiar pantallas, schema, contratos públicos o tráfico a Go. GO-0 y los cortes posteriores requieren sus propias decisiones y golden tests; esta especificación no los habilita por sí sola.
