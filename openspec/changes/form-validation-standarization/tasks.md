# Tasks: Form Validation Standarization

## Phase 1: Migración Sonner → Sileo (8 forms)

- [x] 1.1 `src/components/servicios/servicios-form.tsx` — reemplazar `import { toast } from 'sonner'` → `sileo` y todas las llamadas `toast(...)` → `sileo.success/error`
- [x] 1.2 `src/components/servicios/servicios-prestados-form.tsx` — ídem migración sonner → sileo
- [x] 1.3 `src/components/servicios/servicios-recibidos-form.tsx` — ídem migración sonner → sileo
- [x] 1.4 `src/components/compras/compra-producto-form.tsx` — ídem migración sonner → sileo
- [x] 1.5 `src/components/transferencias/transferencias-form.tsx` — ídem migración sonner → sileo
- [x] 1.6 `src/components/contabilidad/cuenta-bancaria-form.tsx` — ídem migración sonner → sileo
- [x] 1.7 `src/components/contabilidad/ajuste-bancario-form.tsx` — ídem migración sonner → sileo
- [x] 1.8 `src/components/contabilidad/enhanced-form-wrapper.tsx` — ídem migración sonner → sileo (wrapper genérico, afecta todos los forms que lo usen)

## Phase 2: onInvalid + Mensajes — Dominio Básico

- [x] 2.1 `src/components/PtoVenta/pvtoVenta-form.tsx` — agregar `onInvalid` en `handleSubmit`; estandarizar `required_error` ("Ingrese..." → "El campo X no ha sido rellenado")
- [x] 2.2 `src/components/vendor/vendor-form.tsx` — ídem `onInvalid` + mensajes
- [x] 2.3 `src/components/clientes/clientes-form.tsx` — ídem `onInvalid` + mensajes
- [x] 2.4 `src/components/almacen/almacen-form.tsx` — ídem `onInvalid` + auditar mensajes
- [x] 2.5 `src/components/unidad/unidad-form.tsx` — ídem `onInvalid` + auditar mensajes
- [x] 2.6 `src/components/categorias/category-form.tsx` — ídem `onInvalid` + auditar mensajes
- [x] 2.7 `src/components/ofertas/oferta-form.tsx` — ídem `onInvalid` + auditar mensajes
- [x] 2.8 `src/components/gastoDE/GastoDEForm.tsx` — ídem `onInvalid` + auditar mensajes

## Phase 3: onInvalid + Mensajes — Dominio Empleados

- [x] 3.1 `src/components/empleados/empleados-form.tsx` — `onInvalid` + estandarizar mensajes ("escriba un..." → "El campo X no ha sido rellenado")
- [x] 3.2 `src/components/empleados/enhanced-empleados-form.tsx` — ídem Fase 3.1 (mismo schema duplicado)
- [x] 3.3 `src/components/empleados/vacaciones-form.tsx` — `onInvalid` + auditar schema y mensajes
- [x] 3.4 `src/components/empleados/asistencia-form.tsx` — `onInvalid` + auditar schema y mensajes

## Phase 4: onInvalid + Mensajes — Dominio Ventas/Compras/Servicios

- [x] 4.1 `src/components/ventas/venta-form.tsx` — `onInvalid` + auditar mensajes + `z.preprocess` en campos monto si aplica
- [x] 4.2 `src/components/mermas/merma-form.tsx` — `onInvalid` + auditar mensajes
- [x] 4.3 `src/components/productos/restock-form.tsx` — `onInvalid` + auditar mensajes + `.int()` en campo cantidad
- [x] 4.4 `src/components/servicios/servicios-form.tsx` — agregar `onInvalid` (ya migrado a sileo en Phase 1) + estandarizar mensajes
- [x] 4.5 `src/components/servicios/servicios-prestados-form.tsx` — `onInvalid` + mensajes
- [x] 4.6 `src/components/servicios/servicios-recibidos-form.tsx` — `onInvalid` + mensajes
- [x] 4.7 `src/components/compras/compra-producto-form.tsx` — `onInvalid` + mensajes
- [x] 4.8 `src/components/transferencias/transferencias-form.tsx` — `onInvalid` + mensajes

## Phase 5: onInvalid + Mensajes — Dominio Contabilidad

- [x] 5.1 `src/components/contabilidad/moneda-form.tsx` — `onInvalid` + estandarizar mensajes (.min(1) messages)
- [x] 5.2 `src/components/contabilidad/tasa-cambio-form.tsx` — `onInvalid` + mensajes
- [x] 5.3 `src/components/contabilidad/ajuste-bancario-form.tsx` — `onInvalid` (ya migrado sileo) + mensajes
- [x] 5.4 `src/components/contabilidad/cuenta-bancaria-form.tsx` — `onInvalid` (ya migrado sileo) + mensajes
- [x] 5.5 `src/components/contabilidad/transferencia-bancaria-form.tsx` — `onInvalid` + auditar mensajes
- [x] 5.6 `src/components/contabilidad/capital/capital-form.tsx` — `onInvalid` + auditar mensajes
- [x] 5.7 `src/components/contabilidad/tipo-pago-form.tsx` — `onInvalid` + auditar mensajes
- [x] 5.8 `src/components/contabilidad/reconciliacion-ventas-form.tsx` — `onInvalid` + auditar mensajes
- [x] 5.9 `src/components/contabilidad/reconciliacion-servicios-form.tsx` — `onInvalid` + auditar mensajes
- [x] 5.10 `src/components/contabilidad/reconciliacion-gastos-form.tsx` — `onInvalid` + auditar mensajes
- [x] 5.11 `src/components/contabilidad/cierres/CierreForm.tsx` — `onInvalid` + auditar mensajes
- [x] 5.12 `src/components/contabilidad/anticipos/anticipo-form.tsx` — auditar mensajes (sileo + onInvalid ya presentes)

## Phase 6: Verificación

- [x] 6.1 Ejecutar `grep -r "from 'sonner'" src/components` — confirmar 0 resultados
- [x] 6.2 Ejecutar `grep -r "handleSubmit(onSubmit)" src/components` — confirmar 0 resultados (todos tienen el 2do argumento)
- [x] 6.3 Smoke test manual: `pvtoVenta-form`, `empleados-form`, `servicios-form`, `cuenta-bancaria-form` — submit vacío muestra toast sileo
- [x] 6.4 Smoke test manual: `moneda-form`, `venta-form` — submit exitoso muestra sileo.success
