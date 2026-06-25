# Tasks: Dual-storage uploads by plan

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 520-780 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 entitlements+intent route → PR2 wrapper+Cloudinary adapter → PR3 UploadThing integration → PR4 contratos special flow+tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Entitlements + provider routing base | PR 1 | Base = feature tracker branch; deja registry, seeds e intent route listos |
| 2 | UI wrapper + Cloudinary adapter | PR 2 | Base = PR 1 branch; elimina conocimiento de provider en UI |
| 3 | UploadThing integration for Empresarial | PR 3 | Base = PR 2 branch; router, client adapter, productos/anexos |
| 4 | Contract special flows and hardening | PR 4 | Base = PR 3 branch; versiones/check-diff, metadata normalizada |

## Phase 1: Entitlements and provider routing
- [ ] 1.1 Agregar los feature keys de upload en `src/features/planes/feature-registry.ts` y reasignarlos en `prisma/seed/plans-seed.ts`.
- [ ] 1.2 **RED**: ampliar `src/lib/upload/upload-policy.test.ts` con expectativas de entitlement + provider por `uploadKey`.
- [ ] 1.3 **GREEN**: modificar `src/lib/upload/upload-policy.ts` para resolver `provider` además de reglas actuales.
- [ ] 1.4 Convertir `src/app/api/upload/sign/route.ts` a un endpoint de upload intent o crear uno nuevo que devuelva provider + metadata normalizada.

## Phase 2: Provider-agnostic client wrapper
- [ ] 2.1 Crear `src/lib/upload/upload-asset.ts` con contrato normalizado de salida.
- [ ] 2.2 Adaptar `src/lib/upload/cloudinary-upload.ts` para operar como adapter interno del wrapper.
- [ ] 2.3 Migrar componentes Cloudinary actuales (`mi-empresa`, `clientes`, `vendors`, `perfil`, `deudas-cash`) a usar `uploadAsset()` sin conocer provider.
- [ ] 2.4 Ajustar tests de cliente/mocks para validar respuesta uniforme del wrapper.

## Phase 3: UploadThing integration
- [ ] 3.1 Agregar integración UploadThing (`src/app/api/uploadthing/core.ts`, `route.ts`, `src/lib/upload/uploadthing-client.ts`).
- [ ] 3.2 Crear middleware/auth/input metadata para UploadThing alineado al contexto tenant actual.
- [ ] 3.3 Conectar `productos.photo` y `contratos.attachment` al adapter UploadThing vía `uploadAsset()`.
- [ ] 3.4 Escribir tests de intent route + UploadThing adapter para rutas Empresarial.

## Phase 4: Contract special flows
- [ ] 4.1 **RED**: tests para `createContratoVersionHandler` y `checkContratoVersionDiffHandler` cubriendo entitlement/provider routing.
- [ ] 4.2 **GREEN**: reutilizar `resolveUploadPolicy()` en `src/features/contratos/api/handlers.ts` para versiones de contrato server-side.
- [ ] 4.3 Normalizar metadata persistida de contratos para que el provider remoto no quede implícito.
- [ ] 4.4 Validar que anexos y versiones de contrato no rompan el comportamiento actual de negocio ni el linking a Cloudinary/UploadThing.

## Phase 5: Rollout and verification
- [ ] 5.1 Crear o documentar backfill de `Plan.features` existentes con nuevos upload keys.
- [ ] 5.2 Ejecutar tests focalizados sobre uploads, contratos, planes y route handlers.
- [ ] 5.3 Verificar manualmente la matriz final: Básico/Profesional -> Cloudinary; Empresarial -> UploadThing; backups -> local/admin.
- [ ] 5.4 Registrar follow-up para el caso `deudas-cash` Profesional si el módulo padre no se mueve de plan.
