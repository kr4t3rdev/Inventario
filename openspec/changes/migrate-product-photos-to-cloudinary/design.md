# Diseño técnico: Migrar uploads locales a Cloudinary

## Estado
- **Fase**: Design
- **Fecha**: 2026-06-22
- **Dependencias**: spec.md

---

## 1. Arquitectura del sistema

### 1.1 Diagrama de flujo

```
┌─────────────────┐
│  Componente UI  │
│  (upload)       │
└────────┬────────┘
         │
         │ 1. uploadToCloudinary(file, folder)
         ▼
┌─────────────────────────┐
│  cloudinary-upload.ts   │
│  (client helper)        │
└────────┬────────────────┘
         │
         │ 2. POST /api/upload/sign
         ▼
┌─────────────────────────┐
│  /api/upload/sign       │
│  (signature endpoint)   │
└────────┬────────────────┘
         │
         │ 3. generateUploadSignature()
         ▼
┌─────────────────────────┐
│  cloudinary.ts          │
│  (server helper)        │
│  - Valida tenantId      │
│  - Genera firma         │
└────────┬────────────────┘
         │
         │ 4. Retorna signature + params
         ▼
┌─────────────────────────┐
│  cloudinary-upload.ts   │
│  - POST a Cloudinary    │
│  - Con signature        │
└────────┬────────────────┘
         │
         │ 5. secure_url
         ▼
┌─────────────────────────┐
│  Componente UI          │
│  - Guarda URL en state  │
│  - Llama server action  │
└────────┬────────────────┘
         │
         │ 6. Persiste URL en DB
         ▼
┌─────────────────────────┐
│  Prisma                 │
│  (Producto.fotos, etc.) │
└─────────────────────────┘
```

### 1.2 Estructura de archivos

```
src/
├── lib/
│   ├── cloudinary.ts              # Server helper (firma)
│   └── upload/
│       └── cloudinary-upload.ts   # Client helper (upload)
├── app/
│   └── api/
│       └── upload/
│           └── sign/
│               └── route.ts       # Endpoint de firma
└── features/
    ├── productos/
    │   └── components/
    │       └── product-photo-upload.tsx
    ├── clientes/
    │   └── components/
    │       └── cliente-logo-upload.tsx
    ├── vendors/
    │   └── components/
    │       └── vendor-logo-upload.tsx
    ├── mi-empresa/
    │   └── components/
    │       └── mi-empresa-form.tsx
    ├── reparaciones/
    │   └── ordenes/
    │       ├── [id]/page.tsx
    │       └── new/page.tsx
    ├── contratos/
    │   ├── api/handlers.ts
    │   └── components/
    │       └── new-version-dialog.tsx
    └── contabilidad/
        └── components/
            └── deudas-cash/
                └── deuda-cash-form.tsx
```

---

## 2. Decisiones técnicas

### 2.1 ¿Por qué signed upload en vez de server-side upload?

**Decisión**: Signed upload (cliente → Cloudinary directo)

**Razones**:
1. **Performance**: El archivo no pasa por el servidor, reduce carga y latencia
2. **Escalabilidad**: El servidor no maneja streams de archivos
3. **Costo**: Menos uso de recursos del servidor (CPU, memoria, bandwidth)
4. **Simplicidad**: El servidor solo genera una firma (operación ligera)

**Trade-offs**:
- Requiere configuración CORS en Cloudinary
- El cliente necesita acceso a internet para subir
- Menos control sobre el proceso de upload (no podemos interceptar/modificar el archivo)

### 2.2 ¿Por qué un solo endpoint de firma en vez de uno por dominio?

**Decisión**: Un solo endpoint `/api/upload/sign` que acepta `folder` como parámetro

**Razones**:
1. **Consistencia**: Una sola lógica de firma y validación
2. **Mantenibilidad**: Un solo lugar para cambiar la lógica de firma
3. **Flexibilidad**: El cliente decide el folder según el dominio
4. **Seguridad**: Validación centralizada de tenantId en folder

**Trade-offs**:
- El cliente necesita saber qué folder usar
- Menos restricciones por defecto (pero podemos agregar validaciones)

### 2.3 ¿Por qué no borrar archivos anteriores automáticamente?

**Decisión**: No borrar automáticamente archivos anteriores de Cloudinary

**Razones**:
1. **Simplicidad**: Evita lógica compleja de tracking de archivos
2. **Seguridad**: Previene borrado accidental
3. **Flexibilidad**: Permite rollback manual si es necesario
4. **Costo**: Cloudinary free tier tiene suficiente espacio

**Trade-offs**:
- Acumulación de archivos no usados
- Requiere limpieza manual o script posterior

### 2.4 ¿Por qué mantener URLs locales existentes?

**Decisión**: No migrar URLs existentes, solo nuevas uploads van a Cloudinary

**Razones**:
1. **Riesgo**: Migración masiva puede romper referencias
2. **Complejidad**: Requiere script de migración y validación
3. **Compatibilidad**: URLs locales siguen funcionando mientras los archivos existan
4. **Iteración**: Permite migrar gradualmente si es necesario

**Trade-offs**:
- Mezcla de URLs locales y de Cloudinary en la DB
- Requiere limpieza posterior

---

## 3. Implementación detallada

### 3.1 Fase 1: Infraestructura compartida

#### 3.1.1 `src/lib/cloudinary.ts`

```typescript
import { v2 as cloudinary } from 'cloudinary';

// Configuración
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId?: string;
}

export function generateUploadSignature(
  folder: string,
  publicId?: string,
  resourceType: 'image' | 'raw' = 'image'
): UploadSignature {
  // Validar configuración
  if (!process.env.CLOUDINARY_CLOUD_NAME || 
      !process.env.CLOUDINARY_API_KEY || 
      !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary configuration missing');
  }

  // Validar folder
  if (!folder || folder.trim() === '') {
    throw new Error('Folder is required');
  }

  const timestamp = Math.round(Date.now() / 1000);
  
  // Construir parámetros para firma
  const paramsToSign: Record<string, any> = {
    timestamp,
    folder,
  };
  
  if (publicId) {
    paramsToSign.public_id = publicId;
  }

  // Generar firma
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
    publicId,
  };
}
```

#### 3.1.2 `src/lib/upload/cloudinary-upload.ts`

```typescript
'use client';

export interface UploadOptions {
  resourceType?: 'image' | 'raw';
  publicId?: string;
  onProgress?: (progress: number) => void;
}

export interface UploadResponse {
  secure_url: string;
  public_id: string;
  format?: string;
  width?: number;
  height?: number;
}

export async function uploadToCloudinary(
  file: File,
  folder: string,
  options: UploadOptions = {}
): Promise<string> {
  const { resourceType = 'image', publicId, onProgress } = options;

  // 1. Obtener firma
  const signResponse = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, publicId, resourceType }),
  });

  if (!signResponse.ok) {
    throw new Error('Failed to get upload signature');
  }

  const { signature, timestamp, apiKey, cloudName } = await signResponse.json();

  // 2. Preparar FormData para Cloudinary
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', folder);
  
  if (publicId) {
    formData.append('public_id', publicId);
  }

  // 3. Subir a Cloudinary
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    throw new Error(`Cloudinary upload failed: ${error.error?.message || 'Unknown error'}`);
  }

  const result: UploadResponse = await uploadResponse.json();
  
  if (onProgress) {
    onProgress(100);
  }

  return result.secure_url;
}
```

#### 3.1.3 `src/app/api/upload/sign/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateUploadSignature } from '@/lib/cloudinary';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticar usuario
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parsear request
    const body = await request.json();
    const { folder, publicId, resourceType = 'image' } = body;

    // 3. Validar folder incluye tenantId
    if (!folder || !folder.startsWith(`${user.tenantId}/`)) {
      return NextResponse.json(
        { error: 'Invalid folder: must start with tenantId' },
        { status: 400 }
      );
    }

    // 4. Validar resourceType
    if (resourceType !== 'image' && resourceType !== 'raw') {
      return NextResponse.json(
        { error: 'Invalid resourceType: must be "image" or "raw"' },
        { status: 400 }
      );
    }

    // 5. Generar firma
    const signature = generateUploadSignature(folder, publicId, resourceType);

    return NextResponse.json(signature);
  } catch (error) {
    console.error('Error generating upload signature:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload signature' },
      { status: 500 }
    );
  }
}
```

#### 3.1.4 `next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
};

export default nextConfig;
```

#### 3.1.5 Tests

**`src/lib/cloudinary.test.ts`**:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateUploadSignature } from './cloudinary';

describe('generateUploadSignature', () => {
  beforeEach(() => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud');
    vi.stubEnv('CLOUDINARY_API_KEY', 'test-key');
    vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret');
  });

  it('generates signature with valid params', () => {
    const result = generateUploadSignature('tenant123/productos');
    
    expect(result).toMatchObject({
      cloudName: 'test-cloud',
      apiKey: 'test-key',
      folder: 'tenant123/productos',
    });
    expect(result.signature).toBeDefined();
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('throws error when config is missing', () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', '');
    
    expect(() => generateUploadSignature('folder')).toThrow(
      'Cloudinary configuration missing'
    );
  });

  it('throws error when folder is empty', () => {
    expect(() => generateUploadSignature('')).toThrow(
      'Folder is required'
    );
  });

  it('includes publicId when provided', () => {
    const result = generateUploadSignature('folder', 'my-public-id');
    expect(result.publicId).toBe('my-public-id');
  });
});
```

**`src/lib/upload/cloudinary-upload.test.ts`**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadToCloudinary } from './cloudinary-upload';

describe('uploadToCloudinary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uploads file successfully', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    
    // Mock fetch para firma
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          signature: 'test-sig',
          timestamp: 123456,
          apiKey: 'test-key',
          cloudName: 'test-cloud',
        }))
      )
      // Mock fetch para upload a Cloudinary
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          secure_url: 'https://res.cloudinary.com/test/image.jpg',
          public_id: 'test-id',
        }))
      );

    const url = await uploadToCloudinary(mockFile, 'tenant123/productos');
    
    expect(url).toBe('https://res.cloudinary.com/test/image.jpg');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws error when signature fails', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 401 })
    );

    await expect(
      uploadToCloudinary(mockFile, 'tenant123/productos')
    ).rejects.toThrow('Failed to get upload signature');
  });

  it('throws error when Cloudinary upload fails', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          signature: 'test-sig',
          timestamp: 123456,
          apiKey: 'test-key',
          cloudName: 'test-cloud',
        }))
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid signature' } }), {
          status: 400,
        })
      );

    await expect(
      uploadToCloudinary(mockFile, 'tenant123/productos')
    ).rejects.toThrow('Cloudinary upload failed');
  });
});
```

**`src/app/api/upload/sign/route.test.ts`**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { getCurrentUser } from '@/lib/auth';

vi.mock('@/lib/auth');
vi.mock('@/lib/cloudinary');

describe('POST /api/upload/sign', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns signature for authenticated user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'user123',
      tenantId: 'tenant123',
    });

    const request = new Request('http://localhost/api/upload/sign', {
      method: 'POST',
      body: JSON.stringify({ folder: 'tenant123/productos' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.signature).toBeDefined();
    expect(data.folder).toBe('tenant123/productos');
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const request = new Request('http://localhost/api/upload/sign', {
      method: 'POST',
      body: JSON.stringify({ folder: 'tenant123/productos' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when folder does not start with tenantId', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'user123',
      tenantId: 'tenant123',
    });

    const request = new Request('http://localhost/api/upload/sign', {
      method: 'POST',
      body: JSON.stringify({ folder: 'other-tenant/productos' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when resourceType is invalid', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'user123',
      tenantId: 'tenant123',
    });

    const request = new Request('http://localhost/api/upload/sign', {
      method: 'POST',
      body: JSON.stringify({ 
        folder: 'tenant123/productos',
        resourceType: 'video' 
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

### 3.2 Fase 2: Fotos de producto

#### 3.2.1 `src/features/productos/components/product-photo-upload.tsx`

**Cambios**:
- Importar `uploadToCloudinary`
- Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`
- Usar folder `tenantId/productos`

```typescript
import { uploadToCloudinary } from '@/lib/upload/cloudinary-upload';
import { useTenant } from '@/hooks/use-tenant';

// Dentro del componente:
const { tenantId } = useTenant();

const handleUpload = async (file: File) => {
  try {
    const url = await uploadToCloudinary(
      file,
      `${tenantId}/productos`,
      { onProgress: setProgress }
    );
    onUploadSuccess(url);
  } catch (error) {
    console.error('Upload failed:', error);
    toast.error('Error al subir la imagen');
  }
};
```

### 3.3 Fase 3: Logos y avatares

#### 3.3.1 Folders por dominio

| Dominio | Folder |
|---------|--------|
| Clientes | `${tenantId}/clientes/${clienteId}/logo` |
| Vendors | `${tenantId}/vendors/${vendorId}/logo` |
| Empresa | `${tenantId}/empresa/logo` |
| Perfil | `${tenantId}/usuarios/${userId}/avatar` |

#### 3.3.2 Patrón de migración

Cada componente sigue el mismo patrón:
1. Importar `uploadToCloudinary`
2. Obtener `tenantId` del contexto/hook
3. Construir folder con IDs relevantes
4. Reemplazar `fetch('/api/upload')` con `uploadToCloudinary`

### 3.4 Fase 4: Fotos de reparaciones

#### 3.4.1 Folder
`${tenantId}/reparaciones/${ordenId}/fotos`

#### 3.4.2 Consideraciones
- Múltiples fotos por orden
- Mantener array de URLs en `Reparacion.fotos`
- Sin cambios en server actions

### 3.5 Fase 5: Contratos

#### 3.5.1 Anexos
- Componente: `src/components/file-upload.tsx`
- Folder: `${tenantId}/contratos/${contratoId}/anexos`
- `resourceType`: `'image'` (asumiendo que son imágenes)

#### 3.5.2 Versiones
- Handler: `src/features/contratos/api/handlers.ts`
- Folder: `${tenantId}/contratos/${contratoId}/versiones`
- `resourceType`: `'raw'` (PDF, DOCX, etc.)

#### 3.5.3 Cambios en handler
```typescript
// Antes:
const buffer = await file.arrayBuffer();
const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
await fs.promises.writeFile(filePath, buffer);
const fileUrl = `/uploads/${fileName}`;

// Después:
const fileUrl = await uploadToCloudinary(
  file,
  `${tenantId}/contratos/${contratoId}/versiones`,
  { resourceType: 'raw' }
);
```

### 3.6 Fase 6: Comprobantes de deudas cash

#### 3.6.1 Folder
`${tenantId}/contabilidad/deudas-cash/${deudaId}/comprobantes`

#### 3.6.2 Componente
`src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx`

---

## 4. Estrategia de testing

### 4.1 Unit tests
- Helpers de servidor (`cloudinary.ts`)
- Helpers de cliente (`cloudinary-upload.ts`)
- Endpoint de firma (`/api/upload/sign/route.ts`)

### 4.2 Integration tests
- Flujo completo de upload (mock de Cloudinary)
- Validación de tenantId en folder

### 4.3 Component tests
- Cada componente migrado con mock de `uploadToCloudinary`
- Verificar que se llama con los parámetros correctos
- Verificar manejo de errores

### 4.4 E2E tests (opcional)
- Upload real a Cloudinary (en ambiente de staging)
- Verificar que la URL se guarda correctamente en DB
- Verificar que la imagen se muestra

---

## 5. Estrategia de migración

### 5.1 Orden de implementación
1. **Fase 1**: Infraestructura (sin cambios en UI)
2. **Fase 2**: Productos (dominio más simple)
3. **Fase 3**: Logos/avatares (múltiples componentes, patrón similar)
4. **Fase 4**: Reparaciones (similar a productos)
5. **Fase 5**: Contratos (más complejo, incluye raw files)
6. **Fase 6**: Comprobantes (simple, similar a productos)

### 5.2 Criterios para avanzar a la siguiente fase
- Todos los tests de la fase actual pasan
- Code review aprobado
- Deploy exitoso en staging
- Verificación manual de que funciona

### 5.3 Rollback plan
- Cada fase es independiente
- Si una fase falla, se puede revertir sin afectar las anteriores
- URLs locales existentes siguen funcionando

---

## 6. Consideraciones de seguridad

### 6.1 Validaciones en el servidor
- Autenticación requerida para endpoint de firma
- Validar que `folder` incluya `tenantId` del usuario
- Validar `resourceType` (solo `image` o `raw`)

### 6.2 Validaciones en el cliente
- Tipo de archivo permitido
- Tamaño máximo (configurable por dominio)
- No exponer `api_secret`

### 6.3 Cloudinary
- Firma válida requerida para upload
- CORS configurado para permitir uploads desde el dominio
- Restricciones de tamaño y tipo en la configuración de Cloudinary

---

## 7. Monitoreo y observabilidad

### 7.1 Logs
- Logs de errores en endpoint de firma
- Logs de errores en helper de cliente
- Métricas de uploads exitosos/fallidos

### 7.2 Alertas
- Alerta si hay muchos fallos de upload
- Alerta si se acerca al límite del free tier de Cloudinary

### 7.3 Dashboards
- Número de uploads por día
- Espacio usado en Cloudinary
- Tipos de archivos subidos

---

## 8. Dependencias externas

### 8.1 Paquetes npm
```json
{
  "dependencies": {
    "cloudinary": "^2.0.0"
  }
}
```

### 8.2 Variables de entorno
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 8.3 Configuración de Cloudinary
- Crear cuenta en Cloudinary
- Obtener credenciales
- Configurar CORS (si es necesario)
- Configurar restricciones de upload (opcional)

---

## 9. Riesgos y mitigaciones

### 9.1 Riesgo: Exposición de API secret
**Mitigación**: Solo se usa en el servidor, nunca se envía al cliente

### 9.2 Riesgo: Límite de free tier excedido
**Mitigación**: Monitorear uso, considerar upgrade a plan pago si es necesario

### 9.3 Riesgo: URLs locales rotas
**Mitigación**: No migrar URLs existentes, mantener compatibilidad

### 9.4 Riesgo: Regresiones en UI
**Mitigación**: Tests de componentes, code review, testing manual

---

## 10. Futuras mejoras

### 10.1 Migración de archivos existentes
- Script para migrar archivos de `public/uploads/` a Cloudinary
- Actualizar URLs en DB
- Eliminar archivos locales después de migración

### 10.2 Transformaciones de imágenes
- Usar transformaciones de Cloudinary (resize, format, quality)
- Generar thumbnails automáticamente
- Optimizar imágenes para diferentes dispositivos

### 10.3 Limpieza de archivos no usados
- Script para identificar archivos no referenciados en DB
- Eliminar archivos de Cloudinary
- Ahorrar espacio

### 10.4 Upload progress UI
- Barra de progreso más detallada
- Cancelación de uploads
- Retry automático en caso de fallo
