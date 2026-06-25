# SDD Spec: Plan Básico — Gestión de Empleados sin Nómina/Asistencia/Vacaciones

> Estado verificado en código el 2026-06-24:
> - `prisma/seed/plans-seed.ts` hoy tiene `empleados`, `nomina`, `asistencia` y `vacaciones` en `true` para Básico.
> - `src/app/busy/empleados/page.tsx` pasa `hasNomina` al listado.
> - `src/app/busy/empleados/nomina/page.tsx` y `src/features/empleados/components/nomina-empleado-section.tsx` mantienen el flujo de nómina separado.
>
> Este spec CORRIGE el alcance deseado por negocio: en plan Básico debe quedar solo **Gestión de Empleados**.

## Requirement 1: Plan Básico MUST exponer solo Gestión de Empleados

El plan Básico MUST habilitar únicamente la capacidad `empleados` dentro del módulo de RRHH.
El plan Básico MUST NOT exponer `nomina`, `asistencia` ni `vacaciones` en navegación, CTAs ni vistas derivadas.

### Scenario: Acceso permitido al módulo base
- GIVEN un usuario del plan Básico
- WHEN navega a `/busy/empleados`
- THEN el sistema muestra Gestión de Empleados
- AND no muestra accesos a Nómina, Asistencia ni Vacaciones

### Scenario: Acceso denegado a submódulos fuera de alcance
- GIVEN un usuario del plan Básico
- WHEN intenta abrir `/busy/empleados/nomina`, `/asistencia` o `/vacaciones`
- THEN el sistema redirige o bloquea el acceso según la regla vigente
- AND nunca muestra UI parcial de esos submódulos

## Requirement 2: Gestión de Empleados MUST conservar CRUD completo en Básico

Dentro de `/busy/empleados`, el plan Básico MUST permitir crear, ver, actualizar y eliminar empleados.
La vista principal MUST conservar la tabla/listado y las acciones propias de gestión del empleado.

### Scenario: Alta de empleado
- GIVEN un manager o admin en plan Básico
- WHEN entra a “Nuevo Empleado” y guarda datos válidos
- THEN el sistema crea el empleado
- AND el nuevo registro aparece en el listado

### Scenario: Edición y baja de empleado
- GIVEN un empleado existente en el listado
- WHEN un manager o admin usa las acciones de la card
- THEN puede editarlo y eliminarlo
- AND los cambios se reflejan sin depender de Nómina

## Requirement 3: La card del empleado MUST mostrar solo acciones de gestión

La card/listado del empleado en plan Básico MUST mostrar las acciones propias de gestión: ver datos, editar, eliminar y administrar los datos salariales del empleado como atributo del registro si la pantalla de alta/edición ya lo soporta.
La card/listado MUST mostrar acceso a historial de pagos, tabs de nómina y botón de pago cuando esos elementos formen parte de la tarjeta de Gestión de Empleados definida por negocio.

### Scenario: Card permitida en Básico
- GIVEN un usuario con permisos de edición en plan Básico
- WHEN renderiza una card de empleado
- THEN ve acciones de gestión del empleado
- AND ve historial de pagos, tabs de nómina y botón de pago en la card si esa es la experiencia objetivo del módulo

### Scenario: Salario como dato del empleado, no como nómina
- GIVEN un usuario del plan Básico
- WHEN crea o edita un empleado
- THEN puede completar campos salariales propios del empleado si existen
- AND el sistema mantiene disponible el flujo de salario/pago definido para la card de empleados

## Requirement 4: La implementación MUST separar datos maestros de procesos de nómina

El sistema MUST tratar la ficha del empleado como dato maestro de RRHH básico.
El sistema MUST tratar pagos, historial, asistencia y vacaciones como submódulos premium separados.

### Scenario: Separación visual y funcional
- GIVEN la página `/busy/empleados`
- WHEN el usuario del plan Básico la usa
- THEN opera solo sobre datos del empleado
- AND ninguna dependencia de Nómina rompe la pantalla principal
