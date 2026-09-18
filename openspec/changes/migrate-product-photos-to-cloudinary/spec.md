# Especificación: Migrar uploads locales a Cloudinary

## Estado
- **Fase**: Spec
- **Fecha**: 2026-06-22

---

## 1. Visión general

Migrar todos los uploads de archivos/imágenes desde almacenamiento local (`public/uploads/`, `public/avatars/`) a Cloudinary mediante uploads firmados desde el cliente, dividido en 6 fases incrementales.

---

## 2. Fase 1: Infraestructura compartida

### 2.1 Requisitos funcionales

#### 2.1.1 Endpoint de firma
- **Ruta**: `POST /api/upload/sign`
- **Autenticación**: Requiere usuario autenticado
- **Request body**:
  ```json
  {
    "folder": "string",
    "publicId": "string?",
    "resourceType": "image | raw"
  }
  ```
- **Response**:
  ```json
  {
    "signature": "string",
    "timestamp": "number",
    "apiKey": "string",
    "cloudName": "string",
    "folder": "string",
    "publicId": "string?"
  }
  ```
- **Validaciones**:
  - `folder` debe ser no vacío
  - `folder` debe incluir `tenantId` del usuario autenticado
  - `resourceType` debe ser `image` o `raw`
  - `publicId` es opcional

#### 2.1.2 Helper de servidor (`src/lib/cloudinary.ts`)
- Configuración del SDK Cloudinary con variables de entorno
- Función `generateUploadSignature(folder, publicId?, resourceType?)`:
  - Valida que `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` estén definidas
  - Genera timestamp actual
  - Calcula firma usando `api_secret` + parámetros
  - Retorna objeto con `signature`, `timestamp`, `apiKey`, `cloudName`, `folder`, `publicId`

#### 2.1.3 Helper de cliente (`src/lib/upload/cloudinary-upload.ts`)
- Función `uploadToCloudinary(file, folder, options?)`:
  - Hace `POST /api/upload/sign` para obtener firma
  - Sube archivo directamente a `https://api.cloudinary.com/v1_1/<cloudName>/<resourceType>/upload`
  - Incluye `file`, `signature`, `timestamp`, `api_key`, `folder`, `public_id`
  - Retorna `secure_url` de la respuesta
  - Maneja errores de red y de Cloudinary
- **Opciones**:
  - `resourceType`: `'image' | 'raw'` (default: `'image'`)
  - `publicId`: string opcional
  - `onProgress`: callback para progreso

#### 2.1.4 Configuración de Next.js
- Agregar `images.remotePatterns` en `next.config.ts` o `next.config.mjs`:
  ```ts
  {
    protocol: 'https',
    hostname: 'res.cloudinary.com',
  }
  ```

#### 2.1.5 Variables de entorno
- `CLOUDINARY_CLOUD_NAME`: nombre de la cuenta
- `CLOUDINARY_API_KEY`: API key
- `CLOUDINARY_API_SECRET`: API secret (solo servidor)

#### 2.1.6 Tests unitarios
- `src/lib/cloudinary.test.ts`:
  - Test de generación de firma con parámetros válidos
  - Test de validación de variables de entorno faltantes
  - Test de validación de folder vacío
- `src/lib/upload/cloudinary-upload.test.ts`:
  - Test de upload exitoso (mock de fetch)
  - Test de error de firma
  - Test de error de Cloudinary

### 2.2 Criterios de aceptación
- [ ] Endpoint `/api/upload/sign` retorna firma válida
- [ ] Endpoint rechaza requests sin autenticación
- [ ] Endpoint valida que `folder` incluya `tenantId`
- [ ] Helper de cliente sube archivo y retorna `secure_url`
- [ ] `next.config` permite imágenes de `res.cloudinary.com`
- [ ] Tests unitarios pasan
- [ ] Documentación de setup de Cloudinary en README

---

## 3. Fase 2: Fotos de producto

### 3.1 Requisitos funcionales

#### 3.1.1 Componente `ProductPhotoUpload`
- Reemplazar `fetch('/api/upload')` con `uploadToCloudinary(file, 'tenantId/productos')`
- Mantener validaciones existentes (tipo, tamaño máx 2MB)
- Mantener UI actual (drag & drop, preview, botón de eliminar)
- Guardar `secure_url` en estado `photos`

#### 3.1.2 Server Actions
- Sin cambios en `src/features/productos/actions-crud.ts`
- Sin cambios en schemas de Zod
- Sin cambios en Prisma schema

### 3.2 Criterios de aceptación
- [ ] Fotos de producto se suben a Cloudinary
- [ ] URL guardada en `Producto.fotos` es `secure_url` de Cloudinary
- [ ] UI de upload funciona igual que antes
- [ ] Fotos existentes con URLs `/uploads/` siguen mostrándose
- [ ] Tests de componente pasan

---

## 4. Fase 3: Logos y avatares

### 4.1 Requisitos funcionales

#### 4.1.1 Componentes a migrar
- `src/features/clientes/components/cliente-logo-upload.tsx`
- `src/features/vendors/components/vendor-logo-upload.tsx`
- `src/features/mi-empresa/components/mi-empresa-form.tsx`
- `src/app/busy/perfil/page.tsx`

#### 4.1.2 Cambios
- Cada componente reemplaza `fetch('/api/upload')` con `uploadToCloudinary`
- Folders:
  - Clientes: `tenantId/clientes/<clienteId>/logo`
  - Vendors: `tenantId/vendors/<vendorId>/logo`
  - Empresa: `tenantId/empresa/logo`
  - Perfil: `tenantId/usuarios/<userId>/avatar`

#### 4.1.3 Limpieza de archivos anteriores
- Al subir un nuevo logo/avatar, NO borrar el anterior de Cloudinary automáticamente
- Dejar limpieza manual o script posterior

### 4.2 Criterios de aceptación
- [ ] Todos los logos/avatares se suben a Cloudinary
- [ ] URLs guardadas en DB son `secure_url` de Cloudinary
- [ ] UI funciona igual que antes
- [ ] Logos/avatares existentes con URLs locales siguen mostrándose

---

## 5. Fase 4: Fotos de reparaciones

### 5.1 Requisitos funcionales

#### 5.1.1 Páginas a migrar
- `src/app/busy/reparaciones/ordenes/[id]/page.tsx`
- `src/app/busy/reparaciones/ordenes/new/page.tsx`

#### 5.1.2 Cambios
- Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
- Folder: `tenantId/reparaciones/<ordenId>/fotos`
- Mantener lógica de múltiples fotos

#### 5.1.3 Server Actions
- Sin cambios en acciones de reparaciones
- Sin cambios en Prisma schema (`Reparacion.fotos` sigue siendo `Json`)

### 5.2 Criterios de aceptación
- [ ] Fotos de reparaciones se suben a Cloudinary
- [ ] URLs guardadas en `Reparacion.fotos` son `secure_url` de Cloudinary
- [ ] UI de upload funciona igual que antes
- [ ] Fotos existentes con URLs locales siguen mostrándose

---

## 6. Fase 5: Contratos

### 6.1 Requisitos funcionales

#### 6.1.1 Componentes a migrar
- `src/components/file-upload.tsx` (anexos de contratos)
- `src/features/contratos/components/new-version-dialog.tsx` (versiones de contrato)

#### 6.1.2 Endpoint propio de contratos
- `src/features/contratos/api/handlers.ts` tiene lógica propia de upload de versiones
- Reemplazar `writeFile` a `public/uploads/` con `uploadToCloudinary`
- `resourceType`: `'raw'` para archivos binarios (PDF, DOCX, etc.)
- Folder: `tenantId/contratos/<contratoId>/versiones`

#### 6.1.3 Cambios en handlers
- `createContratoVersionHandler`:
  - Recibir archivo del FormData
  - Subir a Cloudinary con `uploadToCloudinary(file, folder, { resourceType: 'raw' })`
  - Guardar `secure_url` en `ContratoArchivo.rutaArchivo`
  - Mantener metadata en `ContratoVersion.contenido`

#### 6.1.4 Componente `FileUpload`
- Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
- Folder: `tenantId/contratos/<contratoId>/anexos`
- Mantener lógica de link a contrato vía `/api/contratos/[id]/archivos`

### 6.2 Criterios de aceptación
- [ ] Anexos de contratos se suben a Cloudinary
- [ ] Versiones de contrato se suben a Cloudinary
- [ ] URLs guardadas en `ContratoArchivo.rutaArchivo` son `secure_url` de Cloudinary
- [ ] Metadata de archivo (nombre, tipo, tamaño) se guarda en `ContratoVersion.contenido`
- [ ] UI de upload funciona igual que antes
- [ ] Archivos existentes con URLs locales siguen accesibles
- [ ] Descarga de archivos funciona

---

## 7. Fase 6: Comprobantes de deudas cash

### 7.1 Requisitos funcionales

#### 7.1.1 Componente a migrar
- `src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx`

#### 7.1.2 Cambios
- Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
- Folder: `tenantId/contabilidad/deudas-cash/<deudaId>/comprobantes`
- Mantener preview de imagen

#### 7.1.3 Server Actions
- Sin cambios en acciones de deudas cash
- Sin cambios en Prisma schema (`DeudaCash.comprobante` sigue siendo `String?`)

### 7.2 Criterios de aceptación
- [ ] Comprobantes se suben a Cloudinary
- [ ] URL guardada en `DeudaCash.comprobante` es `secure_url` de Cloudinary
- [ ] UI de upload funciona igual que antes
- [ ] Comprobantes existentes con URLs locales siguen mostrándose

---

## 8. Requisitos transversales

### 8.1 Seguridad
- **Nunca** exponer `CLOUDINARY_API_SECRET` en el cliente
- Endpoint de firma requiere autenticación
- Validar que `folder` incluya `tenantId` del usuario autenticado
- Validar tipos de archivo permitidos en el cliente (antes de subir)
- Validar tamaño máximo en el cliente (antes de subir)
- Cloudinary rechaza uploads sin firma válida

### 8.2 Manejo de errores
- **Cliente**:
  - Error de red al pedir firma: mostrar toast de error
  - Error de red al subir a Cloudinary: mostrar toast de error
  - Error de validación (tipo/tamaño): mostrar toast de error específico
- **Servidor**:
  - Variables de entorno faltantes: lanzar error al iniciar endpoint
  - Firma inválida: retornar 500
  - Error de autenticación: retornar 401

### 8.3 Performance
- Uploads directos a Cloudinary (no pasan por servidor)
- No bloquear UI durante upload (mostrar loading/progress)
- Timeout de 30s para uploads

### 8.4 Testing
- **Unit tests**: helpers de servidor y cliente
- **Integration tests**: endpoint de firma
- **Component tests**: cada componente migrado
- **E2E tests**: flujo completo de upload (opcional, puede hacerse después)

### 8.5 Documentación
- README: instrucciones de setup de Cloudinary
- Comentarios en código: explicar flujo de firma y upload
- Changelog: documentar migración por fase

---

## 9. Criterios de aceptación globales

- [ ] Todas las fases implementadas y funcionando
- [ ] No hay más código que escriba a `public/uploads/` o `public/avatars/`
- [ ] Endpoint `/api/upload` original eliminado o deprecado
- [ ] Todos los tests pasan
- [ ] Documentación actualizada
- [ ] URLs locales existentes siguen funcionando (no se rompen)
- [ ] Nuevo flujo de upload funciona para todos los casos de uso
- [ ] Seguridad: no hay exposición de secrets
- [ ] Performance: uploads no bloquean UI

---

## 10. Out of scope

- Migración masiva de archivos existentes de `public/uploads/` a Cloudinary
- Eliminación física de `public/uploads/` y `public/avatars/`
- Cambios en módulo de backups
- Cambios en Prisma schema
- Limpieza automática de archivos anteriores en Cloudinary
- Transformaciones de imágenes (resize, format conversion) — puede agregarse después
