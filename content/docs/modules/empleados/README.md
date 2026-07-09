# Empleados

> Gestiona empleados, asistencia, vacaciones, horarios y nómina según las capacidades habilitadas por el plan.

## Qué hace

Este módulo combina datos laborales básicos con flujos operativos de RR.HH. La pantalla principal reúne empleados y pagos, mientras que asistencia, vacaciones y nómina pueden abrirse como módulos separados cuando el plan lo permite.

## Áreas principales

- **Empleados**: alta, edición, baja y consulta de historial básico.
- **Asistencia**: check-in, check-out y correcciones manuales.
- **Vacaciones**: solicitudes, saldo disponible y acumulación por antigüedad.
- **Nómina**: pagos, cálculos y vista consolidada de remuneraciones.
- **Horarios**: franjas laborales y horas esperadas por día.

## Cuándo usarlo

- Cuando administrás empleados, nómina o datos personales.
- Cuando querés revisar turnos, vacaciones o pagos.
- Cuando necesitás mantener el historial laboral en orden.
- Cuando un encargado necesita registrar entradas y salidas del equipo.
- Cuando querés separar módulos premium de RR.HH. según el plan contratado.

## Reglas importantes

- La gestión de empleados requiere feature `empleados`.
- Crear, editar o eliminar empleados exige rol manager o superior.
- Asistencia, vacaciones y nómina pueden redirigir al listado principal si el plan no habilita módulos separados.
- El check-out calcula horas trabajadas y puede enriquecer datos con el horario asignado.

## Qué conviene cuidar

- Controlá fechas, jornadas y montos con cuidado.
- Si hay vacaciones o ausencias, registralas a tiempo.
- Mantené los datos del empleado completos.
- En asistencia, no se puede registrar salida si antes no hubo entrada.
- Vacaciones y nómina no son solo vistas: están atadas a permisos y features específicos.
- La pantalla principal puede funcionar como versión compacta para planes básicos.

## Rutas clave

- `/busy/empleados`
- `/busy/empleados/asistencia`
- `/busy/empleados/vacaciones`
- `/busy/empleados/nomina`
- `/busy/empleados/sistema-asistencia`

## Referencias útiles

- `src/features/empleados/actions.ts`
- `src/app/busy/empleados/page.tsx`
- `src/app/busy/empleados/asistencia/page.tsx`
- `src/app/busy/empleados/vacaciones/page.tsx`
- `src/app/busy/empleados/nomina/page.tsx`

## En una frase

Ordena la gestión del personal desde el alta hasta la asistencia, vacaciones y pagos.
