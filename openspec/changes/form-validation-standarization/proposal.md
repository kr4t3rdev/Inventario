# Proposal: Estandarización de Validaciones y Notificaciones en Todos los Forms

## Intent

`productos-form.tsx` fue reescrito con validaciones Zod exhaustivas, mensajes de error uniformes, `onInvalid` en `handleSubmit` y notificaciones `sileo`. El resto del proyecto tiene 8 forms con `sonner`, mensajes inconsistentes ("escriba un nombre", "es requerido", "Ingrese..."), y ningún form muestra feedback al intentar submit con errores. El usuario experimenta silencio total al hacer click en Guardar con campos vacíos.

## Scope

### In Scope
- Migrar `sonner` → `sileo` en todos los forms afectados (8 files)
- Agregar `onInvalid` callback en `form.handleSubmit(onSubmit, onInvalid)` en todos los forms
- Estandarizar mensajes `required_error` / `.min(1)` al patrón: `"El campo X no ha sido rellenado"` / `"El campo X no ha sido seleccionado/a"`
- Revisar schemas Zod: campos numéricos con `.positive()`, campos texto con `.max()` donde falte, `.int()` en enteros
- `enhanced-form-wrapper` es un wrapper genérico — se migrará sonner allí también

### Out of Scope
- `login-form.tsx` y `register-form.tsx` (auth forms, fuera del dominio de negocio)
- `ui/form.tsx` (componente base de shadcn, no tiene lógica)
- `enhanced-venta-form.tsx` (duplicado de `venta-form.tsx`, misma lógica)
- Rediseño visual de los forms
- Modificar lógica de negocio existente en `onSubmit`

## Approach

1. Por cada form con `sonner`: reemplazar import y todas las llamadas `toast(...)` → `sileo.success/sileo.error`
2. Por cada form con `zodResolver`: agregar el segundo argumento `() => sileo.error({ title: '...' })` en `handleSubmit`
3. Auditar `required_error` y mensajes `.min(1)` y normalizar al patrón establecido
4. Hacerlo en batches por dominio: empleados, contabilidad, servicios, ventas/compras/mermas, misceláneos

## Affected Areas

| Form | Path | Sonner | onInvalid | Mensajes |
|------|------|--------|-----------|---------|
| `pvtoVenta-form` | `src/components/PtoVenta/` | ❌ | ❌ | Mejorar |
| `vendor-form` | `src/components/vendor/` | ❌ | ❌ | Mejorar |
| `clientes-form` | `src/components/clientes/` | ❌ | ❌ | Mejorar |
| `empleados-form` | `src/components/empleados/` | ❌ | ❌ | Mejorar |
| `enhanced-empleados-form` | `src/components/empleados/` | ❌ | ❌ | Mejorar |
| `vacaciones-form` | `src/components/empleados/` | ❌ | ❌ | Auditar |
| `asistencia-form` | `src/components/empleados/` | ❌ | ❌ | Auditar |
| `servicios-form` | `src/components/servicios/` | ✅ migrar | ❌ | Mejorar |
| `servicios-prestados-form` | `src/components/servicios/` | ✅ migrar | ❌ | Mejorar |
| `servicios-recibidos-form` | `src/components/servicios/` | ✅ migrar | ❌ | Mejorar |
| `compra-producto-form` | `src/components/compras/` | ✅ migrar | ❌ | Mejorar |
| `transferencias-form` | `src/components/transferencias/` | ✅ migrar | ❌ | Mejorar |
| `venta-form` | `src/components/ventas/` | ❌ | ❌ | Auditar |
| `merma-form` | `src/components/mermas/` | ❌ | ❌ | Auditar |
| `restock-form` | `src/components/productos/` | ❌ | ❌ | Auditar |
| `oferta-form` | `src/components/ofertas/` | ❌ | ❌ | Auditar |
| `GastoDEForm` | `src/components/gastoDE/` | ❌ | ❌ | Auditar |
| `almacen-form` | `src/components/almacen/` | ❌ | ❌ | Auditar |
| `unidad-form` | `src/components/unidad/` | ❌ | ❌ | Auditar |
| `category-form` | `src/components/categorias/` | ❌ | ❌ | Auditar |
| `moneda-form` | `src/components/contabilidad/` | ❌ | ❌ | Mejorar |
| `tasa-cambio-form` | `src/components/contabilidad/` | ❌ | ❌ | Mejorar |
| `ajuste-bancario-form` | `src/components/contabilidad/` | ✅ migrar | ❌ | Mejorar |
| `cuenta-bancaria-form` | `src/components/contabilidad/` | ✅ migrar | ❌ | Mejorar |
| `transferencia-bancaria-form` | `src/components/contabilidad/` | ❌ | ❌ | Auditar |
| `capital-form` | `src/components/contabilidad/capital/` | ❌ | ❌ | Auditar |
| `tipo-pago-form` | `src/components/contabilidad/` | ❌ | ❌ | Auditar |
| `reconciliacion-ventas-form` | `src/components/contabilidad/` | ❌ | ❌ | Auditar |
| `reconciliacion-servicios-form` | `src/components/contabilidad/` | ❌ | ❌ | Auditar |
| `reconciliacion-gastos-form` | `src/components/contabilidad/` | ❌ | ❌ | Auditar |
| `CierreForm` | `src/components/contabilidad/cierres/` | ❌ | ❌ | Auditar |
| `anticipo-form` | `src/components/contabilidad/anticipos/` | ❌ | ✅ ya tiene sileo | Auditar |
| `enhanced-form-wrapper` | `src/components/contabilidad/` | ✅ migrar | ❌ | N/A (wrapper) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Form con lógica compleja pierde comportamiento al cambiar toast | Low | Cambio es drop-in: `toast(x)` → `sileo.success/error({ title: x })` |
| `enhanced-form-wrapper` afecta múltiples forms al migrar | Med | Testear visualmente el wrapper antes y después |
| Mensajes editados cambian texto que el usuario ya conoce | Low | Los mensajes son mensajes de error, no labels — impacto UX positivo |

## Rollback Plan

Cada form es independiente. Si alguno falla: revertir solo ese archivo con `git checkout -- src/components/<path>/form.tsx`. No hay cambios en APIs ni DB.

## Dependencies

- `sileo` instalado — ✅ confirmado (`src/lib/sileo-shim.ts`, `layout.tsx`)
- Patrón de referencia: `productos-form.tsx` — ✅ completo y validado

## Success Criteria

- [ ] `grep -r "from 'sonner'" src/components` devuelve 0 resultados
- [ ] `grep -r "handleSubmit(onSubmit)" src/components` devuelve 0 resultados (todos tienen el 2do argumento)
- [ ] Todos los `required_error` siguen el patrón `"El campo X no ha sido rellenado/seleccionado"`
- [ ] Click en Guardar con form vacío → siempre muestra toast de error Sileo
- [ ] Los `<FormMessage />` bajo cada campo siguen mostrando el mensaje específico
