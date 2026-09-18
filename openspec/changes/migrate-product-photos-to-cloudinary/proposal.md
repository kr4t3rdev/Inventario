# Propuesta: Migrar uploads locales a Cloudinary (Signed Upload)

## Datos del cambio

- **Nombre**: `migrate-uploads-to-cloudinary`
- **Estado**: Propuesta
- **Fecha**: 2026-06-22

---

## 1. Intención y alcance

Migrar todo el almacenamiento de archivos/imágenes actualmente guardados en disco local (`public/uploads/`, `public/avatars/`) a Cloudinary usando uploads firmados desde el cliente.

### Incluye

- Crear una **infraestructura compartida** de upload a Cloudinary (firma, configuración, helpers).
- Reemplazar el endpoint `/api/upload` actual por un **endpoint de firma**.
- Migrar todos los consumidores actuales de `/api/upload` para que suban directamente a Cloudinary.
- Migrar el upload de versiones de contrato (`src/features/contratos/api/handlers.ts`) a Cloudinary.
- Configurar `next.config` para permitir imágenes de `res.cloudinary.com`.
- Variables de entorno `CLOUDINARY_*`.
- Instalación del SDK `cloudinary` para generar firmas.

### Consumidores a migrar

| Orden | Dominio | Archivos/componentes |
|-------|---------|---------------------|
| 1 | Infraestructura | `src/lib/cloudinary.ts`, `src/app/api/upload/sign/route.ts`, `next.config` |
| 2 | Productos | `src/features/productos/components/product-photo-upload.tsx` |
| 3 | Logos/avatares | `cliente-logo-upload.tsx`, `vendor-logo-upload.tsx`, `mi-empresa-form.tsx`, `perfil/page.tsx` |
| 4 | Reparaciones | `reparaciones/ordenes/[id]/page.tsx`, `reparaciones/ordenes/new/page.tsx` |
| 5 | Contratos | `src/components/file-upload.tsx`, `src/features/contratos/api/handlers.ts`, `new-version-dialog.tsx` |
| 6 | Contabilidad | `deuda-cash-form.tsx` |

### No incluye

- Migración masiva de archivos existentes en `public/uploads/` y `public/avatars/` a Cloudinary (cambio separado).
- Cambios de esquema en Prisma (los campos `String[]`, `String`, `Json` siguen almacenando URLs).
- Cambios en el módulo de backups (`src/features/backups`) — ese storage debe permanecer en local u otro storage apropiado para backups.
- Eliminación física del directorio `public/uploads/` (se hará después de la migración masiva).

---

## 2. Enfoque elegido: Signed Cloudinary Upload

### Flujo de datos

```
Frontend                          Backend                         Cloudinary
   │                                 │                                │
   │  1. POST /api/upload/sign       │                                │
   │     { folder, publicId? }       │                                │
   │ ──────────────────────────────> │                                │
   │                                 │ 2. Genera signature            │
   │                                 │    (api_secret + params)       │
   │  3. { signature, timestamp,     │                                │
   │      api_key, folder }          │                                │
   │ <─────────────────────────────  │                                │
   │                                 │                                │
   │  4. POST a api.cloudinary.com/  │                                │
   │     v1_1/<cloud>/image/upload   │                                │
   │     con file + signature        │                                │
   │ ───────────────────────────────────────────────────────────────> │
   │                                 │                                │
   │  5. { secure_url }              │                                │
   │ <─────────────────────────────────────────────────────────────── │
   │                                 │                                │
   │  6. Guarda secure_url en el     │                                │
   │     formulario/modelo           │                                │
```

### Ventajas

- **Seguro**: el backend controla qué parámetros se firman; Cloudinary rechaza uploads sin firma o con firma inválida.
- **Escalable**: la subida es directa del navegador a Cloudinary, no pasa por tu servidor.
- **Consistente**: un solo helper/patrón para todos los uploads.
- **Tenant-aware**: el `folder` puede incluir `tenantId` para aislamiento.

---

## 3. Archivos afectados

### Nuevos

| Archivo | Propósito |
|---------|-----------|
| `src/lib/cloudinary.ts` | Configuración del SDK, helper `generateUploadSignature` |
| `src/lib/upload/cloudinary-upload.ts` | Hook o función helper para subir desde el cliente usando la firma |
| `src/app/api/upload/sign/route.ts` | Endpoint `POST` que genera la firma |

### Modificados

| Archivo | Cambio |
|---------|--------|
| `src/app/api/upload/route.ts` | Reemplazado por `sign` route o eliminado si se cambia la ruta |
| `src/features/productos/components/product-photo-upload.tsx` | Usa helper de Cloudinary |
| `src/components/file-upload.tsx` | Usa helper de Cloudinary |
| `src/features/clientes/components/cliente-logo-upload.tsx` | Usa helper de Cloudinary |
| `src/features/vendors/components/vendor-logo-upload.tsx` | Usa helper de Cloudinary |
| `src/features/mi-empresa/components/mi-empresa-form.tsx` | Usa helper de Cloudinary |
| `src/app/busy/perfil/page.tsx` | Usa helper de Cloudinary |
| `src/app/busy/reparaciones/ordenes/[id]/page.tsx` | Usa helper de Cloudinary |
| `src/app/busy/reparaciones/ordenes/new/page.tsx` | Usa helper de Cloudinary |
| `src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx` | Usa helper de Cloudinary |
| `src/features/contratos/api/handlers.ts` | Guarda versiones en Cloudinary |
| `src/features/contratos/components/new-version-dialog.tsx` | Usa helper de Cloudinary |
| `next.config.ts` o `next.config.mjs` | Agrega `images.remotePatterns` para Cloudinary |
| `package.json` | Agrega `cloudinary` |
| `.env.local` | Agrega `CLOUDINARY_*` |

### Sin cambios

- `prisma/schema.prisma`: los campos siguen siendo strings/arrays/json de URLs.
- Server Actions de productos, clientes, contratos, etc.: reciben la URL y la persisten igual.

---

## 4. Configuración y variables de entorno

```env
# .env.local
CLOUDINARY_CLOUD_NAME=demo
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abc123def456
```

### Configuración en Next.js

```ts
// next.config.ts
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'res.cloudinary.com',
    },
  ],
}
```

---

## 5. Consideraciones de seguridad

1. **La firma se genera en el backend**, nunca se expone `api_secret` en el cliente.
2. El endpoint de firma debe requerir autenticación.
3. El `folder` debe incluir `tenantId` para aislamiento multi-tenant.
4. Restringir formatos y tamaño máximo en el upload helper ( Cloudinary no es el único gate).
5. Validar la respuesta de Cloudinary antes de persistir la URL.

---

## 6. Estrategia de migración de archivos existentes

**NO migrar archivos existentes en este cambio.**

Razones:
- Las URLs existentes en `public/uploads/` seguirán funcionando mientras los archivos estén en el último build.
- La migración masiva requiere un script standalone que lea archivos locales y los suba a Cloudinary con el folder correcto.
- Es un trabajo separado que puede hacerse después de estabilizar el nuevo flujo.

---

## 7. Plan de implementación por fases (PRs encadenados)

| Fase | PR | Contenido | Líneas estimadas |
|------|-----|-----------|-----------------|
| 1 | PR-1 | Infraestructura: `lib/cloudinary.ts`, `api/upload/sign/route.ts`, `next.config`, env vars, tests unitarios | ~150 |
| 2 | PR-2 | Migrar fotos de producto | ~100 |
| 3 | PR-3 | Migrar logos y avatares (cliente, vendor, empresa, perfil) | ~150 |
| 4 | PR-4 | Migrar fotos de reparaciones | ~100 |
| 5 | PR-5 | Migrar contratos (anexos y versiones) | ~150 |
| 6 | PR-6 | Migrar comprobantes de deudas cash | ~80 |

**Total estimado**: ~730 líneas en 6 PRs encadenados.

---

## 8. Riesgos y mitigación

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Fuga de API_SECRET en el frontend | Baja | Nunca enviar api_secret; solo signature |
| Límite de free tier excedido | Media | Monitorear créditos; free tier ~25 GB/mes |
| URLs locales rotas tras deploy | Baja | Las URLs del último build siguen sirviendo |
| Cambios masivos de componentes con regresiones | Media | Migrar por fases y testear cada PR |
| Contratos binarios grandes no soportados | Baja | Cloudinary acepta raw files también |

---

## 9. Recomendación

Proceder con **PRs encadenados por fase**, empezando por la infraestructura compartida. Esto minimiza el riesgo, mantiene los diffs revisables y permite iterar rápido.
