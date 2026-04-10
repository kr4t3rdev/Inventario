# Tasks: Remove Sileo Shim

## Fase 1. Baseline y patrón compartido

- [ ] Relevar el baseline real con `rg "sileo-shim" src` y consolidar los archivos residuales en lotes lógicos de ejecución: helpers compartidos, contabilidad, formularios operativos y pantallas sueltas.
- [ ] Migrar primero los módulos compartidos que concentran notificaciones, en especial `src/components/contabilidad/toast-notifications.tsx`, para que importen `toast` desde `sonner` y preserven el contrato final `toast.metodo(title, options)` sin perder ids, `description` ni opciones adicionales.

Validación del bloque:

- [ ] Ejecutar `pnpm typecheck` tras cerrar el helper compartido y corregir cualquier incompatibilidad de firma antes de avanzar.

## Fase 2. Lote contabilidad

- [ ] Migrar en un solo lote los formularios, diálogos y wrappers de contabilidad que todavía consumen `@/lib/sileo-shim`, reemplazando cada import por `sonner` directo sin refactors laterales.
- [ ] Ajustar en ese lote todas las llamadas de `success`, `error`, `warning`, `info`, `dismiss` y `clear` al mapeo nativo de Sonner, separando `title` como primer argumento y preservando el resto de opciones.

Validación del bloque:

- [ ] Ejecutar `pnpm typecheck` al terminar el lote contable.
- [ ] Ejecutar `pnpm test:run -- <rutas de tests contables tocados>` si existen coberturas sobre los archivos afectados.

## Fase 3. Lote formularios y pantallas operativas

- [ ] Migrar en un lote unificado los formularios operativos fuera de contabilidad que aún importan el shim: ventas, compras, productos, servicios, empleados, clientes, almacén, transferencias, PtoVenta y dominios equivalentes.
- [ ] Migrar las pantallas o componentes residuales no cubiertos por los lotes anteriores para dejar todos los consumidores de `src/` alineados a `toast` directo desde `sonner`.

Validación del bloque:

- [ ] Ejecutar `pnpm typecheck` al cerrar el lote operativo.
- [ ] Ejecutar `pnpm test:run -- <rutas de tests de formularios/páginas tocados>` sobre los flujos más sensibles del lote.

## Fase 4. Tests y mocks

- [ ] Actualizar tests, spies y mocks afectados para apuntar a `sonner`, verificando la firma real `toast.metodo(title, options)` y ampliando el mock con `warning`, `info` o `dismiss` donde haga falta.

Validación del bloque:

- [ ] Ejecutar `pnpm typecheck:tests` si el ajuste toca tipado de pruebas.
- [ ] Ejecutar `pnpm test:run -- <rutas exactas de tests tocados>` hasta dejar verde la cobertura afectada por la migración.

## Fase 5. Cierre del cambio

- [ ] Ejecutar una búsqueda residual explícita con `rg "sileo-shim" src` y resolver cualquier referencia ejecutable, mock o reexport pendiente hasta llegar a cero coincidencias.
- [ ] Borrar `src/lib/sileo-shim.ts` y limpiar imports huérfanos o referencias asociadas que queden obsoletas después de la migración.
- [ ] Correr la validación final del cambio con `pnpm typecheck` y `pnpm test:run -- <tests focalizados de los archivos tocados>` antes de cerrar el artifact.