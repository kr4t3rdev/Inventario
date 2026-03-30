# Tasks: Gestión de Anticipos UI y Funcionalidades Avanzadas

## Phase 1: Backend - Habilitar Ejecución Parcial

- [x] 1.1 Modificar `src/lib/services/anticipos-workflow.types.ts` para agregar campo `permitirParcial?: boolean` en `ExecuteAnticipoParams`
- [x] 1.2 Modificar `src/lib/services/anticipos-workflow.ts` función `executeAnticipo` para:
  - Aceptar el flag `permitirParcial`
  - Cambiar validación actual (líneas ~251-256) para permitir ejecución cuando `montoObjetivo <= saldoDisponible` si `permitirParcial` es true
  - Mantener comportamiento existente (solo ejecución total) cuando `permitirParcial` es false o no definido
- [x] 1.3 Modificar `src/app/api/contabilidad/anticipos/[id]/ejecutar/route.ts` para aceptar `permitirParcial` en el schema Zod
- [ ] 1.4 Agregar tests en `src/lib/services/__tests__/anticipos-workflow.test.ts` para验证 ejecución parcial

## Phase 2: Backend - Endpoints de Reportes

- [x] 2.1 Crear `src/app/api/contabilidad/anticipos/reportes/cliente/route.ts` con:
  - GET que acepta `clienteId`, `fechaInicio`, `fechaFin` como query params
  - Retorna anticipos de COBRO agrupados por cliente con totales
- [x] 2.2 Crear `src/app/api/contabilidad/anticipos/reportes/proveedor/route.ts` con:
  - GET que acepta `proveedorId`, `fechaInicio`, `fechaFin` como query params
  - Retorna anticipos de PAGO agrupados por proveedor con totales
- [x] 2.3 Crear `src/app/api/contabilidad/anticipos/reportes/resumen/route.ts` con:
  - GET sin params que retorna resumen ejecutivo
  - Totales por tipo, estado, moneda
  - Evolución mensual de anticipos
- [ ] 2.4 Agregar tests de integración para los endpoints de reportes

## Phase 3: Types y Redux API

- [x] 3.1 Modificar `src/app/models/model.ts` para agregar:
  - `ReporteAnticipoCliente`
  - `ReporteAnticipoProveedor`
  - `ResumenAnticipos`
  - `ExecuteAnticipoRequest` actualizado con `permitirParcial`
- [x] 3.2 Modificar `src/lib/redux/services/contabilidadApi.tsx` para agregar:
  - `useGetReporteAnticiposClienteQuery`
  - `useGetReporteAnticiposProveedorQuery`
  - `useGetResumenAnticiposQuery`
  - `useExecuteAnticipoMutation` ya existe, verificar que acepte `permitirParcial`
- [x] 3.3 Exportar los nuevos hooks desde el archivo barrel

## Phase 4: UI - Componentes Base

- [x] 4.1 Crear directorio `src/components/contabilidad/anticipos/`
- [x] 4.2 Crear `src/components/contabilidad/anticipos/anticipos-columns.tsx` con columnas para la tabla
- [x] 4.3 Crear `src/components/contabilidad/anticipos/anticipos-filters.tsx` con filtros de tipo, estado, cliente, proveedor, moneda
- [x] 4.4 Crear `src/components/contabilidad/anticipos/anticipos-table.tsx` que usa las columnas y filtros
- [x] 4.5 Crear `src/components/contabilidad/anticipos/anticipo-detail.tsx` para mostrar detalle con movimientos
- [x] 4.6 Crear `src/components/contabilidad/anticipos/anticipo-form.tsx` para crear nuevos anticipos

## Phase 5: UI - Dialogs y Reportes

- [x] 5.1 Crear `src/components/contabilidad/anticipos/anticipo-ejecutar-dialog.tsx` con:
  - Campo para monto a ejecutar
  - Checkbox "Permitir ejecución parcial" (por defecto desmarcado)
  - Confirmación explícita cuando monto < saldo disponible
- [x] 5.2 Crear `src/components/contabilidad/anticipos/anticipo-revertir-dialog.tsx` para reversión
- [x] 5.3 Crear `src/components/contabilidad/anticipos/reportes-anticipos.tsx` con tabs para:
  - Reporte por cliente
  - Reporte por proveedor
  - Resumen ejecutivo
- [x] 5.4 Agregar funcionalidad de exportación CSV en los reportes

## Phase 6: UI - Página Principal

- [x] 6.1 Crear `src/app/busy/contabilidad/anticipos/page.tsx` con:
  - Acceso desde menú de Contabilidad (agregar link en page.tsx de contabilidad)
  - Título "Gestión de Anticipos"
  - Tabs: "Lista" y "Reportes"
  - Botón "Crear Anticipo" que abre el formulario
  - Tabla de anticipos con paginación
  - Filtros persistentes en URL
- [x] 6.2 Agregar link en `src/app/busy/contabilidad/page.tsx` para navegar a "/contabilidad/anticipos"
- [x] 6.3 Verificar que el flag `ENABLE_ANTICIPOS` controle la visibilidad de la página

## Phase 7: Testing y Verificación

- [x] 7.1 Ejecutar tests existentes de anticipos para verificar que no hay regresiones
- [ ] 7.2 Verificar manualmente:
  - Crear anticipo de pago desde UI
  - Crear anticipo de cobro desde UI
  - Ejecutar anticipo totalmente
  - Ejecutar anticipo parcialmente
  - Revertir anticipo
  - Ver historial de movimientos
  - Generar reporte por cliente
  - Generar reporte por proveedor
  - Exportar CSV
- [x] 7.3 Ejecutar `pnpm run lint` para verificar calidad de código
- [x] 7.4 Ejecutar `pnpm run build` para verificar que compila correctamente
