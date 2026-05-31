# Spec: Cleanup Urgente — Sidebar duplicado y dependencias muertas

## Resumen

Eliminar el SidebarProvider duplicado en ~40 páginas hijas de `/busy/*` y podar 6 dependencias no utilizadas (migrando primero las 3 que usan styled-components).

## Item A: SidebarProvider duplicado

### Contexto

`src/app/busy/layout.tsx` es el layout raíz de todas las rutas `/busy/*`. Renderiza:

```
<SidebarProvider>
  <AppSidebar2 variant="floating" />
  <SidebarInset>
    <SiteHeader />
    {children}
  </SidebarInset>
</SidebarProvider>
```

Cada página hija que envuelve su contenido con otro `<SidebarProvider>` + `<SidebarInset>` está creando un provider anidado, lo que puede causar problemas de contexto React.

### Reglas (RFC 2119)

1. **MUST** — `src/app/busy/layout.tsx` DEBE seguir siendo el único proveedor de `<SidebarProvider>` en la jerarquía.
2. **MUST** — Toda página hija que actualmente renderice `<SidebarProvider>` como wrapper DEBE eliminarlo, dejando solo el contenido que iba dentro de `<SidebarInset>`.
3. **MUST** — Si una página hija importa `SidebarProvider` o `SidebarInset` pero no los usa después de la limpieza, DEBE eliminar esos imports.
4. **MUST NOT** — Ninguna página hija DEBE importar `SidebarProvider` para nada que no sea pasar props al layout (no aplica, el layout ya lo maneja).
5. **SHOULD** — Verificar que el collapse state de la sidebar funcione después del cambio.
6. **SHOULD** — Verificar responsividad (mobile sidebar overlay).

### Scenarios (Given/When/Then)

```
Scenario 1: Página con SidebarProvider innecesario
  Given una página en /busy/<section>/page.tsx que envuelve su contenido con <SidebarProvider>
  When se elimina el wrapper <SidebarProvider> + <SidebarInset>
  Then la página hereda correctamente el contexto del layout padre
  And el contenido se renderiza sin sidebar duplicado
  And no hay errores de compilación ni runtime

Scenario 2: Página que además usa SidebarInset para layout interno
  Given una página que usa <SidebarProvider> anidado para un sub-layout
  When se elimina el wrapper duplicado
  Then puede que necesite un div contenedor simple con className="container mx-auto py-4" (o similar)
  And debe mantener su layout visual intacto
  And los estilos responsivos se conservan

Scenario 3: Página no cubierta por layout.tsx
  Given una página en /busy/* que NO hereda de busy/layout.tsx
  When se elimina su <SidebarProvider>
  Then rompe porque no tiene contexto de sidebar
  → Caso límite: hay que verificar cada página individualmente antes de modificar
```

### Archivos afectados

- Layout padre: `src/app/busy/layout.tsx` (sin cambios)
- ~40 páginas bajo `src/app/busy/*/page.tsx` (cada una necesita remover los wrappers)
- Archivos de layout anidados en subrutas: `src/app/busy/*/layout.tsx` (pueden o no tener SidebarProvider)

### Criterio de éxito

- `grep -rl "SidebarProvider" src/app/busy --include="*.tsx"` muestra SOLO `src/app/busy/layout.tsx`

---

## Item B: Podar dependencias muertas

### Contexto

El `package.json` contiene dependencias que no se usan o que tienen alternativas superiores ya instaladas.

### Dependencias a eliminar

| Dependencia | Razón |
|---|---|
| `add` | Paquete zombie, instalado accidentalmente |
| `switch` | Paquete zombie, instalado accidentalmente |
| `toast` | No se usa; `sonner` es la lib de toasts real |
| `cookies-next` | No hay imports en `src/` |
| `react-to-print` | No hay imports en `src/` |
| `react-date-picker` | No se usa como dependencia directa |
| `styled-components` | Usado en 3 loaders — requiere migración previa |

### Tratamiento de styled-components

Los 3 archivos que usan styled-components:

1. `src/components/Loaders/hoja/loader.tsx`
2. `src/components/Loaders/maq_escr/loader.tsx`
3. `src/components/Loaders/rojo/loader.tsx`

Cada loader renderiza un SVG animado. La migración MUST:

1. Reemplazar `styled.div``...``` por Tailwind utility classes + CSS module o inline styles.
2. NO cambiar la animación ni la apariencia visual (son loaders decorativos).
3. Eliminar el import de `styled-components`.
4. Verificar que el loader se renderiza correctamente.

### Reglas (RFC 2119)

1. **MUST** — Las 6 dependencias sin uso directo DEBEN eliminarse de `dependencies` en `package.json`.
2. **MUST** — `styled-components` DEBE migrarse a Tailwind/CSS antes de eliminar.
3. **MUST** — Los 3 loaders DEBEN mantener su apariencia visual idéntica post-migración.
4. **SHOULD** — Correr `pnpm install` para regenerar lockfile.
5. **SHOULD** — Verificar que `pnpm run build` pasa sin errores.

### Scenarios (Given/When/Then)

```
Scenario 1: Dependencias zombie sin uso
  Given que existen "add", "switch", "toast" en dependencies
  When se eliminan de package.json y se corre pnpm install
  Then no hay errores de compilación
  And ninguna importación falla porque no se usaban

Scenario 2: Dependencias con posible uso indirecto
  Given que existen "cookies-next", "react-to-print", "react-date-picker" en dependencies
  When se buscan imports en src/
  Then si no hay imports, se eliminan sin impacto
  And si hay imports (caso react-date-picker solo type import), se reemplaza por definición local

Scenario 3: Migración de styled-components
  Given 3 loaders que usan styled-components
  When se migran a Tailwind/CSS
  Then la animación SVG se mantiene idéntica
  And el componente no cambia visualmente
  And styled-components se elimina de dependencies
```

### Criterio de éxito

- `pnpm run build` exitoso
- `pnpm run lint` sin errores nuevos
- Loaders renderizan igual que antes
- `grep -r "from 'styled-components'" src/` vacío
- Las 6 dependencias no aparecen en `package.json` > `dependencies`
