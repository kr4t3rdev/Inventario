# Plan de tareas: Migrar uploads locales a Cloudinary

## Estado
- **Fase**: Tasks
- **Fecha**: 2026-06-22
- **Dependencias**: design.md

---

## Fase 1: Infraestructura compartida

### Tarea 1.1: Instalar dependencias
- **Descripción**: Instalar paquete `cloudinary` y configurar variables de entorno
- **Archivos**:
  - `package.json`
  - `.env.local`
- **Pasos**:
  1. Ejecutar `pnpm add cloudinary`
  2. Agregar variables de entorno en `.env.local`:
     ```env
     CLOUDINARY_CLOUD_NAME=your-cloud-name
     CLOUDINARY_API_KEY=your-api-key
     CLOUDINARY_API_SECRET=your-api-secret
     ```
  3. Agregar ejemplo en `.env.example`
- **Criterios de aceptación**:
  - [ ] Paquete instalado
  - [ ] Variables de entorno configuradas
  - [ ] `.env.example` actualizado
- **Estimación**: 15 min

---

### Tarea 1.2: Crear helper de servidor
- **Descripción**: Implementar `src/lib/cloudinary.ts` con función `generateUploadSignature`
- **Archivos**:
  - `src/lib/cloudinary.ts` (nuevo)
- **Pasos**:
  1. Configurar SDK de Cloudinary con variables de entorno
  2. Implementar función `generateUploadSignature(folder, publicId?, resourceType?)`
  3. Validar configuración y parámetros
  4. Generar firma usando `cloudinary.utils.api_sign_request`
  5. Retornar objeto con `signature`, `timestamp`, `apiKey`, `cloudName`, `folder`, `publicId`
- **Criterios de aceptación**:
  - [ ] Función genera firma válida
  - [ ] Valida configuración faltante
  - [ ] Valida folder vacío
  - [ ] Incluye `publicId` cuando se proporciona
- **Estimación**: 30 min

---

### Tarea 1.3: Tests del helper de servidor
- **Descripción**: Escribir tests unitarios para `src/lib/cloudinary.ts`
- **Archivos**:
  - `src/lib/cloudinary.test.ts` (nuevo)
- **Pasos**:
  1. Test de generación de firma con parámetros válidos
  2. Test de error cuando falta configuración
  3. Test de error cuando folder está vacío
  4. Test de inclusión de `publicId`
- **Criterios de aceptación**:
  - [ ] Todos los tests pasan
  - [ ] Cobertura > 80%
- **Estimación**: 30 min

---

### Tarea 1.4: Crear endpoint de firma
- **Descripción**: Implementar `POST /api/upload/sign` que genera firma para Cloudinary
- **Archivos**:
  - `src/app/api/upload/sign/route.ts` (nuevo)
- **Pasos**:
  1. Autenticar usuario con `getCurrentUser()`
  2. Parsear request body (`folder`, `publicId?`, `resourceType?`)
  3. Validar que `folder` empiece con `tenantId/`
  4. Validar `resourceType` (solo `image` o `raw`)
  5. Llamar `generateUploadSignature()`
  6. Retornar firma
- **Criterios de aceptación**:
  - [ ] Endpoint retorna firma válida
  - [ ] Rechaza requests sin autenticación (401)
  - [ ] Valida que folder incluya tenantId (400)
  - [ ] Valida resourceType (400)
- **Estimación**: 45 min

---

### Tarea 1.5: Tests del endpoint de firma
- **Descripción**: Escribir tests unitarios para `/api/upload/sign/route.ts`
- **Archivos**:
  - `src/app/api/upload/sign/route.test.ts` (nuevo)
- **Pasos**:
  1. Test de respuesta exitosa con usuario autenticado
  2. Test de 401 cuando no hay usuario
  3. Test de 400 cuando folder no incluye tenantId
  4. Test de 400 cuando resourceType es inválido
- **Criterios de aceptación**:
  - [ ] Todos los tests pasan
  - [ ] Cobertura > 80%
- **Estimación**: 30 min

---

### Tarea 1.6: Crear helper de cliente
- **Descripción**: Implementar `src/lib/upload/cloudinary-upload.ts` con función `uploadToCloudinary`
- **Archivos**:
  - `src/lib/upload/cloudinary-upload.ts` (nuevo)
- **Pasos**:
  1. Implementar función `uploadToCloudinary(file, folder, options?)`
  2. Hacer POST a `/api/upload/sign` para obtener firma
  3. Construir FormData con archivo y parámetros de firma
  4. Hacer POST a Cloudinary
  5. Retornar `secure_url`
  6. Manejar errores de red y de Cloudinary
  7. Soportar callback `onProgress`
- **Criterios de aceptación**:
  - [ ] Función sube archivo y retorna URL
  - [ ] Maneja error de firma
  - [ ] Maneja error de Cloudinary
  - [ ] Soporta callback de progreso
- **Estimación**: 45 min

---

### Tarea 1.7: Tests del helper de cliente
- **Descripción**: Escribir tests unitarios para `src/lib/upload/cloudinary-upload.ts`
- **Archivos**:
  - `src/lib/upload/cloudinary-upload.test.ts` (nuevo)
- **Pasos**:
  1. Test de upload exitoso (mock de fetch)
  2. Test de error cuando falla la firma
  3. Test de error cuando falla el upload a Cloudinary
  4. Test de callback de progreso
- **Criterios de aceptación**:
  - [ ] Todos los tests pasan
  - [ ] Cobertura > 80%
- **Estimación**: 30 min

---

### Tarea 1.8: Configurar Next.js para Cloudinary
- **Descripción**: Agregar `remotePatterns` en `next.config.ts` para permitir imágenes de Cloudinary
- **Archivos**:
  - `next.config.ts` o `next.config.mjs`
- **Pasos**:
  1. Agregar `images.remotePatterns` con `res.cloudinary.com`
  2. Verificar que la configuración es válida
- **Criterios de aceptación**:
  - [ ] Configuración agregada
  - [ ] Next.js compila sin errores
- **Estimación**: 10 min

---

### Tarea 1.9: Documentación de setup
- **Descripción**: Agregar instrucciones de configuración de Cloudinary en README
- **Archivos**:
  - `README.md`
- **Pasos**:
  1. Agregar sección de Cloudinary
  2. Explicar cómo crear cuenta
  3. Explicar cómo obtener credenciales
  4. Explicar variables de entorno necesarias
- **Criterios de aceptación**:
  - [ ] README actualizado
  - [ ] Instrucciones claras y completas
- **Estimación**: 20 min

---

### Tarea 1.10: Verificación de Fase 1
- **Descripción**: Verificar que toda la infraestructura funciona correctamente
- **Pasos**:
  1. Ejecutar todos los tests de Fase 1
  2. Verificar que endpoint responde correctamente
  3. Verificar que helper de cliente funciona
  4. Code review
- **Criterios de aceptación**:
  - [ ] Todos los tests pasan
  - [ ] Code review aprobado
  - [ ] Documentación completa
- **Estimación**: 30 min

---

## Fase 2: Fotos de producto

### Tarea 2.1: Migrar componente de upload de productos
- **Descripción**: Modificar `ProductPhotoUpload` para usar `uploadToCloudinary`
- **Archivos**:
  - `src/features/productos/components/product-photo-upload.tsx`
- **Pasos**:
  1. Importar `uploadToCloudinary` y `useTenant`
  2. Obtener `tenantId` del hook
  3. Reemplazar `fetch('/api/upload')` con `uploadToCloudinary(file, `${tenantId}/productos`)`
  4. Mantener validaciones existentes (tipo, tamaño)
  5. Mantener UI actual
- **Criterios de aceptación**:
  - [ ] Fotos se suben a Cloudinary
  - [ ] URL guardada es `secure_url` de Cloudinary
  - [ ] UI funciona igual que antes
  - [ ] Fotos existentes con URLs locales siguen mostrándose
- **Estimación**: 30 min

---

### Tarea 2.2: Tests de componente de productos
- **Descripción**: Actualizar/escribir tests para `ProductPhotoUpload`
- **Archivos**:
  - `src/features/productos/components/product-photo-upload.test.tsx` (nuevo o actualizar)
- **Pasos**:
  1. Mock de `uploadToCloudinary`
  2. Test de upload exitoso
  3. Test de error de upload
  4. Test de validaciones (tipo, tamaño)
- **Criterios de aceptación**:
  - [ ] Todos los tests pasan
  - [ ] Mock de `uploadToCloudinary` funciona
- **Estimación**: 30 min

---

### Tarea 2.3: Verificación de Fase 2
- **Descripción**: Verificar que fotos de producto funcionan correctamente
- **Pasos**:
  1. Ejecutar tests de Fase 2
  2. Testing manual en browser
  3. Verificar que URL se guarda en DB
  4. Verificar que imagen se muestra
  5. Code review
- **Criterios de aceptación**:
  - [ ] Todos los tests pasan
  - [ ] Testing manual exitoso
  - [ ] Code review aprobado
- **Estimación**: 30 min

---

## Fase 3: Logos y avatares

### Tarea 3.1: Migrar logo de cliente
- **Descripción**: Modificar `cliente-logo-upload.tsx` para usar `uploadToCloudinary`
- **Archivos**:
  - `src/features/clientes/components/cliente-logo-upload.tsx`
- **Pasos**:
  1. Importar `uploadToCloudinary` y `useTenant`
  2. Construir folder: `${tenantId}/clientes/${clienteId}/logo`
  3. Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
- **Criterios de aceptación**:
  - [ ] Logo se sube a Cloudinary
  - [ ] URL guardada es `secure_url`
  - [ ] UI funciona igual
- **Estimación**: 20 min

---

### Tarea 3.2: Migrar logo de vendor
- **Descripción**: Modificar `vendor-logo-upload.tsx` para usar `uploadToCloudinary`
- **Archivos**:
  - `src/features/vendors/components/vendor-logo-upload.tsx`
- **Pasos**:
  1. Importar `uploadToCloudinary` y `useTenant`
  2. Construir folder: `${tenantId}/vendors/${vendorId}/logo`
  3. Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
- **Criterios de aceptación**:
  - [ ] Logo se sube a Cloudinary
  - [ ] URL guardada es `secure_url`
  - [ ] UI funciona igual
- **Estimación**: 20 min

---

### Tarea 3.3: Migrar logo de empresa
- **Descripción**: Modificar `mi-empresa-form.tsx` para usar `uploadToCloudinary`
- **Archivos**:
  - `src/features/mi-empresa/components/mi-empresa-form.tsx`
- **Pasos**:
  1. Importar `uploadToCloudinary` y `useTenant`
  2. Construir folder: `${tenantId}/empresa/logo`
  3. Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
- **Criterios de aceptación**:
  - [ ] Logo se sube a Cloudinary
  - [ ] URL guardada es `secure_url`
  - [ ] UI funciona igual
- **Estimación**: 20 min

---

### Tarea 3.4: Migrar avatar de perfil
- **Descripción**: Modificar `perfil/page.tsx` para usar `uploadToCloudinary`
- **Archivos**:
  - `src/app/busy/perfil/page.tsx`
- **Pasos**:
  1. Importar `uploadToCloudinary` y `useTenant`
  2. Construir folder: `${tenantId}/usuarios/${userId}/avatar`
  3. Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
- **Criterios de aceptación**:
  - [ ] Avatar se sube a Cloudinary
  - [ ] URL guardada es `secure_url`
  - [ ] UI funciona igual
- **Estimación**: 20 min

---

### Tarea 3.5: Verificación de Fase 3
- **Descripción**: Verificar que todos los logos/avatares funcionan correctamente
- **Pasos**:
  1. Testing manual de cada componente
  2. Verificar que URLs se guardan en DB
  3. Verificar que imágenes se muestran
  4. Code review
- **Criterios de aceptación**:
  - [ ] Todos los logos/avatares se suben a Cloudinary
  - [ ] Testing manual exitoso
  - [ ] Code review aprobado
- **Estimación**: 40 min

---

## Fase 4: Fotos de reparaciones

### Tarea 4.1: Migrar página de nueva orden de reparación
- **Descripción**: Modificar `reparaciones/ordenes/new/page.tsx` para usar `uploadToCloudinary`
- **Archivos**:
  - `src/app/busy/reparaciones/ordenes/new/page.tsx`
- **Pasos**:
  1. Importar `uploadToCloudinary` y `useTenant`
  2. Construir folder: `${tenantId}/reparaciones/${ordenId}/fotos`
  3. Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
  4. Mantener lógica de múltiples fotos
- **Criterios de aceptación**:
  - [ ] Fotos se suben a Cloudinary
  - [ ] URLs guardadas son `secure_url`
  - [ ] UI funciona igual
- **Estimación**: 30 min

---

### Tarea 4.2: Migrar página de orden de reparación existente
- **Descripción**: Modificar `reparaciones/ordenes/[id]/page.tsx` para usar `uploadToCloudinary`
- **Archivos**:
  - `src/app/busy/reparaciones/ordenes/[id]/page.tsx`
- **Pasos**:
  1. Importar `uploadToCloudinary` y `useTenant`
  2. Construir folder: `${tenantId}/reparaciones/${ordenId}/fotos`
  3. Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
  4. Mantener lógica de múltiples fotos
- **Criterios de aceptación**:
  - [ ] Fotos se suben a Cloudinary
  - [ ] URLs guardadas son `secure_url`
  - [ ] UI funciona igual
- **Estimación**: 30 min

---

### Tarea 4.3: Verificación de Fase 4
- **Descripción**: Verificar que fotos de reparaciones funcionan correctamente
- **Pasos**:
  1. Testing manual de ambas páginas
  2. Verificar que URLs se guardan en DB
  3. Verificar que imágenes se muestran
  4. Code review
- **Criterios de aceptación**:
  - [ ] Todas las fotos se suben a Cloudinary
  - [ ] Testing manual exitoso
  - [ ] Code review aprobado
- **Estimación**: 30 min

---

## Fase 5: Contratos

### Tarea 5.1: Migrar componente de anexos de contratos
- **Descripción**: Modificar `file-upload.tsx` para usar `uploadToCloudinary`
- **Archivos**:
  - `src/components/file-upload.tsx`
- **Pasos**:
  1. Importar `uploadToCloudinary` y `useTenant`
  2. Construir folder: `${tenantId}/contratos/${contratoId}/anexos`
  3. Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
  4. Mantener lógica de link a contrato
- **Criterios de aceptación**:
  - [ ] Anexos se suben a Cloudinary
  - [ ] URL guardada es `secure_url`
  - [ ] Link a contrato funciona
- **Estimación**: 30 min

---

### Tarea 5.2: Migrar handler de versiones de contrato
- **Descripción**: Modificar `createContratoVersionHandler` para usar `uploadToCloudinary`
- **Archivos**:
  - `src/features/contratos/api/handlers.ts`
- **Pasos**:
  1. Importar `uploadToCloudinary` (versión servidor o adaptar)
  2. Construir folder: `${tenantId}/contratos/${contratoId}/versiones`
  3. Reemplazar `writeFile` con `uploadToCloudinary(file, folder, { resourceType: 'raw' })`
  4. Mantener metadata en `ContratoVersion.contenido`
- **Criterios de aceptación**:
  - [ ] Versiones se suben a Cloudinary
  - [ ] URL guardada es `secure_url`
  - [ ] Metadata se guarda correctamente
  - [ ] Descarga funciona
- **Estimación**: 45 min

---

### Tarea 5.3: Migrar diálogo de nueva versión
- **Descripción**: Modificar `new-version-dialog.tsx` para usar `uploadToCloudinary`
- **Archivos**:
  - `src/features/contratos/components/new-version-dialog.tsx`
- **Pasos**:
  1. Importar `uploadToCloudinary` y `useTenant`
  2. Construir folder: `${tenantId}/contratos/${contratoId}/versiones`
  3. Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
  4. Usar `resourceType: 'raw'`
- **Criterios de aceptación**:
  - [ ] Versiones se suben a Cloudinary
  - [ ] URL guardada es `secure_url`
  - [ ] UI funciona igual
- **Estimación**: 30 min

---

### Tarea 5.4: Verificación de Fase 5
- **Descripción**: Verificar que contratos funcionan correctamente
- **Pasos**:
  1. Testing manual de anexos y versiones
  2. Verificar que URLs se guardan en DB
  3. Verificar que archivos se descargan
  4. Code review
- **Criterios de aceptación**:
  - [ ] Todos los archivos se suben a Cloudinary
  - [ ] Testing manual exitoso
  - [ ] Code review aprobado
- **Estimación**: 40 min

---

## Fase 6: Comprobantes de deudas cash

### Tarea 6.1: Migrar formulario de deudas cash
- **Descripción**: Modificar `deuda-cash-form.tsx` para usar `uploadToCloudinary`
- **Archivos**:
  - `src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx`
- **Pasos**:
  1. Importar `uploadToCloudinary` y `useTenant`
  2. Construir folder: `${tenantId}/contabilidad/deudas-cash/${deudaId}/comprobantes`
  3. Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
  4. Mantener preview de imagen
- **Criterios de aceptación**:
  - [ ] Comprobantes se suben a Cloudinary
  - [ ] URL guardada es `secure_url`
  - [ ] UI funciona igual
- **Estimación**: 30 min

---

### Tarea 6.2: Verificación de Fase 6
- **Descripción**: Verificar que comprobantes funcionan correctamente
- **Pasos**:
  1. Testing manual del formulario
  2. Verificar que URL se guarda en DB
  3. Verificar que imagen se muestra
  4. Code review
- **Criterios de aceptación**:
  - [ ] Comprobantes se suben a Cloudinary
  - [ ] Testing manual exitoso
  - [ ] Code review aprobado
- **Estimación**: 30 min

---

## Tarea final: Limpieza y documentación

### Tarea 7.1: Eliminar endpoint antiguo
- **Descripción**: Eliminar o deprecar `POST /api/upload`
- **Archivos**:
  - `src/app/api/upload/route.ts`
- **Pasos**:
  1. Verificar que no hay más usos de `/api/upload`
  2. Eliminar archivo o agregar deprecation warning
  3. Actualizar documentación
- **Criterios de aceptación**:
  - [ ] No hay más código que use `/api/upload`
  - [ ] Endpoint eliminado o deprecado
- **Estimación**: 20 min

---

### Tarea 7.2: Documentación final
- **Descripción**: Actualizar documentación con resumen de migración
- **Archivos**:
  - `README.md`
  - `CHANGELOG.md` (si existe)
- **Pasos**:
  1. Agregar resumen de migración en README
  2. Agregar entrada en CHANGELOG
  3. Documentar folders de Cloudinary por dominio
- **Criterios de aceptación**:
  - [ ] Documentación actualizada
  - [ ] CHANGELOG actualizado
- **Estimación**: 30 min

---

### Tarea 7.3: Verificación final
- **Descripción**: Verificación completa de toda la migración
- **Pasos**:
  1. Ejecutar todos los tests
  2. Testing manual completo de todos los dominios
  3. Verificar que no hay más código que escriba a `public/uploads/`
  4. Code review final
- **Criterios de aceptación**:
  - [ ] Todos los tests pasan
  - [ ] Testing manual exitoso
  - [ ] No hay más writes a disco local
  - [ ] Code review aprobado
- **Estimación**: 1 hora

---

## Resumen de estimaciones

| Fase | Tareas | Tiempo estimado |
|------|--------|-----------------|
| Fase 1: Infraestructura | 10 tareas | ~4 horas |
| Fase 2: Productos | 3 tareas | ~1.5 horas |
| Fase 3: Logos/avatares | 5 tareas | ~2 horas |
| Fase 4: Reparaciones | 3 tareas | ~1.5 horas |
| Fase 5: Contratos | 4 tareas | ~2.5 horas |
| Fase 6: Comprobantes | 2 tareas | ~1 hora |
| Final: Limpieza | 3 tareas | ~2 horas |
| **Total** | **30 tareas** | **~12.5 horas** |

---

## Orden de ejecución

1. **Fase 1** (infraestructura) - Bloqueante para todas las demás
2. **Fase 2** (productos) - Dominio más simple, buen punto de partida
3. **Fase 3** (logos/avatares) - Múltiples componentes con patrón similar
4. **Fase 4** (reparaciones) - Similar a productos
5. **Fase 5** (contratos) - Más complejo, incluye raw files
6. **Fase 6** (comprobantes) - Simple, similar a productos
7. **Final** (limpieza) - Solo después de verificar todo

---

## Dependencias entre tareas

- Todas las tareas de Fases 2-6 dependen de Fase 1
- No hay dependencias entre Fases 2-6 (pueden hacerse en paralelo si hay equipo)
- Tarea final depende de todas las fases anteriores

---

## Criterios de éxito globales

- [ ] Todas las tareas completadas
- [ ] Todos los tests pasan
- [ ] No hay más código que escriba a `public/uploads/` o `public/avatars/`
- [ ] Endpoint `/api/upload` eliminado o deprecado
- [ ] Documentación completa
- [ ] URLs locales existentes siguen funcionando
- [ ] Nuevo flujo funciona para todos los casos de uso
- [ ] Seguridad: no hay exposición de secrets
- [ ] Performance: uploads no bloquean UI
