# Plan: Revisión y Actualización de Documentación

> **Para Hermes:** Usar subagent-driven-development para implementar tarea por tarea con TDD estricto. Cada tarea produce un doc, se verifica contra el código real, y se commitea.

**Goal:** Poner al día la documentación del proyecto FinanceMDM.

**Architecture:** Tres etapas: (1) auditar docs vs código, (2) actualizar docs clave, (3) agregar docs de features nuevos.

---

## Diagnóstico Inicial

### docs/README.md — 🔴 MUY desactualizado
- Referencia Redux Toolkit, React Query → Server Actions
- Referencia Clerk, NextAuth → JWT + httpOnly cookies
- Referencia Vercel → Railway
- Estructura `src/components/` → `src/features/`
- Env vars: NEXTAUTH, CLERK → JWT_SECRET, RESEND_API_KEY

### docs/ARCHITECTURE.md — 🟡 Parcialmente desactualizado
- Diagrama incluye Clerk → eliminar
- No documenta Server Action pattern, demo seeding, EAN-13, cron jobs

### docs/DEPLOYMENT_GUIDE.md — 🔴 Proyecto incorrecto
- Habla de "Exchange Intelligence Dashboard", Redis, Vercel → reescribir

### docs/DATA_MODEL.md — 🟢 Mayormente OK
- Faltan `TenantLicense.isDemo` y `createdBy`

### docs/modules/categorias/README.md — 🟡 Placeholder genérico
- No documenta EAN-13, CLAS, jerarquía real

### AGENTS.md — 🟡 Faltan features nuevos
- Demo seeding, EAN-13 workflow no documentados

---

## Tareas

### Task 1: docs/README.md — Reescribir

**Verificación:** grep -c "Redux|Clerk|NextAuth|React Query|Vercel" docs/README.md = 0

Contenido reemplazar con:
- Stack real (Next.js 16, Server Actions, Prisma 6, Railway)
- Estructura real (src/features/)
- Railway deploy (rama codex/upgrade-next-16)

### Task 2: docs/ARCHITECTURE.md — Actualizar

**Verificación:** grep -c "Clerk" docs/ARCHITECTURE.md = 0

Cambios:
- Eliminar Clerk del diagrama Mermaid
- Agregar secciones: Demo Seeding, EAN-13/CLAS, Cron Jobs, Deploy Flow

### Task 3: docs/DEPLOYMENT_GUIDE.md — Reescribir para Railway

**Verificación:** grep -c "Exchange Intelligence|Redis|NEXTAUTH|Vercel" = 0

Contenido: Railway CLI, migrate deploy, push-to-deploy, health checks

### Task 4: docs/DATA_MODEL.md — Agregar isDemo + createdBy

**Verificación:** grep -c "isDemo" docs/DATA_MODEL.md > 0

Agregar en tabla TenantLicense: isDemo Boolean, createdBy String?

### Task 5: docs/modules/categorias/README.md — Documentar EAN-13/CLAS

**Verificación:** grep -c "getCategoriasAction|createCategoriaAction" > 0

Contenido: CRUD Server Actions, EAN-13/CLAS flow, demo seeding

### Task 6: AGENTS.md — Agregar features nuevos

**Verificación:** grep -c "isDemo|demo-seed|deactivateExpired" AGENTS.md > 0

Secciones: demo features, EAN-13, seed differentiation

### Task 7: docs/plans/demo-seed-docs.md — Documento de demos

Flujo completo: factory, seed, cron, auditoría, conversión a pago

### Task 8: docs/plans/ean13-flow.md — Documento EAN-13

Flujo completo: feature flags, classifier, validación, labels, generación

---

## Verificación Final

```bash
grep -c "Redux|Clerk|NextAuth|React Query|Vercel" docs/README.md   # → 0
grep -c "Clerk" docs/ARCHITECTURE.md                                # → 0
grep -c "Railway" docs/DEPLOYMENT_GUIDE.md                          # → > 0
grep -c "isDemo" docs/DATA_MODEL.md                                 # → > 0
grep -c "getCategoriasAction" docs/modules/categorias/README.md     # → > 0
grep -c "isDemo|demo-seed|deactivateExpired" AGENTS.md               # → > 0
```
