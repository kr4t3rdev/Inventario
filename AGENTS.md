# Guidelines for AI Coding Agents

## Project Overview

Este proyecto es un sistema de gestión de inventario desarrollado con Next.js 15, TypeScript y Prisma. Incluye funcionalidades para la administración de productos, categorías, ventas, contabilidad, empleados, almacenes y puntos de venta. Utiliza una base de datos relacional con Prisma, autenticación JWT, y una interfaz de usuario moderna con React, Tailwind CSS y componentes de Radix UI. El proyecto está diseñado para ser escalable y modular, con APIs RESTful para la comunicación backend-frontend.

Características principales:

- Gestión de inventario y productos
- Sistema de ventas y facturación
- Contabilidad con conversión de monedas
- Administración de usuarios y empleados
- Reportes y análisis de datos
- Interfaz responsiva y accesible

Stack tecnológico:

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Radix UI, Shadcn/ui
- **Backend**: Next.js Server Actions, Next.js API Routes (legacy), Prisma ORM, PostgreSQL
- **Estado**: React `useState`/`useReducer` (server actions reemplazan Redux/RTK Query)
- **Validación**: Zod
- **Testing**: Vitest

## Restricted files

<!-- Files in the list contain sensitive data, they MUST NOT be read -->

- `.env`
- `.env.local`
- `prisma/.env`

## Demo Features

- `TenantLicense.isDemo` (Boolean): marca licencias demo, filtradas de KPIs del admin
- `TenantLicense.createdBy` (String?): ID del admin que creó la demo (auditoría)
- `createDemoTenantAction`: crea tenant + usuario + licencia demo + seed de datos
- `cleanupExpiredDemoLicenciasAction`: desactiva demos expiradas (dry-run o real)
- Cron job cada 1h: `deactivate-expired-demos.sh` via `no_agent=True`
- **Seed diferenciado por plan**:
  - `prisma/seed/demo/base-seed.ts` → Básico (~20 productos, 1 almacén)
  - `prisma/seed/demo/professional-seed.ts` → +25 productos, +1 almacén, ventas
  - `prisma/seed/demo/enterprise-seed.ts` → +50 productos, +2 almacenes, compras, transferencias
  - Orquestador: `src/lib/services/demo-seed.ts` (resuelve perfil y ejecuta seeds)

## EAN-13 / CLAS Classifier

- Feature flag: `categorias-ean13` en Plan.features + `usaCodigoEan13` en MiEmpresa
- CLAS classifier: archivo `public/clasificador.md` parseado en `src/lib/clas-classifier.ts`
- "Categorías" y "Subcategorías" se renombran a "Secciones CLAS" y "Específicos CLAS" en modo EAN-13
- Helper `getCategoryLabels(usaEan13)` en `src/features/categorias/lib/category-labels.ts`
- Validación CLAS: `CategoriaValidator` en `src/lib/categoria-validation.ts`


## Build and Test Commands

### Desarrollo

- `pnpm run dev`: Inicia el servidor de desarrollo con Turbopack para recarga rápida.
- `pnpm run build`: Construye la aplicación para producción.
- `pnpm run start`: Inicia el servidor de producción.

### Calidad de Código

- `pnpm run lint`: Ejecuta ESLint para verificar el código según las reglas de Next.js y TypeScript.

### Pruebas (Vitest)

- `pnpm test`: Ejecuta las pruebas con Vitest en modo watch.
- `pnpm run test:run`: Ejecuta las pruebas una vez y sale.
- `pnpm test -- <ruta_archivo>`: Ejecuta un archivo de prueba específico.
- `pnpm test -- -t "nombre del test"`: Ejecuta tests que coincidan con el nombre.
- `pnpm test -- --ui`: Abre la interfaz de usuario de Vitest.

**Importante**: Después de ejecutar los tests y obtener un resultado, cierra la ejecución antes de continuar.

## Code Style Guidelines

### Language and UI Copy

- Todo texto visible para usuarios debe escribirse en **español neutro internacional**.
- No usar voseo ni conjugaciones rioplatenses en UI, mensajes, validaciones, documentación
  funcional o datos de demostración.
- Evitar formas como `vos`, `sos`, `tenés`, `querés`, `podés`, `probá`, `hacé`, `elegí`,
  `compartí`, `ganá`, `cobrá` o `registrate`.
- Usar equivalentes neutrales como `tú`, `eres`, `tienes`, `quieres`, `puedes`, `prueba`,
  `haz`, `elige`, `comparte`, `gana`, `cobra` y `regístrate`.
- No eliminar tildes gramaticalmente correctas del español neutro (`está`, `será`, `regístrate`).
- Los cambios de copy en la landing deben mantener aprobado
  `src/features/landing/__tests__/neutral-spanish-copy.test.ts`.

### Imports

- Utiliza imports absolutos con el alias `@/` para archivos dentro de `src/`.
- Agrupa los imports en este orden:
  1. Libraries externas (React, lucide-react, etc.)
  2. Componentes de UI (@/components/ui/*)
  3. Hooks personalizados (@/hooks/*)
  4. Utilidades (@/lib/utils, @/lib/redux/*)
  5. Modelos y tipos (@/app/models/*)
  6. Assets y estilos

```typescript
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getVentasAction } from "@/features/ventas/actions"
import { Venta } from "@/app/models/model"
```

### Formatting

- Usa indentación de 2 espacios (no tabs).
- Líneas máximo 100 caracteres.
- Usa punto y coma al final de statements.
- Comillas simples para strings (`'texto'`).
- Usa `eslint.config.mjs` que extiende `next/core-web-vitals` y `next/typescript`.

### Types

- TypeScript en modo estricto (`strict: true`).
- Evita `any`; usa `unknown` o tipos específicos.
- Usa interfaces para objetos y tipos literales para uniones.
- Tipos compartidos van en `src/lib/types/` o `src/app/models/`.

```typescript
interface Venta {
  ventaId: string
  total: number
  estado: 'completada' | 'pendiente' | 'cancelada'
}
```

### Naming Conventions

- **Variables y funciones**: camelCase (`handleSubmit`, `userData`, `formatCurrency`)
- **Componentes React**: PascalCase (`LoginForm`, `CuadreDiario`)
- **Constantes**: UPPER_CASE (`JWT_SECRET`, `API_BASE_URL`)
- **Archivos componentes**: kebab-case (`cuadre-diario.tsx`, `login-form.tsx`)
- **Archivos utilidades**: camelCase (`authUtils.ts`, `pdfGenerator.ts`)
- **Rutas API**: kebab-case (`/api/ventas/stats`, `/api/auth/login`)
- **Modelos Prisma**: PascalCase (`Venta`, `Producto`, `GastosDE`)
- **Hooks personalizados**: camelCase con prefix `use` (`useVentas`, `useCategoryForm`)

### Error Handling

- Usa `try-catch` en funciones async, especialmente API routes.
- Registra errores con `console.error` incluyendo contexto.
- Devuelve códigos HTTP apropiados: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error).
- Usa Zod para validación de esquemas de entrada.
- En React, usa estados de error con Toast notifications.

## Server Action Pattern (Recomendado)

Para nuevas features o migraciones de RTK Query, usar Server Actions con el wrapper `withAction`:

### Definir una Server Action

```typescript
'use server';

import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// Query
export const getItemsAction = withAction(async (params: { page?: number; limit?: number } = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const items = await prisma.item.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return { items, total: items.length };
});

// Mutation con validación Zod
const createSchema = z.object({
  nombre: z.string().min(1),
  monto: z.number().positive(),
});

export const createItemAction = withAction(async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
  const parsed = createSchema.parse(input);
  const tenantId = requireTenant(user);
  // Lógica de negocio (validaciones, etc.)
  const existing = await prisma.item.findFirst({ where: { nombre: parsed.nombre, tenantId } });
  if (existing) throw new ActionError('Ya existe un ítem con ese nombre', 'DUPLICATE');
  // Crear
  const item = await prisma.item.create({ data: { ...parsed, tenantId } });
  revalidatePath('/busy/ruta');
  return { item };
});

// Mutation sin body (solo id)
export const deleteItemAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const item = await prisma.item.findFirst({ where: { id, tenantId } });
  if (!item) throw new ActionError('Ítem no encontrado', 'NOT_FOUND');
  await prisma.item.delete({ where: { id } });
  revalidatePath('/busy/ruta');
  return { success: true };
});
```

### Usar en un Componente Cliente

```typescript
'use client';
import { useState, useEffect } from 'react';
import { getItemsAction } from '@/features/<feature>/actions';

export function ItemsList() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getItemsAction({ page: 1, limit: 50 })
      .then(r => {
        if (r.success) { setItems(r.data?.items ?? []); setIsLoading(false); }
        else { setError(r.error); setIsLoading(false); }
      })
      .catch(e => { setError(e); setIsLoading(false); });
  }, []);
  // ...
}
```

### Para mutations con feedback

```typescript
const handleSubmit = async (data: FormData) => {
  setIsSubmitting(true);
  try {
    const r = await createItemAction(data);
    if (!r.success) throw new Error(r.error?.message || 'Error');
    toast.success('Creado exitosamente');
    refetch(); // o setRefreshKey(k => k + 1)
  } catch (err) {
    toast.error(err.message);
  } finally {
    setIsSubmitting(false);
  }
};
```

### Reglas

- Las Server Actions se definen con `'use server'` al inicio del archivo.
- Usar `withAction` wrapper (no raw `'use server'` functions).
- `withAction` maneja auth automáticamente, requiere `requireTenant()` para multi-tenant.
- El wrapper retorna `{ success: true, data: T }` o `{ success: false, error: { message, code? } }`.
- Para auditoría, usar `AuditLogService.log()`.
- `revalidatePath()` después de mutations para refrescar caché de Next.js.
- Archivos de actions van en `src/features/<feature>/actions*.ts`.
- NO usar Redux/RTK Query para nuevas features.

### General Best Practices

- Documenta componentes React con JSDoc en español.
- Mantén lógica de negocio separada de UI (hooks, servicios).
- Componentes deben ser menores de 200 líneas.
- Usa dependency injection donde sea apropiado.
- Implementa loading states y accessibility (ARIA labels).

## React Component Creation Rules

- Toda función, clase o componente debe incluir un bloque JSDoc encima de su definición.
- Incluye mínimo: `@description`, `@param` (con tipo y descripción), `@returns`.
- Si es React component, documenta la interfaz de props.

```typescript
/**
 * @description Componente para mostrar el formulario de login
 * @param {LoginFormProps} props - Props del componente
 * @returns {JSX.Element} Formulario de login
 */
export function LoginForm({ onSubmit }: LoginFormProps): JSX.Element {
```

## Architecture

- **Patrón**: MVC con separación clara entre componentes, servicios y utilidades.
- **Server Actions**: Preferir Server Actions (`withAction` wrapper en `src/lib/server-actions/`) sobre API Routes para operaciones CRUD y queries. Las Server Actions se ejecutan en el servidor, manejan autenticación automáticamente y retornan `{ success, data?, error? }`.
- **API Routes**: Solo para exportación de archivos (CSV/PDF) o integraciones externas que necesiten endpoints HTTP públicos.
- **Prisma**: Usar `prisma.model.findMany/unique/create/update/delete`.
- **Redux Toolkit**: NO usar para nuevos features. Reemplazar progresivamente donde exista. El estado del servidor se maneja con Server Actions + `useState`/`useEffect` en el cliente.
- **Data Fetching en cliente**: Llamar Server Actions directamente desde `useEffect` o event handlers. No usar RTK Query ni React Query.

### Estructura de Feature

Cada feature sigue esta estructura dentro de `src/features/<feature>/`:

```
src/features/<feature>/
├── actions.ts              # Server Actions (withAction)
├── actions-<subfeature>.ts # Server Actions agrupadas por subdominio
├── components/             # Componentes React del feature
│   ├── <Componente>.tsx
│   └── ...
├── hooks/                  # Custom hooks (opcional)
├── api/                    # API Handlers (solo si es necesario, legacy)
│   └── handlers.ts
└── index.ts                # Barrel export
```

## Testing

- Escribe tests unitarios para lógica de negocio.
- Mantén cobertura mayor al 80%.
- Usa Vitest (no Jest).
- Tests en archivos `*.test.ts` o `*.test.tsx` junto al código que prueban.
- Usa `@testing-library/react` para componentes.
- Implementa accessibility testing con `vitest-axe`.

## API Development (Legacy)

Para nuevas features, usar Server Actions. Solo usar API Routes cuando sea estrictamente necesario (exportación de archivos, webhooks, integraciones externas).

- API routes en `src/app/api/<recurso>/route.ts`.
- Usa los middlewares de autenticación: `withAuthGet`, `withAuthPost`, `withAuth`.
- Maneja errores con try-catch y devuelve NextResponse.json con código apropiado.
- Consultas a base de datos via Prisma con await y manejo de null checks.
- Params de query via `searchParams` de URL.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
