# Spec: Modelo de Datos — Tipos TRIMESTRAL y SEMESTRAL

## Enums

### TipoPeriodo (ampliado)

```prisma
enum TipoPeriodo {
  DIARIO
  MENSUAL
  TRIMESTRAL   // ← nuevo
  SEMESTRAL    // ← nuevo
  ANUAL
}
```

**Regla**: El orden del enum en Prisma define la granularidad. No hay semántica de orden implícita en Prisma, la jerarquía la define el código.

## Migración

Dado que es un cambio de enum en PostgreSQL, se requiere:

```bash
pnpm prisma migrate dev --name add-trimestral-semestral
```

Esto genera `ALTER TYPE "TipoPeriodo" ADD VALUE 'TRIMESTRAL'` y `ADD VALUE 'SEMESTRAL'`.

**Requisito post-migración**: `pnpm prisma generate` para regenerar los tipos TypeScript.

## Jerarquía Esperada

```
ANUAL
  └── SEMESTRAL (S1: Ene-Jun, S2: Jul-Dic)
        └── TRIMESTRAL (T1: Ene-Mar, T2: Abr-Jun, T3: Jul-Sep, T4: Oct-Dic)
              └── MENSUAL
                    └── DIARIO
```

## Códigos Generados

| Tipo | Código | Ejemplo |
|------|--------|---------|
| TRIMESTRAL | `T-{year}-T{1..4}` | `T-2026-T1` |
| SEMESTRAL | `S-{year}-S{1..2}` | `S-2026-S1` |

## Labels

| Tipo | Label | Ejemplo |
|------|-------|---------|
| TRIMESTRAL | `"T1 2026"` / `"Trimestre 1 2026"` | Primer trimestre 2026 |
| SEMESTRAL | `"S1 2026"` / `"Primer Semestre 2026"` | Primer semestre 2026 |
