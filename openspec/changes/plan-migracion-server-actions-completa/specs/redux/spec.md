# Spec: Eliminación de Redux/RTK Query

## Feature: Dead Code Removal

### Escenario 1: productoSlice eliminado
**Given** el archivo `src/lib/redux/slices/productoSlice.tsx` (0 líneas, vacío)
**When** se elimina el archivo
**Then** ningún import en el códigobase referencia `productoSlice` o `@/lib/redux/slices/productoSlice`
**And** `pnpm run build` es exitoso
**And** `pnpm run test:run` es exitoso

## Feature: Theme Migration

### Escenario 2: theme migrado a CSS + localStorage
**Given** el `themeSlice.tsx` maneja `mode: 'light' | 'dark'`
**When** se migra a CSS `prefers-color-scheme` + localStorage + Tailwind `darkMode: 'class'`
**Then** el tema persiste entre recargas (localStorage)
**And** respeta preferencia del SO (prefers-color-scheme)
**And** no hay referencias a `useAppSelector(selectThemeMode)` o `useAppDispatch(setThemeMode)`
**And** el toggle manual de tema sigue funcionando

## Feature: Contabilidad State Migration

### Escenario 3: selectedCuenta y filtros → URL search params
**Given** el `contabilidadSlice` maneja `selectedCuentaId`, `selectedMoneda`, `filtros`
**When** se migra a URL search params (`useSearchParams` + `useRouter`)
**Then** los filtros persisten en la URL (compartibles, bookmarkeables)
**And** navegación hacia atrás/adelante funciona correctamente
**And** el estado se mantiene al recargar la página

### Escenario 4: loading y error → useState local
**Given** el `contabilidadSlice` maneja estados `loading` y `error`
**When** se migra a `useState` local en cada componente
**Then** cada componente maneja su propio estado de carga y error
**And** no hay estado compartido de loading/error entre componentes no relacionados

### Escenario 5: Data fetching → Server Actions directas
**Given** los datos en `contabilidadSlice` (cuentas, monedas, tasas, etc.)
**When** se migran a Server Actions llamadas desde `useEffect`
**Then** los mismos datos se obtienen sin pasar por Redux
**And** `revalidatePath`/`revalidateTag` invalida la data cuando corresponde

## Feature: RTK Query Migration

### Escenario 6: prestamosCashApi → Server Actions
**Given** los 6 endpoints de `prestamosCashApi` (getPrestamosCash, createPrestamoCash, etc.)
**When** se crean Server Actions equivalentes
**Then** componentes que usaban RTK Query hooks ahora llaman SA directo
**And** la data se refresca correctamente post-mutación
**And** no hay referencias a `prestamosCashApi` ni a sus hooks

## Feature: Redux Cleanup

### Escenario 7: apiSlice eliminado
**Given** `apiSlice.tsx` con `endpoints: () => ({})` y 50+ tagTypes sin endpoints reales
**When** `prestamosCashApi` ha sido migrado
**Then** `apiSlice.tsx` se puede eliminar (sin endpoints reales)
**And** no hay imports rotos

### Escenario 8: ReduxProvider eliminado del layout
**Given** `ReduxProvider` envuelve la app en el layout
**When** todos los slices y APIs han sido migrados
**Then** `ReduxProvider` se elimina del layout
**And** `store.tsx`, `hooks.ts`, toda la carpeta `src/lib/redux/` se elimina
**And** `@reduxjs/toolkit` y `react-redux` se eliminan de `package.json`

## Criterios de Aceptación

- [ ] productoSlice.tsx eliminado sin impacto
- [ ] Tema funciona sin Redux (CSS + localStorage)
- [ ] Filtros de contabilidad persisten en URL
- [ ] loading/error manejados localmente
- [ ] prestamosCash migrado a SA
- [ ] apiSlice eliminado
- [ ] ReduxProvider eliminado del layout
- [ ] `@reduxjs/toolkit` y `react-redux` removidos de dependencias
- [ ] Build + tests OK después de cada paso
