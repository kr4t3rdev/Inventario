# Tasks: Sistema inicial de categorías (categorías en 0)

## Phase 1: Foundation (configuración global de modo)
- [x] 1.1 Modificar `prisma/schema.prisma` para agregar `ModoClasificacionCatalogo` y campo global en `CatalogoReparacionConfig`.
- [x] 1.2 Crear migración SQL en `prisma/migrations/*` con default `clasificador_oficial` y backfill para registro `id=1`.
- [x] 1.3 Actualizar `src/app/api/reparaciones/catalogo/config/route.ts` para GET/PUT de `modoClasificacion` (global, admin-only en PUT).

## Phase 2: Core Implementation (reglas de código y surtido)
- [x] 2.1 Actualizar `src/lib/ean13-utils.ts` para que `FindNextAvailableSurtido` filtre por `proveedorCodigo`.
- [x] 2.2 Actualizar `src/app/api/productos/route.ts` para ramificar por modo: oficial genera EAN; usuario guarda `codigoNegocio`/segmentos en `null`.

## Phase 3: UI / Wiring (catálogo + creación de productos)
- [x] 3.1 Modificar `src/app/busy/configuracion/catalogo/page.tsx` para mostrar selector de dos opciones y persistir el modo global.
- [x] 3.2 Modificar `src/components/productos/productos-form.tsx` para ocultar todo lo relacionado a `codigoNegocio` cuando el modo sea `estructura_usuario`.
- [x] 3.3 Modificar `src/components/productos/compound-product-section.tsx` para ocultar preview/campos de código hijo en modo `estructura_usuario`.

## Phase 4: Testing
- [x] 4.1 Actualizar `src/lib/ean13-utils-surtido.test.ts` para cubrir reinicio/aislamiento de surtido por proveedor.
- [x] 4.2 Agregar tests para `src/app/api/reparaciones/catalogo/config/route.ts` validando `modoClasificacion` y permisos.
- [x] 4.3 Ajustar tests de formulario producto compuesto para el comportamiento por modo.
