# Pago de Salario (Nómina)

> Registra pagos de salario por empleado, período, bonificaciones, deducciones y horas extra.

## Qué hace

Este módulo representa el movimiento de pago salarial dentro del dominio de empleados. Cada pago queda ligado a un empleado del tenant y consolida salario, bonificaciones, deducciones y horas extra en un período concreto.

## Qué incluye

- listado de pagos de salario
- alta, edición y borrado
- vínculo con empleado
- generación automática del período actual
- observaciones operativas por pago

## Cuándo usarlo

- Cuando necesitás registrar un pago de nómina real.
- Cuando querés revisar pagos históricos por empleado.
- Cuando debés ajustar bonificaciones, deducciones u horas extra.

## Reglas importantes

- El acceso usa la feature `empleados`, no una feature separada de payroll en estas actions.
- Crear, editar y borrar pagos exige rol manager.
- El período se calcula automáticamente con año y mes actuales.
- Los pagos se revalidan contra el empleado del tenant.

## Qué conviene cuidar

- Controlá fechas, jornadas y montos con cuidado.
- Mantené los datos del empleado completos.
- Este módulo registra el pago, no reemplaza la lógica de asistencia o vacaciones.
- Conviene leerlo junto al módulo de empleados para interpretar bien el contexto laboral.

## Referencias útiles

- `src/features/pago-salario/actions.ts`
- `src/features/empleados/actions.ts`

## En una frase

Convierte la información laboral del empleado en pagos concretos y trazables.
