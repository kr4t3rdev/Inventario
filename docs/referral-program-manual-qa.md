# Referral Program — Manual QA Checklist

## Pre-requisitos

1. Aplicar migración `prisma/migrations/20260703160000_add_affiliate_program/migration.sql`
2. Ejecutar seeds:
   - `pnpm seed:plans`
   - `pnpm seed:referral-perks`
3. Tener:
   - un tenant activo referidor
   - un tenant activo referido
   - un usuario admin

## Verificación automática contra Railway

El test de integración real quedó desactivado por defecto para no volver flaky el suite normal.

Ejecutarlo solo cuando exista conectividad estable con la BD remota:

```bash
export DATABASE_URL='postgresql://...'
export DIRECT_URL="$DATABASE_URL"
pnpm test:affiliate:railway
```

Notas:
- requiere `RUN_AFFILIATE_RAILWAY_TEST=1`, ya incluido en el script
- usa timeouts altos porque la BD remota puede responder lento
- si Railway/proxy está inestable, el test puede fallar por red aunque la lógica esté bien

## Caso 1 — Generación de código

1. Entrar como tenant activo
2. Abrir `/busy/referidos`
3. Verificar:
   - aparece código `REF-*`
   - aparece link de referido
   - no falla la carga del dashboard

## Caso 2 — Registro de referido

1. Entrar como tenant distinto
2. Registrar código de referido
3. Verificar en DB / admin:
   - se crea `AffiliateReferral`
   - estado inicial `registered`
   - `referredTenantId` es único

## Caso 3 — Confirmación manual del pago

1. Entrar como admin
2. Abrir `/admin/referidos`
3. Confirmar pago del referido
4. Verificar:
   - `AffiliateReferral.status = credited`
   - `firstConfirmedLicenseId` queda asociado
   - se crea `AffiliateCommissionLedger`
   - `AffiliateCreditBalance.availableCredit` aumenta

## Caso 4 — Cálculo de descuento

1. Desde `/admin/referidos`, ejecutar preview del tenant referidor
2. Verificar en `TenantLicense`:
   - `listPriceUsd`
   - `creditAppliedUsd`
   - `finalPriceUsd`
   - `creditSnapshotUsd`
3. Validar regla:
   - `finalPriceUsd = max(listPriceUsd - availableCredit, 0)`

## Caso 5 — Carry-over

1. Forzar crédito mayor que el precio del plan
2. Ejecutar preview
3. Verificar:
   - `finalPriceUsd = 0`
   - el remanente sigue disponible para ciclo futuro

## Caso 6 — Perks acumulativos

1. Confirmar suficientes ventas para cruzar tiers
2. Verificar:
   - tier-1 crea 1 slot
   - tier-2 agrega 2 slots
   - tier-3 agrega 3 slots
3. Validar total acumulado esperado: 6 slots al llegar a 51+

## Caso 7 — Asignación manual de perk

1. En `/admin/referidos`, cargar key válida `referral-*`
2. Asignar perk
3. Verificar:
   - `AffiliatePerkGrant.status = assigned`
   - `assignedFeatureKey` seteado
   - `TenantLicense.featureOverrides[featureKey] = true`

## Caso 8 — Reglas de seguridad

1. Intentar self-referral
2. Intentar confirmar dos veces la misma licencia
3. Intentar usar licencia demo
4. Verificar que todos fallen con error funcional

## Caso 9 — Precios actualizados

1. Revisar planes en admin o DB
2. Verificar:
   - Básico = 35
   - Profesional = 75
   - Empresarial = 105
