# Cloudinary Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Endurecer el sistema de uploads para que Cloudinary quede listo para producción con políticas server-side, validación tenant-aware, persistencia de metadatos y cleanup seguro.

**Architecture:** El servidor pasa a ser la única fuente de verdad para políticas de upload: carpeta permitida, tipo de recurso, MIME, tamaño máximo y naming de `public_id`. El cliente deja de decidir reglas de seguridad y solo consume una API firmada tipada. Para lifecycle, se persiste metadata de Cloudinary por asset para validar referencias, permitir reemplazos seguros y habilitar cleanup remoto.

**Tech Stack:** Next.js 16 route handlers + Server Actions, TypeScript, Prisma, PostgreSQL, Vitest, Cloudinary SDK v2.

---

## File Structure / Responsibility Map

### New files
- `src/lib/upload/upload-policy.ts` — Catálogo central de políticas de upload por caso de uso (`productos`, `clientes/logo`, `contratos/anexos`, etc.).
- `src/lib/upload/upload-policy.test.ts` — Unit tests de resolución de políticas, validaciones y naming.
- `src/lib/upload/cloudinary-asset.ts` — Tipos compartidos del asset subido y helpers de validación/parseo de URLs Cloudinary.
- `src/lib/upload/cloudinary-admin.ts` — Helper server-side para `destroy`, validación de dominio Cloudinary y extracción segura de `public_id`.
- `src/lib/upload/cloudinary-admin.test.ts` — Tests del helper de admin/cleanup.
- `prisma/migrations/<timestamp>_cloudinary_asset_metadata/migration.sql` — Migración Prisma para metadata de Cloudinary.
- `src/features/contratos/api/contrato-archivo-schema.ts` — Zod schemas para creación/validación de archivos de contrato.
- `src/features/contratos/api/contrato-archivo-schema.test.ts` — Tests de validación de payload/URL para contratos.

### Modified files
- `src/app/api/upload/sign/route.ts` — Aplicar policy engine, permisos, validación de tamaño/MIME, generación server-side de `public_id`.
- `src/app/api/upload/sign/route.test.ts` — Cubrir casos de autorización, MIME, tamaño, folder no permitido y `public_id` server-generated.
- `src/lib/cloudinary.ts` — Firmar parámetros completos (`folder`, `public_id`, `resource_type`, `context` si aplica) desde datos ya normalizados.
- `src/lib/cloudinary.test.ts` — Ajustar tests al contrato nuevo.
- `src/lib/upload/cloudinary-upload.ts` — Devolver metadata completa del upload; mantener wrapper temporal para URL-only si hace falta.
- `src/lib/upload/cloudinary-upload.test.ts` — Cubrir nuevo contrato de respuesta y propagación de policy inputs.
- `src/components/file-upload.tsx` — Consumir metadata nueva; remover comentarios/código stale.
- `src/features/productos/components/product-photo-upload.tsx` — Consumir helper nuevo y policy key en lugar de folder libre.
- `src/features/clientes/components/cliente-logo-upload.tsx` — Igual que arriba.
- `src/features/vendors/components/vendor-logo-upload.tsx` — Igual que arriba.
- `src/features/mi-empresa/components/mi-empresa-form.tsx` — Validación cliente consistente + consumo del contrato nuevo.
- `src/app/busy/perfil/page.tsx` — Validación cliente consistente + consumo del contrato nuevo.
- `src/app/busy/reparaciones/ordenes/new/page.tsx` — Validación cliente consistente + consumo del contrato nuevo.
- `src/app/busy/reparaciones/ordenes/[id]/page.tsx` — Validación cliente consistente + consumo del contrato nuevo.
- `src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx` — Persistir metadata suficiente para comprobantes.
- `src/features/contratos/api/handlers.ts` — Validar `rutaArchivo`, persistir metadata Cloudinary y cleanup en reemplazos/borrados.
- `src/app/api/contratos/[id]/archivos/route.ts` — Mantiene wiring, pero queda cubierto por handler endurecido.
- `src/app/api/contratos/[id]/versiones/route.ts` — Mantiene wiring, pero queda cubierto por handler endurecido.
- `src/features/clientes/actions.ts` — Incluir `logoUrl` en create/update y persistir metadata asociada si se modela a nivel entidad.
- `src/features/vendors/actions.ts` — Persistir metadata y soportar cleanup en reemplazo de logo.
- `src/features/profile/actions.ts` — Persistir metadata y soportar cleanup en reemplazo de avatar.
- `src/features/mi-empresa/services/mi-empresa-service.ts` — Persistir metadata y soportar cleanup en reemplazo de logo.
- `prisma/schema.prisma` — Nuevos campos/modelos para metadata Cloudinary.
- `.env.example` — Documentar variables opcionales/políticas operativas si se agregan.
- `src/__tests__/api-endpoints.live.test.ts` — Eliminar referencia stale a `/api/upload`.

### Data model strategy
Usar una tabla nueva `CloudinaryAsset` para no contaminar media docena de modelos con campos repetidos y para soportar assets únicos y múltiples:
- `assetId` (cuid)
- `tenantId`
- `ownerType` (`producto`, `cliente`, `vendor`, `miEmpresa`, `user`, `reparacion`, `contratoArchivo`, `deudaCash`)
- `ownerId`
- `slot` (`logo`, `avatar`, `photo`, `attachment`, `receipt`, etc.)
- `position` (nullable, para arrays)
- `resourceType`
- `publicId`
- `secureUrl`
- `bytes`
- `mimeType`
- `originalFilename`
- `status` (`active`, `replaced`, `deleted`)
- `createdAt`, `updatedAt`, `deletedAt`

Esto permite cleanup real incluso para arrays (`Producto.fotos`, `OrdenReparacion.fotos`) sin romper el modelo actual el primer día.

---

### Task 1: Centralizar políticas de upload y blindar el endpoint de firma

**Files:**
- Create: `src/lib/upload/upload-policy.ts`
- Test: `src/lib/upload/upload-policy.test.ts`
- Modify: `src/app/api/upload/sign/route.ts`
- Modify: `src/app/api/upload/sign/route.test.ts`
- Modify: `src/lib/cloudinary.ts`
- Modify: `src/lib/cloudinary.test.ts`

- [ ] **Step 1: Write failing policy tests**

```ts
import { describe, expect, it } from 'vitest';
import { resolveUploadPolicy } from './upload-policy';

describe('resolveUploadPolicy', () => {
  it('allows product photo uploads for productos feature', () => {
    const policy = resolveUploadPolicy({
      uploadKey: 'productos.photo',
      user: {
        userId: 'u1',
        tenantId: 'tenant-1',
        role: 'admin',
        isActive: true,
        name: 'Test',
        email: 'test@example.com',
        planFeatures: { productos: true },
      },
      input: {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        bytes: 512_000,
      },
    });

    expect(policy.folder).toBe('tenant-1/productos');
    expect(policy.resourceType).toBe('image');
    expect(policy.maxBytes).toBe(2 * 1024 * 1024);
  });

  it('rejects unauthorized contract attachment uploads', () => {
    expect(() =>
      resolveUploadPolicy({
        uploadKey: 'contratos.attachment',
        user: {
          userId: 'u2',
          tenantId: 'tenant-1',
          role: 'regularUser',
          isActive: true,
          name: 'Test',
          email: 'test@example.com',
          planFeatures: { contratos: false },
        },
        input: {
          filename: 'contract.pdf',
          mimeType: 'application/pdf',
          bytes: 50_000,
        },
      })
    ).toThrow(/permission|feature|authorized/i);
  });
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:
```bash
CI=1 pnpm vitest run src/lib/upload/upload-policy.test.ts src/app/api/upload/sign/route.test.ts src/lib/cloudinary.test.ts
```

Expected: FAIL because `resolveUploadPolicy` does not exist and the sign route still accepts raw `folder`/`publicId` inputs.

- [ ] **Step 3: Implement the policy catalog and route contract**

```ts
// src/lib/upload/upload-policy.ts
export type UploadKey =
  | 'productos.photo'
  | 'clientes.logo'
  | 'vendors.logo'
  | 'miEmpresa.logo'
  | 'profile.avatar'
  | 'reparaciones.equipo-photo'
  | 'reparaciones.orden-photo'
  | 'contratos.attachment'
  | 'contratos.version'
  | 'deudasCash.receipt';

export interface UploadIntentInput {
  filename: string;
  mimeType: string;
  bytes: number;
  entityId?: string;
}

export interface ResolvedUploadPolicy {
  uploadKey: UploadKey;
  folder: string;
  resourceType: 'image' | 'raw';
  maxBytes: number;
  allowedMimeTypes: string[];
  publicId: string;
}
```

```ts
// src/app/api/upload/sign/route.ts
const body = uploadIntentSchema.parse(await request.json());
const policy = resolveUploadPolicy({
  uploadKey: body.uploadKey,
  user,
  input: {
    filename: body.filename,
    mimeType: body.mimeType,
    bytes: body.bytes,
    entityId: body.entityId,
  },
});

const signature = generateUploadSignature(policy);
return NextResponse.json(signature);
```

```ts
// src/lib/cloudinary.ts
export function generateUploadSignature(policy: ResolvedUploadPolicy): UploadSignature {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder: policy.folder,
    public_id: policy.publicId,
  };
  // sign and return normalized payload
}
```

- [ ] **Step 4: Expand route tests for the new contract**

```ts
it('returns 400 when bytes exceed policy max', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(mockUserWithProductosFeature);

  const request = createRequest({
    uploadKey: 'productos.photo',
    filename: 'big.jpg',
    mimeType: 'image/jpeg',
    bytes: 10 * 1024 * 1024,
  });

  const response = await POST(request as any);
  expect(response.status).toBe(400);
});
```

- [ ] **Step 5: Run focused tests and verify pass**

Run:
```bash
CI=1 pnpm vitest run src/lib/upload/upload-policy.test.ts src/app/api/upload/sign/route.test.ts src/lib/cloudinary.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/upload/upload-policy.ts src/lib/upload/upload-policy.test.ts src/app/api/upload/sign/route.ts src/app/api/upload/sign/route.test.ts src/lib/cloudinary.ts src/lib/cloudinary.test.ts
git commit -m "feat: harden cloudinary signing with upload policies"
```

---

### Task 2: Tipar el resultado del upload y eliminar el contrato URL-only

**Files:**
- Create: `src/lib/upload/cloudinary-asset.ts`
- Modify: `src/lib/upload/cloudinary-upload.ts`
- Modify: `src/lib/upload/cloudinary-upload.test.ts`
- Modify: `src/features/productos/components/product-photo-upload.tsx`
- Modify: `src/features/clientes/components/cliente-logo-upload.tsx`
- Modify: `src/features/vendors/components/vendor-logo-upload.tsx`
- Modify: `src/features/mi-empresa/components/mi-empresa-form.tsx`
- Modify: `src/app/busy/perfil/page.tsx`
- Modify: `src/app/busy/reparaciones/ordenes/new/page.tsx`
- Modify: `src/app/busy/reparaciones/ordenes/[id]/page.tsx`
- Modify: `src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx`
- Modify: `src/components/file-upload.tsx`

- [ ] **Step 1: Write failing helper tests for metadata result**

```ts
import { describe, expect, it, vi } from 'vitest';
import { uploadToCloudinary } from './cloudinary-upload';

it('returns secureUrl and publicId', async () => {
  const file = new File(['a'], 'avatar.png', { type: 'image/png' });

  vi.spyOn(global, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify({
      signature: 'sig',
      timestamp: 123,
      apiKey: 'key',
      cloudName: 'cloud',
      folder: 'tenant-1/profile/avatar',
      publicId: 'tenant-1/profile/avatar/u1-123',
      uploadKey: 'profile.avatar',
      resourceType: 'image',
    })))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/avatar.png',
      public_id: 'tenant-1/profile/avatar/u1-123',
      bytes: 1,
      resource_type: 'image',
      original_filename: 'avatar',
    })));

  const result = await uploadToCloudinary(file, {
    uploadKey: 'profile.avatar',
    entityId: 'u1',
  });

  expect(result.publicId).toBe('tenant-1/profile/avatar/u1-123');
  expect(result.secureUrl).toContain('res.cloudinary.com');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:
```bash
CI=1 pnpm vitest run src/lib/upload/cloudinary-upload.test.ts src/features/productos/components/product-photo-upload.test.tsx
```

Expected: FAIL because the helper currently returns `Promise<string>` only.

- [ ] **Step 3: Introduce a typed asset result and a temporary compatibility wrapper**

```ts
// src/lib/upload/cloudinary-asset.ts
export interface CloudinaryAssetUploadResult {
  uploadKey: string;
  secureUrl: string;
  publicId: string;
  resourceType: 'image' | 'raw';
  bytes: number;
  mimeType: string;
  originalFilename: string;
}
```

```ts
// src/lib/upload/cloudinary-upload.ts
export async function uploadToCloudinary(
  file: File,
  input: { uploadKey: UploadKey; entityId?: string; onProgress?: (progress: number) => void }
): Promise<CloudinaryAssetUploadResult> {
  // request signature with uploadKey/filename/mimeType/bytes/entityId
  // upload to Cloudinary
  // return typed metadata
}

export async function uploadToCloudinaryUrl(...args: Parameters<typeof uploadToCloudinary>): Promise<string> {
  const result = await uploadToCloudinary(...args);
  return result.secureUrl;
}
```

- [ ] **Step 4: Migrate all current UI callers to the typed result**

```ts
const asset = await uploadToCloudinary(file, {
  uploadKey: 'clientes.logo',
  entityId: clienteId,
});
onChange(asset.secureUrl);
```

```ts
const asset = await uploadToCloudinary(file, {
  uploadKey: 'contratos.attachment',
  entityId: contratoId,
});
body: JSON.stringify({
  tipo: 'ANEXO',
  rutaArchivo: asset.secureUrl,
  cloudinaryPublicId: asset.publicId,
  mimeType: asset.mimeType,
  bytes: asset.bytes,
  nombreArchivo: file.name,
})
```

- [ ] **Step 5: Run focused tests and lint-level checks**

Run:
```bash
CI=1 pnpm vitest run src/lib/upload/cloudinary-upload.test.ts src/features/productos/components/product-photo-upload.test.tsx
pnpm exec eslint src/lib/upload/cloudinary-upload.ts src/components/file-upload.tsx src/features/productos/components/product-photo-upload.tsx src/features/clientes/components/cliente-logo-upload.tsx src/features/vendors/components/vendor-logo-upload.tsx src/features/mi-empresa/components/mi-empresa-form.tsx src/app/busy/perfil/page.tsx src/app/busy/reparaciones/ordenes/new/page.tsx 'src/app/busy/reparaciones/ordenes/[id]/page.tsx' src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/upload/cloudinary-asset.ts src/lib/upload/cloudinary-upload.ts src/lib/upload/cloudinary-upload.test.ts src/components/file-upload.tsx src/features/productos/components/product-photo-upload.tsx src/features/clientes/components/cliente-logo-upload.tsx src/features/vendors/components/vendor-logo-upload.tsx src/features/mi-empresa/components/mi-empresa-form.tsx src/app/busy/perfil/page.tsx src/app/busy/reparaciones/ordenes/new/page.tsx 'src/app/busy/reparaciones/ordenes/[id]/page.tsx' src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx
git commit -m "refactor: return typed cloudinary asset metadata"
```

---

### Task 3: Persistir metadata Cloudinary con un modelo dedicado

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_cloudinary_asset_metadata/migration.sql`
- Create: `src/lib/upload/cloudinary-admin.ts`
- Create: `src/lib/upload/cloudinary-admin.test.ts`
- Modify: `src/features/clientes/actions.ts`
- Modify: `src/features/vendors/actions.ts`
- Modify: `src/features/profile/actions.ts`
- Modify: `src/features/mi-empresa/services/mi-empresa-service.ts`
- Modify: `src/features/contratos/api/handlers.ts`
- Modify: `src/features/contabilidad/actions-deudas-cash.ts` (if input typing needs metadata fields)

- [ ] **Step 1: Add a failing repository/service test around metadata persistence**

```ts
it('marks previous logo asset as replaced when vendor logo changes', async () => {
  const previous = await prisma.cloudinaryAsset.create({
    data: {
      tenantId: 'tenant-1',
      ownerType: 'vendor',
      ownerId: 'vendor-1',
      slot: 'logo',
      publicId: 'tenant-1/vendors/logo/old',
      secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/old.png',
      resourceType: 'image',
      status: 'active',
    },
  });

  await replaceOwnerAsset({
    tenantId: 'tenant-1',
    ownerType: 'vendor',
    ownerId: 'vendor-1',
    slot: 'logo',
    asset: nextAsset,
  });

  const rows = await prisma.cloudinaryAsset.findMany({ where: { ownerId: 'vendor-1' } });
  expect(rows.find((row) => row.assetId === previous.assetId)?.status).toBe('replaced');
});
```

- [ ] **Step 2: Run test and Prisma validation to verify failure**

Run:
```bash
pnpm prisma validate
CI=1 pnpm vitest run src/lib/upload/cloudinary-admin.test.ts
```

Expected: FAIL because `CloudinaryAsset` model and replacement helper do not exist.

- [ ] **Step 3: Add Prisma model and helper functions**

```prisma
model CloudinaryAsset {
  assetId           String   @id @default(cuid())
  tenantId          String
  ownerType         String
  ownerId           String
  slot              String
  position          Int?
  resourceType      String
  publicId          String   @unique
  secureUrl         String
  bytes             Int?
  mimeType          String?
  originalFilename  String?
  status            String   @default("active")
  deletedAt         DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([tenantId, ownerType, ownerId, slot])
}
```

```ts
// src/lib/upload/cloudinary-admin.ts
export async function replaceOwnerAsset(input: ReplaceOwnerAssetInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.cloudinaryAsset.updateMany({
      where: {
        tenantId: input.tenantId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        slot: input.slot,
        status: 'active',
      },
      data: { status: 'replaced' },
    });

    await tx.cloudinaryAsset.create({ data: { ...input.asset, ...ownerFields } });
  });
}
```

- [ ] **Step 4: Wire persistence into entity actions**

```ts
// src/features/profile/actions.ts
const profile = await prisma.user.update({ ... });
if (parsed.avatarAsset) {
  await replaceOwnerAsset({
    tenantId: user.tenantId!,
    ownerType: 'user',
    ownerId: user.userId,
    slot: 'avatar',
    asset: parsed.avatarAsset,
  });
}
```

```ts
// src/features/clientes/actions.ts
logoUrl: parsed.logoUrl ?? null,
```

Also include the missing `logoUrl` persistence bug in client create/update while touching this code.

- [ ] **Step 5: Run migration + focused tests**

Run:
```bash
pnpm prisma validate
pnpm prisma generate
CI=1 pnpm vitest run src/lib/upload/cloudinary-admin.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/upload/cloudinary-admin.ts src/lib/upload/cloudinary-admin.test.ts src/features/clientes/actions.ts src/features/vendors/actions.ts src/features/profile/actions.ts src/features/mi-empresa/services/mi-empresa-service.ts src/features/contratos/api/handlers.ts src/features/contabilidad/actions-deudas-cash.ts
git commit -m "feat: persist cloudinary asset metadata"
```

---

### Task 4: Endurecer contratos y bloquear URLs arbitrarias

**Files:**
- Create: `src/features/contratos/api/contrato-archivo-schema.ts`
- Create: `src/features/contratos/api/contrato-archivo-schema.test.ts`
- Modify: `src/features/contratos/api/handlers.ts`
- Modify: `src/components/file-upload.tsx`
- Modify: `src/app/api/contratos/[id]/archivos/route.ts`
- Modify: `src/app/api/contratos/[id]/versiones/route.ts`

- [ ] **Step 1: Write failing tests for URL allowlist and tenant ownership**

```ts
it('rejects non-cloudinary URLs for contrato attachments', async () => {
  const parsed = contratoArchivoCreateSchema.safeParse({
    tipo: 'ANEXO',
    rutaArchivo: 'https://evil.example.com/file.pdf',
    nombreArchivo: 'file.pdf',
    cloudinaryPublicId: 'tenant-1/contratos/anexos/file',
    mimeType: 'application/pdf',
    bytes: 2048,
  });

  expect(parsed.success).toBe(false);
});
```

```ts
it('rejects attachment publicId outside tenant scope', async () => {
  await expect(
    assertCloudinaryAssetBelongsToTenant({
      tenantId: 'tenant-1',
      publicId: 'tenant-2/contratos/anexos/file',
      secureUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/tenant-2/contratos/anexos/file.pdf',
    })
  ).rejects.toThrow(/tenant/i);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:
```bash
CI=1 pnpm vitest run src/features/contratos/api/contrato-archivo-schema.test.ts
```

Expected: FAIL because the schema and asset validators do not exist.

- [ ] **Step 3: Implement Zod validation and handler hardening**

```ts
// src/features/contratos/api/contrato-archivo-schema.ts
export const contratoArchivoCreateSchema = z.object({
  tipo: z.string().min(1),
  rutaArchivo: z.string().url(),
  nombreArchivo: z.string().min(1),
  cloudinaryPublicId: z.string().min(1),
  mimeType: z.string().min(1),
  bytes: z.number().int().positive(),
  versionId: z.string().optional().nullable(),
});
```

```ts
// src/features/contratos/api/handlers.ts
const body = contratoArchivoCreateSchema.parse(await request.json());
assertCloudinaryAssetBelongsToTenant({
  tenantId: user.tenantId!,
  publicId: body.cloudinaryPublicId,
  secureUrl: body.rutaArchivo,
});
```

For version uploads, validate `file.type`, `file.size` and allow only `pdf`, `doc`, `docx` (or the exact business-approved set) before `upload_stream`.

- [ ] **Step 4: Run contract-focused tests**

Run:
```bash
CI=1 pnpm vitest run src/features/contratos/api/contrato-archivo-schema.test.ts src/app/api/upload/sign/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/contratos/api/contrato-archivo-schema.ts src/features/contratos/api/contrato-archivo-schema.test.ts src/features/contratos/api/handlers.ts src/components/file-upload.tsx src/app/api/contratos/[id]/archivos/route.ts src/app/api/contratos/[id]/versiones/route.ts
git commit -m "fix: validate cloudinary contract attachments"
```

---

### Task 5: Unificar validación cliente y cleanup de reemplazos/borrados

**Files:**
- Modify: `src/features/clientes/components/cliente-logo-upload.tsx`
- Modify: `src/features/vendors/components/vendor-logo-upload.tsx`
- Modify: `src/features/mi-empresa/components/mi-empresa-form.tsx`
- Modify: `src/app/busy/perfil/page.tsx`
- Modify: `src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx`
- Modify: `src/app/busy/reparaciones/ordenes/new/page.tsx`
- Modify: `src/app/busy/reparaciones/ordenes/[id]/page.tsx`
- Modify: `src/features/productos/components/product-photo-upload.tsx`
- Modify: `src/lib/upload/cloudinary-admin.ts`

- [ ] **Step 1: Write failing tests for replacement cleanup**

```ts
it('destroys replaced avatar asset after successful profile update', async () => {
  const destroySpy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' } as any);

  await cleanupReplacedAsset({
    publicId: 'tenant-1/profile/avatar/u1-old',
    resourceType: 'image',
  });

  expect(destroySpy).toHaveBeenCalledWith('tenant-1/profile/avatar/u1-old', {
    resource_type: 'image',
    invalidate: true,
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:
```bash
CI=1 pnpm vitest run src/lib/upload/cloudinary-admin.test.ts
```

Expected: FAIL because cleanup helpers are incomplete.

- [ ] **Step 3: Implement cleanup helpers and call them from replacement flows**

```ts
export async function cleanupReplacedAsset(input: { publicId: string; resourceType: 'image' | 'raw' }) {
  await cloudinary.uploader.destroy(input.publicId, {
    resource_type: input.resourceType,
    invalidate: true,
  });
}
```

```ts
// After a successful replacement transaction
for (const staleAsset of staleAssets) {
  await cleanupReplacedAsset({
    publicId: staleAsset.publicId,
    resourceType: staleAsset.resourceType as 'image' | 'raw',
  });
}
```

At the UI layer, centralize client validation constants to match server policy messages so users get fast feedback before the signed request.

- [ ] **Step 4: Run focused tests**

Run:
```bash
CI=1 pnpm vitest run src/lib/upload/cloudinary-admin.test.ts src/lib/upload/cloudinary-upload.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/upload/cloudinary-admin.ts src/lib/upload/cloudinary-admin.test.ts src/features/clientes/components/cliente-logo-upload.tsx src/features/vendors/components/vendor-logo-upload.tsx src/features/mi-empresa/components/mi-empresa-form.tsx src/app/busy/perfil/page.tsx src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx src/app/busy/reparaciones/ordenes/new/page.tsx 'src/app/busy/reparaciones/ordenes/[id]/page.tsx' src/features/productos/components/product-photo-upload.tsx
git commit -m "feat: add cloudinary asset cleanup on replacement"
```

---

### Task 6: Limpiar deuda de migración y cerrar verificación final

**Files:**
- Modify: `src/components/file-upload.tsx`
- Modify: `src/__tests__/api-endpoints.live.test.ts`
- Modify: `.env.example`
- Optional docs note: `docs/DEPLOYMENT_GUIDE.md`

- [ ] **Step 1: Write a failing regression assertion for stale endpoint references**

```ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('does not reference deprecated /api/upload endpoint', () => {
  const content = readFileSync('src/__tests__/api-endpoints.live.test.ts', 'utf8');
  expect(content).not.toContain("'/api/upload'");
});
```

- [ ] **Step 2: Run regression test and verify failure**

Run:
```bash
CI=1 pnpm vitest run src/__tests__/api-endpoints.live.test.ts
```

Expected: FAIL because the deprecated endpoint string is still present.

- [ ] **Step 3: Remove stale references and update docs**

```ts
// src/components/file-upload.tsx
// Remove unused FormData creation and comments mentioning /api/upload
```

```env
# .env.example
# Cloudinary uploads require the three credentials below.
# Optional operational note: keep upload policy keys in code, not in env.
# CLOUDINARY_CLOUD_NAME=your-cloud-name
# CLOUDINARY_API_KEY=your-api-key
# CLOUDINARY_API_SECRET=your-api-secret
```

- [ ] **Step 4: Run final targeted verification suite**

Run:
```bash
pnpm prisma validate
pnpm prisma generate
CI=1 pnpm vitest run src/lib/cloudinary.test.ts src/lib/upload/upload-policy.test.ts src/lib/upload/cloudinary-upload.test.ts src/lib/upload/cloudinary-admin.test.ts src/app/api/upload/sign/route.test.ts src/features/contratos/api/contrato-archivo-schema.test.ts src/features/productos/components/product-photo-upload.test.tsx
pnpm exec eslint src/app/api/upload/sign/route.ts src/lib/cloudinary.ts src/lib/upload/cloudinary-upload.ts src/lib/upload/upload-policy.ts src/lib/upload/cloudinary-admin.ts src/features/contratos/api/handlers.ts src/components/file-upload.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/file-upload.tsx src/__tests__/api-endpoints.live.test.ts .env.example docs/DEPLOYMENT_GUIDE.md
git commit -m "chore: finalize cloudinary production readiness"
```

---

## Self-Review

### Spec coverage
- **Policy enforcement on server** → Task 1
- **No arbitrary contract URLs** → Task 4
- **Persist `public_id` / metadata** → Task 3
- **Cleanup / replacement lifecycle** → Task 5
- **Stale migration references removed** → Task 6
- **Client consistency across upload surfaces** → Task 2 + Task 5

### Placeholder scan
- No `TODO`, `TBD`, or “handle appropriately” placeholders remain.
- All tasks include concrete files, test targets, and commands.

### Type consistency
- New client API uses `uploadKey` instead of raw folder.
- New asset contract consistently uses `secureUrl`, `publicId`, `resourceType`, `bytes`, `mimeType`, `originalFilename`.
- Persistence uses `CloudinaryAsset` as the source of truth rather than one-off ad hoc fields.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-22-cloudinary-production-readiness.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
