# Proposal: Badges de Cuotas y Resumen de Interés en Formulario de Deuda

## Intent

El formulario de `PrestamoCash` ya tiene un panel reactivo `CuotasEstimadas` que muestra capital, interés, total y badges de cuota diaria/semanal/mensual. El formulario de `DeudaCash` carece de esto, dando una experiencia inconsistente. El usuario necesita ver al momento lo que pagará para tomar decisiones informadas.

## Scope

### In Scope
- Nuevo componente `CuotasEstimadasDeuda` en `deuda-cash-form.tsx` (mismo patrón que `CuotasEstimadas`)
- Muestra: capital, interés calculado (`+X moneda`), total = capital + interés
- Badges Diaria / Semanal / Mensual cuando hay fecha de vencimiento
- Reactivo con `useWatch` — se actualiza sin submit

### Out of Scope
- Cambios al backend / API
- Tabla de cuotas detallada (eso es otro change)
- Modificar el formulario de préstamo (ya funciona)

## Approach

Extraer el patrón exacto de `CuotasEstimadas` del prestamo-cash-form y adaptarlo para deuda:
- Reemplazar "Capital a prestar → Capital de la deuda", "Total a cobrar → Total a pagar"
- Mismo color coding (amber para interés, primary para total)
- Mismos tres badges con colores azul/verde/violeta

No se necesita nueva dependencia ni cambio de schema.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/contabilidad/deudas-cash/deuda-cash-form.tsx` | Modified | Agregar componente `CuotasEstimadasDeuda` + renderizado dentro del form |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scroll overflow con panel extra | Low | Panel ya está dentro del scroll existente (overflow-y-auto) |
| Confusión de labels (cobrar vs pagar) | Low | Cambiar "Total a cobrar" por "Total a pagar" en la deuda |

## Rollback Plan

Revertir `deuda-cash-form.tsx` a la versión sin `CuotasEstimadasDeuda`. Un solo archivo, cambio aislado.

## Dependencies

- Ninguna externa. Reutiliza `useWatch`, `Badge`, `TrendingUp` ya importados en otros componentes del módulo.

## Success Criteria

- [ ] Al ingresar monto en el form de deuda, aparece el panel de resumen
- [ ] Muestra capital + interés + total correctamente
- [ ] Badges Diaria/Semanal/Mensual aparecen solo si hay fecha de vencimiento
- [ ] Si tasa = 0, no se muestra línea de interés (igual que préstamo)
- [ ] El panel no rompe el scroll del dialog
