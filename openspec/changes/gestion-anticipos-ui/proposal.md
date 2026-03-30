# Proposal: Gestión de Anticipos - UI y Funcionalidades Avanzadas

## Intent

El sistema de anticipos (pagos y cobros adelantados) ya está implementado en el backend con todas las funcionalidades de negocio: creación, ejecución, reversión, control de concurrencia e idempotencia. Sin embargo, actualmente **no existe una interfaz de usuario dedicada** para gestionar anticipos desde el módulo de Contabilidad, ni reportes específicos por contraparte, ni la posibilidad de ejecutar anticipos de forma parcial. Esta propuesta aborda estas tres necesidades pendientes.

## Scope

### In Scope

1. **Página de Gestión de Anticipos en Contabilidad**
   - Componente de lista/tabla de anticipos con filtros (tipo, estado, cliente, proveedor, moneda, fecha)
   - Formulario para crear nuevos anticipos (pago o cobro)
   - Detalle de anticipo con historial de movimientos
   - Acciones: crear, ejecutar parcialmente, revertir, anular

2. **Reportes de Anticipos**
   - Reporte de anticipos por cliente (cobros)
   - Reporte de anticipos por proveedor (pagos)
   - Resumen de anticipos: totales por estado, moneda, período
   - Exportación a CSV/Excel

3. **Ejecución Parcial de Anticipos**
   - Modificar la lógica actual para permitir usar solo parte del saldo disponible
   - El anticipo puede quedar en estado RESERVADO con saldo restante
   - Validar que el usuario quiera ejecutar parcialmente antes de proceder

### Out of Scope

- Modificaciones al modelo de datos (ya existe y está bien diseñado)
- Integración con nuevos flujos de compra/venta (ya funcionan)
- Tests unitarios del backend (ya existen y pasan)
- Implementación de app móvil

## Approach

### Enfoque Técnico

1. **UI de Gestión**
   - Crear nueva página en `/busy/contabilidad/anticipos`
   - Usar componentes existentes de tablas y formularios de contabilidad
   - Integrar con `contabilidadApi.tsx` endpoints existentes
   - Mostrar balance de movimientos en tiempo real

2. **Ejecución Parcial**
   - Modificar `anticipos-workflow.ts` para permitir `montoObjetivo <= saldoDisponible`
   - Actualizar validación actual que exige ejecución total (línea ~251-256)
   - Agregar parámetro opcional `permitirParcial` en el endpoint ejecutar
   - Mantener backward compatibility: por defecto exigir ejecución total

3. **Reportes**
   - Crear endpoints de agregación en `/api/contabilidad/anticipos/reportes/*`
   - UI de reportes usando tablas existentes y componentes de exportación

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/busy/contabilidad/anticipos/page.tsx` | New | Página principal de gestión de anticipos |
| `src/components/contabilidad/anticipos/*` | New | Componentes de UI para anticipos |
| `src/lib/services/anticipos-workflow.ts` | Modified | Habilitar ejecución parcial |
| `src/app/api/contabilidad/anticipos/[id]/ejecutar/route.ts` | Modified | Aceptar ejecución parcial |
| `src/app/api/contabilidad/anticipos/reportes/*` | New | Endpoints de reportes |
| `src/lib/redux/services/contabilidadApi.tsx` | Modified | Agregar queries para reportes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Romper ejecución total existente | Medium | Mantener comportamiento por defecto, solo permitir parcial si se indica explícitamente |
| Concurrencia con ejecución parcial | Medium | Ya existe control de concurrencia, solo afinar el update condicional |
| Performance con muchos movimientos | Low | Agregar paginación en historial de movimientos |
| Migración de UI sin perder datos | Low | No tocar base de datos, solo leer existentes |

## Rollback Plan

1. Revertir cambios en `anticipos-workflow.ts` y endpoint ejecutar
2. Eliminar archivos de UI creados
3. Los datos existentes en BD no se tocan
4. Deshacer cambios en `contabilidadApi.tsx`

## Dependencies

- Sistema de anticipos existente (ya implementado en `contabilidad-anticipos-pago-cobro`)
- Endpoints API de anticipos ya existentes
- Componentes de UI de contabilidad existentes

## Success Criteria

- [ ] Página de gestión accesible desde menú de Contabilidad
- [ ] Crear anticipo de pago y cobro desde UI funciona correctamente
- [ ] Listado con filtros muestra todos los anticipos
- [ ] Historial de movimientos visible por anticipo
- [ ] Ejecución parcial funciona (anticipo queda con saldo > 0)
- [ ] Reporte por cliente muestra todos los cobros anticipados
- [ ] Reporte por proveedor muestra todos los pagos anticipados
- [ ] Exportación a CSV funciona
- [ ] Ejecución total sigue funcionando igual que antes
- [ ] Tests pasan sin regresiones
