# Spec: Códigos y Labels — Tipos TRIMESTRAL y SEMESTRAL

## `generarCodigoPeriodo()`

**Given** un tipo y fecha de inicio:

| Tipo | Fecha inicio | Código |
|------|-------------|--------|
| TRIMESTRAL | 2026-01-01 | `T-2026-T1` |
| TRIMESTRAL | 2026-04-01 | `T-2026-T2` |
| TRIMESTRAL | 2026-07-01 | `T-2026-T3` |
| TRIMESTRAL | 2026-10-01 | `T-2026-T4` |
| SEMESTRAL | 2026-01-01 | `S-2026-S1` |
| SEMESTRAL | 2026-07-01 | `S-2026-S2` |

**Implementación**:

```typescript
case TipoPeriodo.TRIMESTRAL: {
  const year = fechaInicio.getUTCFullYear();
  const trim = Math.ceil((fechaInicio.getUTCMonth() + 1) / 3);
  return `T-${year}-T${trim}`;
}
case TipoPeriodo.SEMESTRAL: {
  const year = fechaInicio.getUTCFullYear();
  const sem = fechaInicio.getUTCMonth() < 6 ? 1 : 2;
  return `S-${year}-S${sem}`;
}
```

## `generarLabelPeriodo()`

| Tipo | Fecha inicio | Label |
|------|-------------|-------|
| TRIMESTRAL | 2026-01-01 | `T1 2026` |
| TRIMESTRAL | 2026-10-01 | `T4 2026` |
| SEMESTRAL | 2026-01-01 | `S1 2026` |
| SEMESTRAL | 2026-07-01 | `S2 2026` |

**Implementación**:

```typescript
case TipoPeriodo.TRIMESTRAL: {
  const trim = Math.ceil((fechaInicio.getUTCMonth() + 1) / 3);
  return `T${trim} ${fechaInicio.getUTCFullYear()}`;
}
case TipoPeriodo.SEMESTRAL: {
  const sem = fechaInicio.getUTCMonth() < 6 ? 'S1' : 'S2';
  return `${sem} ${fechaInicio.getUTCFullYear()}`;
}
```
