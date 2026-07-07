# FinanceMDM — Sistema de Gestión Financiera e Inventario

> Plataforma integral para PYME cubanas. Stack: Next.js 16 + TypeScript + Prisma 6 + PostgreSQL en Railway.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | Next.js 16.2, React 19, TypeScript, Tailwind CSS, shadcn/ui, Radix UI |
| **Backend** | Server Actions con `withAction` wrapper, Prisma ORM |
| **Base de datos** | PostgreSQL (Railway) |
| **Auth** | JWT + httpOnly cookies + bcryptjs |
| **Testing** | Vitest + Testing Library |
| **Deploy** | Railway (proyecto `serene-surprise`, servicio `FinanceMDM`) |
| **Gestor de paquetes** | pnpm |

> **Nota:** El proyecto usa Server Actions como capa de estado del servidor . Autenticación via JWT + httpOnly cookies. Deploy en Railway.

## Estructura del Proyecto

```
TCP/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── busy/              # Rutas autenticadas (dashboard, ventas, etc.)
│   │   └── admin/             # Panel de administración
│   ├── features/              # Módulos funcionales (categorias, productos, ventas...)
│   ├── components/ui/         # Componentes base shadcn/ui
│   ├── lib/                   # Prisma client, server-actions, utilidades
│   ├── contexts/              # Contextos de React (auth, etc.)
│   ├── hooks/                 # Custom hooks
│   └── generated/prisma/      # Prisma Client generado
├── prisma/
│   ├── schema.prisma          # ~80 modelos, ~40 enums
│   ├── migrations/            # Migraciones SQL
│   └── seed/                  # Seeds (implementation + demo/)
├── docs/                      # Documentación
└── scripts/                   # Scripts auxiliares (deactivate-expired-demos.ts)
```

## Comandos Principales

| Comando | Propósito |
|---------|-----------|
| `pnpm run dev` | Servidor de desarrollo con Turbopack |
| `pnpm run build` | Build de producción |
| `pnpm run start` | Servidor de producción |
| `pnpm test` | Tests en modo watch |
| `pnpm run test:run` | Tests una vez |
| `pnpm run lint` | ESLint |

## Navegacion de Documentacion

- [Indice general de documentacion](./index.md)
- [Mapa de modulos del sistema](./modules/INDEX.md)

El indice de modulos agrupa la documentacion funcional por dominio de negocio y sirve como puerta de entrada rapida para `docs/modules/`.

## Enlaces

- **Sitio en vivo:** https://kr4t3rdev.xyz
- **Repositorio:** github.com/kr4t3rdev/Inventario
- **Railway:** proyecto `serene-surprise`, servicio `FinanceMDM`
- **Rama de deploy:** `codex/upgrade-next-16`
