# Tenant Isolation: Configuración Contable (Tipos de Pago y Cuentas Disponibles)

## Status

Approved

## Executive Summary

El modelo `TipoPago` carece de `tenantId`, lo que permite que usuarios de un tenant puedan leer, crear, modificar o eliminar tipos de pago de otros tenants. Asimismo, el servicio `AccountingConfigReadService.getAvailableAccounts()` retorna cuentas bancarias sin filtrar por tenant, y las validaciones de cuenta predeterminada no verifican pertenencia al tenant actual.

Este cambio agrega `tenantId` a `TipoPago`, migra los registros existentes hacia cada tenant (basado en relaciones existentes con `ReconciliacionVenta`/`ReconciliacionServicio`/`ReconciliacionGasto`), y aplica aislamiento en todas las operaciones CRUD, endpoints móviles, y validaciones relacionadas.

## Business Requirements

- **BR1**: Un usuario del Tenant A NO debe poder listar, crear, editar ni eliminar tipos de pago del Tenant B.
- **BR2**: Un usuario del Tenant A NO debe poder ver cuentas bancarias del Tenant B en el selector de cuentas disponibles.
- **BR3**: La validación de cuenta predeterminada en TipoPago debe verificar que la cuenta pertenezca al tenant actual.
- **BR4**: Los registros existentes de TipoPago deben migrarse correctamente al tenant que los posee.
- **BR5**: Todas las reconciliaciones (Venta/Servicio/Gasto) que referencian un TipoPago deben seguir funcionando sin cambios.

## Affected Modules

- `prisma/schema.prisma` — modelo TipoPago
- `src/features/contabilidad/actions-tipos-pago.ts` — Server Actions CRUD
- `src/features/contabilidad/services/accounting-config-read-service.ts` — Read service
- `src/app/api/mobile/v1/accounting/payment-types/route.ts` — Mobile endpoint
- `src/app/api/mobile/v1/accounting/payment-types/available-accounts/route.ts` — Mobile endpoint
- `src/features/contabilidad/__tests__/actions-tipos-pago.test.ts` — Nuevo archivo de tests
- Prisma migration — agregar tenantId + backfill

## Rollback Plan

1. Revertir el commit de migración y el commit de código.
2. Si la migración ya corrió en producción: ejecutar `ALTER TABLE TipoPago DROP COLUMN tenantId` y eliminar restricciones.
3. Los endpoints móviles pueden revertirse desplegando la versión anterior.

## Non-Goals

- No se modifica el modelo `CuentaBancaria` (ya tiene `tenantId`).
- No se agregan validaciones de plan o feature (ya se manejan en `requireFeature`).
- No se agregan endpoints nuevos ni se cambian contratos de API.
