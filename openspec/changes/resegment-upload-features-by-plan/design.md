# Design: Dual-storage uploads by plan

## Technical Approach

El sistema actual ya tiene una policy de uploads y un flujo Cloudinary funcional. La migración correcta no es reemplazar todo, sino introducir una capa de **provider routing** sobre esa base. `resolveUploadPolicy()` pasa a resolver: entitlement, restricciones de archivo, folder lógico y provider. A partir de ese intent, el cliente usa un wrapper único y despacha a Cloudinary o UploadThing.

## Architecture Decisions

### Decision: Backend owns provider routing
**Choice**: `upload-policy.ts` devolverá `provider: 'cloudinary' | 'uploadthing'` además de reglas actuales.
**Alternatives considered**: decidir provider en UI; duplicar policies por provider.
**Rationale**: el provider es infraestructura, no lógica de componente. Si vive en UI, el cambio queda disperso y frágil.

### Decision: Keep a normalized upload asset contract
**Choice**: introducir un contrato común (`provider`, `url`, `bytes`, `mimeType`, `publicId?`, `key?`).
**Alternatives considered**: dejar que cada componente consuma la respuesta nativa de cada provider.
**Rationale**: desacopla UI y persistencia de las diferencias Cloudinary/UploadThing.

### Decision: Reuse current Cloudinary signed flow and add UploadThing adapter
**Choice**: mantener `cloudinary-upload.ts` para los assets Cloudinary y sumar un adapter UploadThing + router App Router.
**Alternatives considered**: migrar todo a UploadThing o todo a Cloudinary.
**Rationale**: minimiza riesgo, preserva lo que ya funciona y permite segmentación por plan.

### Decision: Contracts remain special but policy-aligned
**Choice**: `contratos.version` y anexos siguen pudiendo usar flujos especiales, pero deben consumir la misma policy semántica y devolver metadata normalizada.
**Alternatives considered**: dejar contratos fuera del dual-storage.
**Rationale**: contratos ya son una excepción; la prioridad es evitar drift de permisos/provider.

## Data Flow

`UI component` -> `uploadAsset(file, uploadKey)` -> `POST /api/upload/intent` -> `resolveUploadPolicy()`.

Si provider = `cloudinary`:
`uploadAsset` -> signed upload Cloudinary -> normalized asset.

Si provider = `uploadthing`:
`uploadAsset` -> UploadThing route/client uploader -> normalized asset.

Para contratos server-side:
`route handler` -> `resolveUploadPolicy()` -> provider SDK -> normalized asset -> DB.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/upload/upload-policy.ts` | Modify | Resolver provider + entitlement + rules |
| `src/app/api/upload/sign/route.ts` or new `intent` route | Modify | Convertir endpoint a upload-intent/provider response |
| `src/lib/upload/upload-asset.ts` | New | Wrapper agnóstico del lado cliente |
| `src/lib/upload/uploadthing-client.ts` | New | Adapter tipado UploadThing |
| `src/app/api/uploadthing/core.ts` | New | Router UploadThing |
| `src/app/api/uploadthing/route.ts` | New | Route handler UploadThing |
| `src/lib/upload/cloudinary-upload.ts` | Modify | Consumido como adapter, no entry point directo de UI |
| `src/features/contratos/api/handlers.ts` | Modify | Policy-aligned server-side uploads |
| `src/features/planes/feature-registry.ts` | Modify | Nuevos feature keys |
| `prisma/seed/plans-seed.ts` | Modify | Matriz de uploads por plan |

## Interfaces / Contracts

```ts
type UploadProvider = 'cloudinary' | 'uploadthing'

interface ResolvedUploadPolicy {
  uploadKey: UploadKey
  provider: UploadProvider
  folder: string
  resourceType: 'image' | 'raw'
  maxBytes: number
  allowedMimeTypes: string[]
  publicId?: string
  uploadthingRoute?: string
}

interface UploadedAsset {
  provider: UploadProvider
  url: string
  bytes: number
  mimeType: string
  publicId?: string
  key?: string
  originalFilename: string
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | policy/provider map | asserts por `uploadKey` y plan |
| Unit | wrapper normalization | mocks Cloudinary y UploadThing con mismo output esperado |
| Integration | upload intent route | devuelve provider correcto y bloquea sin entitlement |
| Integration | UploadThing routes | middleware/auth/input metadata |
| Integration | contratos server-side | niega sin entitlement y persiste metadata normalizada |
| UI | componentes migrados | siguen funcionando sin saber provider |

## Migration / Rollout

No migration de assets históricos. Sí requiere backfill de `Plan.features` con nuevos keys y rollout en fases: 1) registry/seeds + intent route, 2) wrapper + Cloudinary adapter, 3) UploadThing adapter + product/contracts, 4) contratos especiales + tests.

## Open Questions

- [ ] Si `deudas-cash` debe operar realmente en Profesional, habrá que mover también el módulo padre o desacoplar ese flujo.
- [ ] Si `ContratoArchivo` necesita campos persistentes nuevos para `provider/key`, eso puede escalar a cambio de esquema en un batch separado.
