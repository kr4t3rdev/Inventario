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
- **Backend**: Next.js API Routes, Prisma ORM, PostgreSQL
- **Estado**: Redux Toolkit, React Query
- **Validación**: Zod
- **Testing**: Vitest

## Restricted files

<!-- Files in the list contain sensitive data, they MUST NOT be read -->

- `.env`
- `.env.local`
- `prisma/.env`

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
import { useGetVentasQuery } from "@/lib/redux/services/ventasApi"
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
- En React, usa estados de error con React Query o Toast notifications.

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
- **API Routes**: Siguen patrón RESTful, usan `withAuthGet`/`withAuthPost` wrappers.
- **Prisma**: Usar `prisma.model.findMany/unique/create/update/delete`.
- **Redux Toolkit**: API slices en `src/lib/redux/services/`.
- **Consultas server-side**: Usar React Query para data fetching.

## Testing

- Escribe tests unitarios para lógica de negocio.
- Mantén cobertura mayor al 80%.
- Usa Vitest (no Jest).
- Tests en archivos `*.test.ts` o `*.test.tsx` junto al código que prueban.
- Usa `@testing-library/react` para componentes.
- Implementa accessibility testing con `vitest-axe`.

## API Development

- API routes en `src/app/api/<recurso>/route.ts`.
- Usa los middlewares de autenticación: `withAuthGet`, `withAuthPost`, `withAuth`.
- Maneja errores con try-catch y devuelve NextResponse.json con código apropiado.
- Consultas a base de datos via Prisma con await y manejo de null checks.
- Params de query via `searchParams` de URL.
