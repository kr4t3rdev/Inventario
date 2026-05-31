# Tasks: Cleanup Urgente — Sidebar duplicado y dependencias muertas

## Dependencia entre tareas

```
T1 (inventario exacto)
  ├── T2 (migrar loader hoja)
  ├── T3 (migrar loader maq_escr)
  ├── T4 (migrar loader rojo)
  │
T5 (Sidebar sales/* y finanzas/dashboard)
T6 (Sidebar clientes y servicios)
T7 (Sidebar contabilidad)
T8 (Sidebar empleados y misc)
T9 (Sidebar gastosDE)
  │
T10 (eliminar deps package.json + pnpm install)
T11 (build + lint + verify)
```

Las T2-T4 son independientes entre sí. Todas deben completarse antes de T10.
Las T5-T9 son independientes entre sí. Cada una toca distintos archivos.
T11 depende de T5-T9 + T10.

## T1: Inventory exacto de SidebarProvider

**Archivos:** Ninguno (comando de discovery)

**Acción:** Ejecutar:
```bash
grep -rl "SidebarProvider" src/app/busy --include="*.tsx" | grep -v "layout.tsx$"
```
Guardar la lista como línea de base para las tareas T5-T9.

**Criterio:** Lista completa de archivos con SidebarProvider duplicado.

---

## T2: Migrar loader hoja de styled-components a Tailwind

**Archivo:** `src/components/Loaders/hoja/loader.tsx`

**Acción:**
1. Leer el archivo completo
2. Reemplazar styled-components por Tailwind utility classes
3. No cambiar la animación ni el SVG

**Criterio:** El import de `styled-components` desaparece del archivo. El componente se ve igual.

---

## T3: Migrar loader maq_escr de styled-components a Tailwind

**Archivo:** `src/components/Loaders/maq_escr/loader.tsx`

**Acción:** Ídem T2.

---

## T4: Migrar loader rojo de styled-components a Tailwind

**Archivo:** `src/components/Loaders/rojo/loader.tsx`

**Acción:** Ídem T2.

---

## T5: Limpiar SidebarProvider en sales/*, finanzas, dashboard

**Archivos:**
- src/app/busy/sales/page.tsx
- src/app/busy/sales/new/page.tsx
- src/app/busy/sales/editar/[id]/page.tsx
- src/app/busy/finanzas/page.tsx
- src/app/busy/dashboard/page.tsx
- src/app/busy/ofertas/new/page-client.tsx
- src/app/busy/ofertas/page-client.tsx

**Acción por archivo:**
1. Remover `import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"`
2. Remover `<SidebarProvider>` y `</SidebarProvider>`
3. Remover `<SidebarInset>` y `</SidebarInset>`
4. Si no queda un wrapper contenedor, agregar un `<div>` simple
5. Verificar que el/los componente(s) interno(s) no dependan de SidebarInset para estilos

---

## T6: Limpiar SidebarProvider en clientes y servicios

**Archivos:**
- src/app/busy/cliente/page.tsx
- src/app/busy/cliente/new/page.tsx
- src/app/busy/cliente/update/[id]/page.tsx
- src/app/busy/servicios/recibidos/page.tsx
- src/app/busy/servicios/new/page.tsx
- src/app/busy/servicios/prestados/page.tsx
- src/app/busy/servicios/update/[id]/page.tsx
- src/app/busy/plantillas-documentos/page.tsx
- src/app/busy/invoice/page.tsx

**Acción:** Ídem T5.

---

## T7: Limpiar SidebarProvider en contabilidad

**Archivos:**
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

**Acción:** Ídem T5.

---

## T8: Limpiar SidebarProvider en empleados y misc

**Archivos:**
- src/app/busy/empleados/update/[id]/page.tsx
- src/app/busy/empleados/new/page.tsx
- src/app/busy/products/bulk-stock-minimo/page.tsx
- src/app/busy/reportes/venta-diaria/page.tsx
- src/app/busy/sugerencias/wanda-dashboard/page.tsx
- src/app/busy/transferencias/new/page.tsx
- src/app/busy/compras-productos/[id]/edit/page.tsx

**Acción:** Ídem T5.

---

## T9: Limpiar SidebarProvider en gastosDE

**Archivos:**
- src/app/busy/gastosDE/update/[id]/page.tsx
- src/app/busy/gastosDE/new/page.tsx
- src/app/busy/gastosDE/conceptos/update/[id]/page.tsx
- src/app/busy/gastosDE/conceptos/new/page.tsx
- src/app/busy/gastosDE/conceptos/[id]/elementos/update/[elementoId]/page.tsx
- src/app/busy/gastosDE/conceptos/[id]/elementos/new/page.tsx

**Acción:** Ídem T5.

---

## T10: Eliminar dependencias muertas de package.json

**Archivo:** `package.json`

**Acción:**
1. Eliminar de `dependencies`:
   - "add"
   - "switch"
   - "toast"
   - "cookies-next"
   - "react-to-print"
   - "react-date-picker"
   - "styled-components"
2. Ejecutar `pnpm install` para regenerar lockfile

**Precondición:** T2, T3, T4 completadas (styled-components ya no se usa).

---

## T11: Build + Lint + Verify

**Acción:**
1. `pnpm run build` — debe compilar sin errores
2. `pnpm run lint` — sin errores nuevos
3. `grep -rl "SidebarProvider" src/app/busy --include="*.tsx"` — solo layout.tsx
4. `grep -r "from 'styled-components'" src/` — vacío

**Criterio:** Todo OK → listo para commit/PR.
