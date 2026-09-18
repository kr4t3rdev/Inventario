# Delta for upload-provider-routing

## ADDED Requirements

### Requirement: Backend resolves upload provider centrally

The system MUST resolve the storage provider for each upload from a backend policy and MUST NOT require UI components to know whether the asset goes to Cloudinary or UploadThing.

#### Scenario: Upload intent returns Cloudinary for Básico/Profesional assets
- GIVEN un `uploadKey` de logo/avatar/comprobante configurado para Cloudinary
- WHEN el cliente solicita el upload intent
- THEN the system MUST devolver provider `cloudinary`
- AND MUST incluir los parámetros necesarios para el flujo signed upload existente

#### Scenario: Upload intent returns UploadThing for Empresarial assets
- GIVEN un `uploadKey` de foto de producto o archivo de contrato configurado para UploadThing
- WHEN el cliente solicita el upload intent
- THEN the system MUST devolver provider `uploadthing`
- AND MUST incluir el endpoint/route slug e input metadata necesarios para UploadThing

### Requirement: Client upload wrapper is provider-agnostic

The client MUST upload files through a single wrapper that dispatches to the resolved provider and returns a normalized asset contract.

#### Scenario: UI component uploads without provider knowledge
- GIVEN un componente cliente que necesita subir un archivo
- WHEN invoca el wrapper común de upload
- THEN the system MUST resolver el provider antes de transferir el archivo
- AND the component MUST receive una respuesta normalizada con URL, bytes, mimeType y metadata del provider

### Requirement: Contract version flow uses the same semantic policy

Contract version and attachment flows MUST reuse the same provider-routing and entitlement policy even when their upload path is server-side.

#### Scenario: Contract version route rejects missing entitlement before upload
- GIVEN un usuario sin `upload-contratos-version`
- WHEN envía un archivo a la ruta de crear versión
- THEN the system MUST reject the request before calling the provider SDK

#### Scenario: Contract version stores normalized provider metadata
- GIVEN una versión de contrato subida exitosamente
- WHEN la ruta persiste el archivo
- THEN the system MUST guardar una metadata uniforme suficiente para identificar provider y asset remoto
- AND MUST preserve contract business behavior independiente del provider
