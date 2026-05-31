# Design: Cleanup Urgente — Sidebar duplicado y dependencias muertas

## Orden de ejecución

```
1. Inventory exacto: identificar todas las páginas con SidebarProvider duplicado
2. Migración styled-components → Tailwind (3 loaders)
3. Limpieza de SidebarProvider en cada página
4. Eliminación de dependencias muertas en package.json
5. pnpm install + build + verify
```

La migración de styled-components va ANTES de la eliminación de dependencias porque Item B.7 (styled-components) bloquea a Item B.1-6.

---

## Fase 1: Inventory de páginas con SidebarProvider

### Método

Ejecutar:
```bash
grep -rl "SidebarProvider" src/app/busy --include="*.tsx" | grep -v "layout.tsx$"
```

Para cada archivo encontrado:
1. Leer las primeras líneas para ver si es un page.tsx o layout.tsx anidado
2. Identificar el wrapper exacto a reemplazar
3. Decidir si es reemplazo directo o necesita contenedor alternativo

### Mapeo de casos

**Caso A — Wrapper directo:** La página tiene solo:
```tsx
<SidebarProvider>
  <SidebarInset>
    <div className="container...">{content}</div>
  </SidebarInset>
</SidebarProvider>
```
→ Reemplazar por:
```tsx
<div className="container mx-auto py-4">{content}</div>
```

**Caso B — Wrapper con layout hijo:** La página es en sí un layout para subrutas
→ Requiere revisión manual. Puede ser un layout.tsx que necesita su propio contexto.

**Caso C — Múltiples SidebarProvider:** Páginas con 3+ SidebarProvider (ej: sales/editar/[id]/page.tsx)
→ Reemplazar todos por un solo contenedor o fragment.

### Archivos confirmados hasta ahora

Basado en el grep preliminar, los archivos que duplican SidebarProvider son (lista tentativa):

- src/app/busy/sales/page.tsx
- src/app/busy/sales/new/page.tsx
- src/app/busy/sales/editar/[id]/page.tsx
- src/app/busy/finanzas/page.tsx
- src/app/busy/dashboard/page.tsx
- src/app/busy/cliente/page.tsx
- src/app/busy/cliente/new/page.tsx
- src/app/busy/cliente/update/[id]/page.tsx
- src/app/busy/servicios/recibidos/page.tsx
- src/app/busy/servicios/new/page.tsx
- src/app/busy/servicios/prestados/page.tsx
- src/app/busy/servicios/update/[id]/page.tsx
- src/app/busy/products/bulk-stock-minimo/page.tsx
- src/app/busy/reportes/venta-diaria/page.tsx
- src/app/busy/sugerencias/wanda-dashboard/page.tsx
- src/app/busy/transferencias/new/page.tsx
- src/app/busy/ofertas/new/page-client.tsx
- src/app/busy/ofertas/page-client.tsx
- src/app/busy/contabilidad/analisis-cuenta-cliente/page.tsx
- src/app/busy/contabilidad/cuentas-por-cobrar/page.tsx
- src/app/busy/contabilidad/exchange/page.tsx
- src/app/busy/contabilidad/balance-resultados/page.tsx
- src/app/busy/contabilidad/ajustes/page.tsx
- src/app/busy/contabilidad/cuentas-por-pagar/page.tsx
- src/app/busy/contabilidad/reportes/page.tsx
- src/app/busy/contabilidad/transferencias/page.tsx
- src/app/busy/contabilidad/configuracion/page.tsx
- src/app/busy/contabilidad/logs/page.tsx
- src/app/busy/contabilidad/facturas-vencidas/page.tsx
- src/app/busy/empleados/update/[id]/page.tsx
- src/app/busy/empleados/new/page.tsx
- src/app/busy/plantillas-documentos/page.tsx
- src/app/busy/gastosDE/update/[id]/page.tsx
- src/app/busy/gastosDE/new/page.tsx
- src/app/busy/gastosDE/conceptos/update/[id]/page.tsx
- src/app/busy/gastosDE/conceptos/new/page.tsx
- src/app/busy/gastosDE/conceptos/[id]/elementos/update/[elementoId]/page.tsx
- src/app/busy/gastosDE/conceptos/[id]/elementos/new/page.tsx
- src/app/busy/invoice/page.tsx
- src/app/busy/compras-productos/[id]/edit/page.tsx

### Verificación pre/post

```bash
# Antes
grep -rl "SidebarProvider" src/app/busy --include="*.tsx" | wc -l
# Después
grep -rl "SidebarProvider" src/app/busy --include="*.tsx"
# Debe mostrar solo: src/app/busy/layout.tsx
```

---

## Fase 2: Migración styled-components → Tailwind

### Loader 1: hoja/loader.tsx

Leer el archivo, identificar el styled component, reemplazar por Tailwind classes.

### Loader 2: maq_escr/loader.tsx

Ídem.

### Loader 3: rojo/loader.tsx

Ídem.

### Patrón de reemplazo

```tsx
// ANTES
import styled from 'styled-components';
const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
`;

// DESPUÉS - opción A: Tailwind directo
<div className="flex items-center justify-center w-full h-screen">
  {/* SVG */}
</div>

// DESPUÉS - opción B: className constante si es muy largo
const containerClass = "flex items-center justify-center w-full h-screen";
<div className={containerClass}>
  {/* SVG */}
</div>
```

### Verificación

- Renderizar cada loader y comparar visualmente
- Asegurarse de que las animaciones SVG (strokeDasharray, keyframes) se mantengan

---

## Fase 3: Limpieza de SidebarProvider

### Patrón de reemplazo por página

Para CADA página identificada:

1. Leer el archivo completo para entender su estructura
2. Identificar el bloque exacto:
```tsx
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
```
3. Reemplazar el wrapper:
```tsx
// ANTES
return (
  <SidebarProvider>
    <SidebarInset>
      <div className="...">{children}</div>
    </SidebarInset>
  </SidebarProvider>
)

// DESPUÉS — mantener solo el contenido visible
return (
  <div className="...">{children}</div>
)
// O si no había className externo, simplemente el contenido sin wrapper extra
```
4. Eliminar imports de SidebarProvider y SidebarInset si ya no se usan
5. Si los imports se usan para otra cosa (ej: un layout anidado), mantenerlos

### Edge cases

- **Páginas client (`*-client.tsx`)**: Si el SidebarProvider está en el page.tsx (server) y el contenido en un client component, la limpieza se hace en page.tsx
- **Páginas con layout propio**: Si hay un layout.tsx intermedio entre busy/layout.tsx y la página, puede que el SidebarProvider sea necesario allí. Verificar antes de eliminar.
- **Páginas que usan SidebarInset para estilos**: Reemplazar por un div con `className="flex flex-1 flex-col"` (que es lo que SidebarInset hace internamente)

---

## Fase 4: Eliminar dependencias muertas

### package.json

Eliminar de `dependencies` (no devDependencies):
- "add": "^2.0.6"
- "switch": "^0.0.0"
- "toast": "^0.5.4"
- "cookies-next": "^6.0.0"
- "react-to-print": "^3.1.1"
- "react-date-picker": "^11.0.0"
- "styled-components": "^6.1.19"  (solo después de migrar loaders)

### package.json overrides

Verificar si hay overrides para estas dependencias. Si no, no tocar.

### Post-eliminación

```bash
pnpm install  # regenera lockfile
pnpm run build  # verifica que todo compila
pnpm run lint   # verifica que no hay errores
```

---

## Rollback plan

### Para SidebarProvider

```bash
# Si algo rompe, revertir todos los archivos tocados
git checkout src/app/busy/*/page.tsx src/app/busy/*/*/page.tsx
```

### Para dependencias

```bash
# Si build falla por dependencia faltante
git checkout package.json
pnpm install
```

---

## Estimación de diff

| Item | Archivos | LOC aprox |
|---|---|---|
| Sidebar cleanup | ~40 páginas | ~80-120 líneas (-2 a -4 líneas c/u) |
| Migración loaders | 3 loaders | ~30-60 líneas |
| package.json | 1 archivo | ~7 líneas |
| **Total** | **~44 archivos** | **~120-200 líneas** |

Dentro del budget de 400 líneas ✅
