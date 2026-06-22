# Exploración: Migrar uploads locales a Cloudinary

## Fecha
2026-06-22

## Estado actual

### Endpoint compartido de upload
- Archivo: `src/app/api/upload/route.ts`
- Comportamiento actual:
  1. Lee `file` del `FormData`.
  2. Guarda el archivo en `public/uploads/<timestamp>_<random><ext>`.
  3. Retorna la URL relativa `/uploads/<filename>`.

### Consumidores de `/api/upload`

| Componente/Página | Uso | Modelo afectado |
|-------------------|-----|-----------------|
| `src/features/productos/components/product-photo-upload.tsx` | Foto de producto | `Producto.fotos String[]` |
| `src/components/file-upload.tsx` | Anexos de contratos | `ContratoArchivo.rutaArchivo` |
| `src/features/clientes/components/cliente-logo-upload.tsx` | Logo de cliente | probablemente campo `logo` en `Cliente` |
| `src/features/vendors/components/vendor-logo-upload.tsx` | Logo de proveedor | probablemente campo en vendor |
| `src/features/mi-empresa/components/mi-empresa-form.tsx` | Logo de empresa | `Empresa.logo` |
| `src/app/busy/perfil/page.tsx` | Foto de perfil | perfil/usuario |
| `src/app/busy/reparaciones/ordenes/[id]/page.tsx` | Fotos de reparación | `Reparacion.fotos Json` |
| `src/app/busy/reparaciones/ordenes/new/page.tsx` | Fotos de reparación | `Reparacion.fotos Json` |
| `src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx` | Comprobante de deuda | `DeudaCash.comprobante` |

### Uploads independientes del endpoint común

| Archivo | Comportamiento |
|---------|----------------|
| `src/features/contratos/api/handlers.ts` | Guarda versiones de contrato en `public/uploads/` con su propia lógica, crea `ContratoVersion` + `ContratoArchivo` |
| `src/app/api/image/route.ts` | Lee avatares desde `public/avatars/` |

### Modelos de datos con archivos

- `Producto.fotos String[]`
- `ProductoCompuesto.fotos Json`
- `Reparacion.fotos Json`
- `ContratoArchivo.rutaArchivo`
- `ContratoVersion.contenido` (metadatos del archivo)
- `DeudaCash.comprobante String?`
- `TransferenciaBancaria.rutaComprobante`
- `GastoOperativo.fileUrl`, `fileName`, `fileSize`
- Campos de logo/imagen en `Empresa`, `Cliente`, proveedores y perfil.

### Dependencias actuales
- No hay dependencias de Cloudinary ni de gestión de imágenes en `package.json`.
- `next.config.ts` no existe; no hay configuración de imágenes personalizada.

## Problemas identificados

1. **Pérdida de archivos en deploys**: En plataformas serverless como Vercel, `public/uploads/` y `public/avatars/` son efímeros. Cada deploy borra archivos subidos.
2. **Sin optimización**: No hay redimensión, conversión a WebP, ni compresión automática.
3. **Sin CDN**: Las imágenes se sirven desde el mismo servidor de la app.
4. **Sin transformaciones**: No se puede generar un thumbnail o variante sin procesar manualmente.
5. **Almacenamiento ilimitado en disco**: El directorio `public/uploads` crece sin control ni aislamiento multi-tenant.
6. **Código duplicado**: múltiples componentes repiten el mismo patrón `fetch('/api/upload')`.

## Opciones evaluadas

### A. Server-side upload con SDK de Cloudinary
- Reemplazar `POST /api/upload` para que reciba el archivo y lo suba a Cloudinary con `cloudinary.v2.uploader.upload_stream`.
- **Pros**: control total en backend, fácil de auditar, mínimos cambios en el frontend.
- **Contras**: consume recursos del servidor, latencia extra, límite de tamaño en body de request según plataforma.

### B. Client-side upload directo (unsigned)
- El frontend sube directamente a Cloudinary usando un `upload_preset` no firmado.
- **Pros**: muy simple, sin backend adicional.
- **Contras**: menos seguro (cualquiera con el preset puede subir), menos control, no permite restricciones por tenant/usuario.

### C. Client-side upload firmado (signed)
- El backend genera una firma (`signature`) y los parámetros de upload (`timestamp`, `api_key`, etc.) para Cloudinary.
- El frontend sube directamente a `https://api.cloudinary.com/v1_1/<cloud>/image/upload` con la firma.
- **Pros**: escalable, seguro (Cloudinary valida la firma), el backend controla qué se puede subir, mantiene la UX actual.
- **Contras**: requiere endpoint de firma y configuración de Cloudinary.

## Decisión

**Opción C: client-side upload firmado.**

Mantiene la UX actual, escala sin cargar el servidor, permite controlar permisos y no expone presets públicos.

## Riesgos y preguntas abiertas

1. ¿Se desea migrar archivos existentes en `public/uploads/` y `public/avatars/` o solo los nuevos?
2. ¿Se requiere naming convention por tenant (ej. `tenantId/<entidad>/<id>/<filename>`)?
3. ¿Cuál es el límite de tamaño deseado? Actualmente 2 MB para fotos de producto.
4. ¿Se desea borrar archivos anteriores de Cloudinary al reemplazarlos?
5. ¿Los backups (`src/features/backups`) deben seguir en local u otro storage, o también en Cloudinary? Se recomienda NO mover backups a Cloudinary.

## Estimación de alcance

- Cambios esperados: ~12-20 archivos, ~400-800 líneas si se migran todos los consumidores.
- **Excede el presupuesto recomendado de 400 líneas** si se hace todo junto.
- Recomendación: dividir en PRs encadenados por dominio (infraestructura → productos → logos/avatares → contratos/reparaciones/comprobantes).
