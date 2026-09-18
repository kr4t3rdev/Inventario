# Dual-storage upload rollout

## Goal

Apply the final upload matrix:

- **Básico** → company logo only, stored in **Cloudinary**
- **Profesional** → customer logos, vendor logos, profile avatar, cash-debt receipts, stored in **Cloudinary**
- **Empresarial** → product photos, contract attachments, contract versions, stored in **UploadThing**
- **Backups** → local/admin only, never Cloudinary nor UploadThing

## Backfill existing plans

For databases that already have seeded plans, run:

```bash
pnpm tsx prisma/seed/backfill-upload-features.ts
```

This updates only the `upload-*` feature flags for the known plans:

- `Básico`
- `Profesional`
- `Empresarial`

It preserves all non-upload feature keys already present in `Plan.features`.

## Manual verification checklist

### Básico

- `miEmpresa.logo` succeeds
- `clientes.logo` is forbidden
- `vendors.logo` is forbidden
- `profile.avatar` is forbidden
- `deudasCash.receipt` is forbidden
- `productos.photo` is forbidden
- `contratos.attachment` is forbidden
- `contratos.version` is forbidden

### Profesional

- `miEmpresa.logo` succeeds through Cloudinary
- `clientes.logo` succeeds through Cloudinary
- `vendors.logo` succeeds through Cloudinary
- `profile.avatar` succeeds through Cloudinary
- `deudasCash.receipt` succeeds through Cloudinary
- `productos.photo` is forbidden
- `contratos.attachment` is forbidden
- `contratos.version` is forbidden

### Empresarial

- `productos.photo` succeeds through UploadThing
- `contratos.attachment` succeeds through UploadThing
- `contratos.version` succeeds through UploadThing
- contract version diff works using persisted `fileHash`

### Admin/backups

- backup import/export remains local/admin
- no backup flow depends on Cloudinary or UploadThing

## Known follow-up

- `deudas-cash` upload entitlement is already gated at upload-policy level for Profesional, but the parent accounting module plan segmentation should still be reviewed to ensure the UX matches the intended commercial offer.
