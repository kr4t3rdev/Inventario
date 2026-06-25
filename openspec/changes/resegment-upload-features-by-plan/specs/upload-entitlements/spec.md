# Upload Entitlements Specification

## Purpose

Definir permisos explícitos para cada familia de carga de archivos/imágenes, independientes del storage, y mapearlos por plan sin alterar el comportamiento de backups.

## Requirements

### Requirement: Plan upload matrix

The system MUST map upload entitlements by feature key as follows:
- Básico: `upload-mi-empresa-logo`
- Profesional: `upload-clientes-logo`, `upload-vendors-logo`, `upload-profile-avatar`, `upload-deudas-cash-receipt`
- Empresarial: `upload-productos-photo`, `upload-contratos-attachment`, `upload-contratos-version`

#### Scenario: Básico solo permite logo de empresa
- GIVEN un usuario tenant del plan Básico
- WHEN solicita subir el logo de empresa
- THEN the system MUST permitir el upload si además tiene rol manager
- AND the system MUST reject avatar, logos de clientes/vendors, comprobantes, fotos de productos y archivos de contratos

#### Scenario: Profesional permite uploads operativos livianos
- GIVEN un usuario tenant del plan Profesional
- WHEN solicita subir logo de cliente, logo de vendor, avatar o comprobante permitido
- THEN the system MUST autorizar esos uploads si el flujo también cumple los permisos del módulo/actor
- AND the system MUST reject fotos de productos y archivos/versiones de contratos

#### Scenario: Empresarial reserva productos y contratos
- GIVEN un usuario tenant del plan Empresarial
- WHEN solicita subir foto de producto, anexo de contrato o versión de contrato
- THEN the system MUST autorizar esos uploads si también cumple los permisos del módulo/actor

### Requirement: Upload entitlement does not override parent module access

A dedicated upload entitlement MUST NOT unlock a parent module by itself.

#### Scenario: Dormant entitlement does not unlock parent module
- GIVEN un plan donde el feature de upload está activo pero el módulo padre sigue deshabilitado
- WHEN el usuario intenta acceder al flujo completo desde UI o backend
- THEN the system MUST seguir rechazando la operación por el módulo padre
- AND the upload entitlement MUST NOT ampliar acceso funcional por sí solo

### Requirement: Backups stay out of upload entitlements

Backup import/upload flows MUST remain admin-only and MUST NOT be moved under `upload-*` entitlements.

#### Scenario: Backup import remains out of scope
- GIVEN un admin autenticado
- WHEN importa una salva desde archivo o URL
- THEN the system MUST seguir usando el flujo de backups existente
- AND the system MUST NOT require any `upload-*` entitlement
