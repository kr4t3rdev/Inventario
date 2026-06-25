# Proposal: Dual-storage uploads by plan

## Intent

Rediseñar la capa de uploads para soportar **dual-storage** sobre el código actual: Cloudinary para uploads de Básico/Profesional y UploadThing para uploads de Empresarial, sin acoplar componentes UI a un provider concreto. El sistema debe resolver el provider en backend a partir del `uploadKey`, el plan y la policy central.

## Scope

### In Scope
- Mantener la matriz de entitlements por plan para cada tipo de upload.
- Introducir una policy central que resuelva provider (`cloudinary` o `uploadthing`) por `uploadKey`.
- Crear un wrapper único de uploads para que la UI deje de conocer el storage.
- Adaptar contratos versión/anexos para convivir con el modelo dual-storage.
- Mantener backups fuera de esta arquitectura y en storage local/admin.

### Out of Scope
- Cambiar el storage de backups.
- Migrar assets históricos entre providers.
- Reasignar módulos padre entre planes.
- Resolver en este cambio la deuda del diff local de contratos más allá de lo necesario para que no rompa el dual-storage.

## Capabilities

### New Capabilities
- `upload-entitlements`: permisos de upload por tipo de asset y plan.
- `upload-provider-routing`: resolución central de storage provider por `uploadKey`.

### Modified Capabilities
- `administracion`: el editor de planes debe exponer los nuevos toggles de upload.

## Approach

Separar dos responsabilidades que hoy están mezcladas: **autorización** y **storage provider**. `upload-policy.ts` seguirá siendo el contrato central, pero pasará a devolver también el provider. Los componentes cliente dejarán de llamar a Cloudinary directo y usarán un wrapper `uploadAsset()` que primero consulta el intent del servidor y luego despacha a Cloudinary o UploadThing. Los flujos especiales de contratos server-side reutilizarán la misma policy semántica para evitar drift.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/upload/upload-policy.ts` | Modified | Resolver entitlement + provider |
| `src/lib/upload/*` | Modified/New | Wrapper agnóstico y adapters por provider |
| `src/app/api/upload/sign/route.ts` | Modified | Pasar de sign-only a upload intent/provider routing |
| `src/app/api/uploadthing/*` | New | Router y handlers UploadThing |
| `src/features/contratos/api/handlers.ts` | Modified | Convergencia con policy dual-storage |
| `src/features/planes/feature-registry.ts` | Modified | Feature keys de upload |
| `prisma/seed/plans-seed.ts` | Modified | Matriz de entitlements por plan |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dualidad provider rompe componentes existentes | Medium | Wrapper único + tests por provider |
| Contratos versión siga desalineado del flujo general | High | Forzar reutilización de `resolveUploadPolicy()` y registrar metadata uniforme |
| `deudas-cash` en Profesional quede dormido | Medium | Mantener doble gate y documentarlo explícitamente |

## Rollback Plan

Revertir el provider-routing central y volver al flujo Cloudinary único actual, preservando los entitlements por plan y sin tocar datos persistidos.

## Dependencies

- Cloudinary flow existente
- UploadThing App Router integration
- Registry/seeds de planes
- Handlers especiales de contratos

## Success Criteria

- [ ] La UI usa un wrapper de upload agnóstico al provider.
- [ ] El backend resuelve provider por `uploadKey` y plan.
- [ ] Profesional usa Cloudinary y Empresarial usa UploadThing según la matriz definida.
- [ ] Backups permanecen locales y fuera de dual-storage.
