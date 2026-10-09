# AdminApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileActivateAdminLicense**](AdminApi.md#mobileactivateadminlicense) | **POST** /admin/licenses/activate | Activar una licencia |
| [**mobileActivateAdminTenant**](AdminApi.md#mobileactivateadmintenant) | **POST** /admin/tenants/activate | Activar una empresa |
| [**mobileActivateAdminUser**](AdminApi.md#mobileactivateadminuser) | **POST** /admin/users/activate | Activar un usuario |
| [**mobileApproveAdminMembership**](AdminApi.md#mobileapproveadminmembership) | **POST** /admin/memberships/approve | Aprobar solicitud de membresía |
| [**mobileAssignAdminTenantLicense**](AdminApi.md#mobileassignadmintenantlicense) | **POST** /admin/tenants/license/assign | Asignar una licencia a una empresa |
| [**mobileAssignAdminUserTenant**](AdminApi.md#mobileassignadminusertenant) | **POST** /admin/users/assign-tenant | Asignar o cambiar la empresa de un usuario |
| [**mobileChangeAdminUserTenantRole**](AdminApi.md#mobilechangeadminusertenantrole) | **PATCH** /admin/users/change-tenant-role | Cambiar el rol de un usuario dentro de una empresa |
| [**mobileDeactivateAdminLicense**](AdminApi.md#mobiledeactivateadminlicense) | **POST** /admin/licenses/deactivate | Desactivar una licencia |
| [**mobileDeactivateAdminTenant**](AdminApi.md#mobiledeactivateadmintenant) | **POST** /admin/tenants/deactivate | Desactivar una empresa |
| [**mobileDeactivateAdminTenantLicense**](AdminApi.md#mobiledeactivateadmintenantlicense) | **POST** /admin/tenants/license/deactivate | Desactivar la licencia de una empresa |
| [**mobileDeactivateAdminUser**](AdminApi.md#mobiledeactivateadminuser) | **POST** /admin/users/deactivate | Desactivar un usuario |
| [**mobileDeleteAdminLicense**](AdminApi.md#mobiledeleteadminlicense) | **POST** /admin/licenses/delete | Eliminar una licencia |
| [**mobileDeleteAdminTenant**](AdminApi.md#mobiledeleteadmintenant) | **POST** /admin/tenants/delete | Eliminar una empresa |
| [**mobileDeleteAdminUser**](AdminApi.md#mobiledeleteadminuser) | **POST** /admin/users/delete | Eliminar un usuario |
| [**mobileGetAdminActivityLogs**](AdminApi.md#mobilegetadminactivitylogs) | **GET** /admin/activity-logs | Obtener el registro de actividad de los usuarios |
| [**mobileGetAdminHealth**](AdminApi.md#mobilegetadminhealth) | **GET** /admin/health | Consultar salud del sistema |
| [**mobileGetAdminLicenseStats**](AdminApi.md#mobilegetadminlicensestats) | **GET** /admin/licenses/stats | Consultar métricas de licencias |
| [**mobileGetAdminLicenses**](AdminApi.md#mobilegetadminlicenses) | **GET** /admin/licenses | Listar licencias con filtros |
| [**mobileGetAdminPendingMemberships**](AdminApi.md#mobilegetadminpendingmemberships) | **GET** /admin/memberships/pending | Listar solicitudes de membresía pendientes |
| [**mobileGetAdminSessions**](AdminApi.md#mobilegetadminsessions) | **GET** /admin/sessions | Listar las sesiones registradas |
| [**mobileGetAdminTenantDetail**](AdminApi.md#mobilegetadmintenantdetail) | **GET** /admin/tenants/detail | Obtener el detalle de una empresa |
| [**mobileGetAdminTenantLicense**](AdminApi.md#mobilegetadmintenantlicense) | **GET** /admin/tenants/license | Ver las licencias de una empresa |
| [**mobileGetAdminTenantUsers**](AdminApi.md#mobilegetadmintenantusers) | **GET** /admin/tenants/users | Listar los usuarios de una empresa |
| [**mobileGetAdminTenants**](AdminApi.md#mobilegetadmintenants) | **GET** /admin/tenants | Listar empresas de la plataforma |
| [**mobileGetAdminUserDetail**](AdminApi.md#mobilegetadminuserdetail) | **GET** /admin/users/detail | Obtener el detalle de un usuario |
| [**mobileGetAdminUserLoginHistory**](AdminApi.md#mobilegetadminuserloginhistory) | **GET** /admin/users/login-history | Obtener el historial de sesiones de un usuario |
| [**mobileGetAdminUsers**](AdminApi.md#mobilegetadminusers) | **GET** /admin/users | Listar usuarios de la plataforma |
| [**mobileLockAdminUser**](AdminApi.md#mobilelockadminuser) | **POST** /admin/users/lock | Bloquear usuario por 24 horas |
| [**mobileRejectAdminMembership**](AdminApi.md#mobilerejectadminmembership) | **POST** /admin/memberships/reject | Rechazar solicitud de membresía |
| [**mobileRemoveAdminTenantUser**](AdminApi.md#mobileremoveadmintenantuser) | **POST** /admin/tenants/remove-user | Quitar un usuario de una empresa |
| [**mobileRenewAdminLicense**](AdminApi.md#mobilerenewadminlicense) | **POST** /admin/licenses/renew | Renovar una licencia |
| [**mobileResendAdminUserVerification**](AdminApi.md#mobileresendadminuserverification) | **POST** /admin/users/resend-verification | Reenviar el email de verificación |
| [**mobileResetAdminUserPassword**](AdminApi.md#mobileresetadminuserpassword) | **POST** /admin/users/reset-password | Enviar enlace de restablecimiento de contraseña |
| [**mobileRevokeAdminSession**](AdminApi.md#mobilerevokeadminsession) | **POST** /admin/sessions/revoke | Revocar una sesión específica |
| [**mobileRevokeAdminUserSessions**](AdminApi.md#mobilerevokeadminusersessions) | **POST** /admin/users/revoke-sessions | Revocar las sesiones activas de un usuario |
| [**mobileUnlockAdminUser**](AdminApi.md#mobileunlockadminuser) | **POST** /admin/users/unlock | Desbloquear usuario |
| [**mobileUpdateAdminTenant**](AdminApi.md#mobileupdateadmintenant) | **PATCH** /admin/tenants/update | Editar los datos de una empresa |
| [**mobileUpdateAdminTenantLicense**](AdminApi.md#mobileupdateadmintenantlicense) | **PATCH** /admin/tenants/license/update | Actualizar la licencia de una empresa |
| [**mobileUpdateAdminUser**](AdminApi.md#mobileupdateadminuser) | **PATCH** /admin/users/update | Editar nombre, email o rol de un usuario |
| [**mobileVerifyAdminUserEmail**](AdminApi.md#mobileverifyadminuseremail) | **POST** /admin/users/verify-email | Marcar el email como verificado |



## mobileActivateAdminLicense

> PostAdminLicensesActivateResponse mobileActivateAdminLicense(adminLicenciaIdRequest)

Activar una licencia

Activa una licencia desactivada de una empresa, restituyendo el acceso a sus usuarios dentro del período de vigencia.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileActivateAdminLicenseRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminLicenciaIdRequest
    adminLicenciaIdRequest: ...,
  } satisfies MobileActivateAdminLicenseRequest;

  try {
    const data = await api.mobileActivateAdminLicense(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminLicenciaIdRequest** | [AdminLicenciaIdRequest](AdminLicenciaIdRequest.md) |  | |

### Return type

[**PostAdminLicensesActivateResponse**](PostAdminLicensesActivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **409** | Conflicto |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileActivateAdminTenant

> PostAdminTenantsActivateResponse mobileActivateAdminTenant(adminTenantIdRequest)

Activar una empresa

Activa una empresa reactivando todas sus membresías, restituyendo el acceso de sus miembros. No modifica las licencias.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileActivateAdminTenantRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminTenantIdRequest
    adminTenantIdRequest: ...,
  } satisfies MobileActivateAdminTenantRequest;

  try {
    const data = await api.mobileActivateAdminTenant(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminTenantIdRequest** | [AdminTenantIdRequest](AdminTenantIdRequest.md) |  | |

### Return type

[**PostAdminTenantsActivateResponse**](PostAdminTenantsActivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileActivateAdminUser

> PostAdminUsersActivateResponse mobileActivateAdminUser(adminUserIdRequest)

Activar un usuario

Reactiva el acceso de un usuario desactivado, limpiando además cualquier bloqueo temporal y los intentos fallidos de inicio de sesión acumulados.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileActivateAdminUserRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminUserIdRequest
    adminUserIdRequest: ...,
  } satisfies MobileActivateAdminUserRequest;

  try {
    const data = await api.mobileActivateAdminUser(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminUserIdRequest** | [AdminUserIdRequest](AdminUserIdRequest.md) |  | |

### Return type

[**PostAdminUsersActivateResponse**](PostAdminUsersActivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **409** | Conflicto |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileApproveAdminMembership

> PostAdminMembershipsApproveResponse mobileApproveAdminMembership(approveAdminMembershipRequest)

Aprobar solicitud de membresía

Aprueba una solicitud de membresía pendiente, activa al usuario, cierra su flujo de incorporación y crea su registro de empleado en la empresa cuando aún no existe.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileApproveAdminMembershipRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // ApproveAdminMembershipRequest
    approveAdminMembershipRequest: ...,
  } satisfies MobileApproveAdminMembershipRequest;

  try {
    const data = await api.mobileApproveAdminMembership(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **approveAdminMembershipRequest** | [ApproveAdminMembershipRequest](ApproveAdminMembershipRequest.md) |  | |

### Return type

[**PostAdminMembershipsApproveResponse**](PostAdminMembershipsApproveResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **409** | La membresía ya está activa |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileAssignAdminTenantLicense

> PostAdminTenantsLicenseAssignResponse mobileAssignAdminTenantLicense(assignAdminTenantLicenseRequest)

Asignar una licencia a una empresa

Crea una licencia nueva para la empresa con el plan indicado, desactivando las licencias vigentes anteriores para evitar ambigüedad. Calcula inicio y vencimiento desde la duración del plan.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileAssignAdminTenantLicenseRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AssignAdminTenantLicenseRequest
    assignAdminTenantLicenseRequest: ...,
  } satisfies MobileAssignAdminTenantLicenseRequest;

  try {
    const data = await api.mobileAssignAdminTenantLicense(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **assignAdminTenantLicenseRequest** | [AssignAdminTenantLicenseRequest](AssignAdminTenantLicenseRequest.md) |  | |

### Return type

[**PostAdminTenantsLicenseAssignResponse**](PostAdminTenantsLicenseAssignResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileAssignAdminUserTenant

> PostAdminUsersAssignTenantResponse mobileAssignAdminUserTenant(assignAdminUserTenantRequest)

Asignar o cambiar la empresa de un usuario

Crea o actualiza la membresía de un usuario en una empresa con el rol operativo indicado. Puede desactivar las demás membresías para efectuar un cambio de empresa.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileAssignAdminUserTenantRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AssignAdminUserTenantRequest
    assignAdminUserTenantRequest: ...,
  } satisfies MobileAssignAdminUserTenantRequest;

  try {
    const data = await api.mobileAssignAdminUserTenant(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **assignAdminUserTenantRequest** | [AssignAdminUserTenantRequest](AssignAdminUserTenantRequest.md) |  | |

### Return type

[**PostAdminUsersAssignTenantResponse**](PostAdminUsersAssignTenantResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileChangeAdminUserTenantRole

> PatchAdminUsersChangeTenantRoleResponse mobileChangeAdminUserTenantRole(changeAdminUserTenantRoleRequest)

Cambiar el rol de un usuario dentro de una empresa

Actualiza el rol operativo (manager, economico o dependiente) de la membresía existente de un usuario en una empresa.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileChangeAdminUserTenantRoleRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // ChangeAdminUserTenantRoleRequest
    changeAdminUserTenantRoleRequest: ...,
  } satisfies MobileChangeAdminUserTenantRoleRequest;

  try {
    const data = await api.mobileChangeAdminUserTenantRole(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **changeAdminUserTenantRoleRequest** | [ChangeAdminUserTenantRoleRequest](ChangeAdminUserTenantRoleRequest.md) |  | |

### Return type

[**PatchAdminUsersChangeTenantRoleResponse**](PatchAdminUsersChangeTenantRoleResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileDeactivateAdminLicense

> PostAdminLicensesDeactivateResponse mobileDeactivateAdminLicense(adminLicenciaIdRequest)

Desactivar una licencia

Desactiva una licencia activa de una empresa, suspendiendo el acceso de sus usuarios hasta que se reactive o renueve.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeactivateAdminLicenseRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminLicenciaIdRequest
    adminLicenciaIdRequest: ...,
  } satisfies MobileDeactivateAdminLicenseRequest;

  try {
    const data = await api.mobileDeactivateAdminLicense(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminLicenciaIdRequest** | [AdminLicenciaIdRequest](AdminLicenciaIdRequest.md) |  | |

### Return type

[**PostAdminLicensesDeactivateResponse**](PostAdminLicensesDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **409** | Conflicto |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileDeactivateAdminTenant

> PostAdminTenantsDeactivateResponse mobileDeactivateAdminTenant(adminTenantIdRequest)

Desactivar una empresa

Desactiva una empresa bloqueando el acceso de todos sus miembros al desactivar sus membresías. No modifica las licencias.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeactivateAdminTenantRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminTenantIdRequest
    adminTenantIdRequest: ...,
  } satisfies MobileDeactivateAdminTenantRequest;

  try {
    const data = await api.mobileDeactivateAdminTenant(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminTenantIdRequest** | [AdminTenantIdRequest](AdminTenantIdRequest.md) |  | |

### Return type

[**PostAdminTenantsDeactivateResponse**](PostAdminTenantsDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileDeactivateAdminTenantLicense

> PostAdminTenantsLicenseDeactivateResponse mobileDeactivateAdminTenantLicense(adminLicenciaIdRequest)

Desactivar la licencia de una empresa

Desactiva una licencia específica de una empresa, suspendiendo el acceso asociado hasta que se reactive o renueve.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeactivateAdminTenantLicenseRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminLicenciaIdRequest
    adminLicenciaIdRequest: ...,
  } satisfies MobileDeactivateAdminTenantLicenseRequest;

  try {
    const data = await api.mobileDeactivateAdminTenantLicense(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminLicenciaIdRequest** | [AdminLicenciaIdRequest](AdminLicenciaIdRequest.md) |  | |

### Return type

[**PostAdminTenantsLicenseDeactivateResponse**](PostAdminTenantsLicenseDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **409** | Conflicto |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileDeactivateAdminUser

> PostAdminUsersDeactivateResponse mobileDeactivateAdminUser(adminUserIdRequest)

Desactivar un usuario

Desactiva el acceso de un usuario y revoca de inmediato todas sus sesiones activas. No permite desactivar la propia cuenta ni al último administrador activo de la plataforma.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeactivateAdminUserRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminUserIdRequest
    adminUserIdRequest: ...,
  } satisfies MobileDeactivateAdminUserRequest;

  try {
    const data = await api.mobileDeactivateAdminUser(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminUserIdRequest** | [AdminUserIdRequest](AdminUserIdRequest.md) |  | |

### Return type

[**PostAdminUsersDeactivateResponse**](PostAdminUsersDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **409** | Conflicto |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileDeleteAdminLicense

> PostAdminLicensesDeleteResponse mobileDeleteAdminLicense(adminLicenciaIdRequest)

Eliminar una licencia

Elimina permanentemente una licencia de una empresa. Es una operación irreversible: la empresa queda sin licencia hasta que se le asigne una nueva.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeleteAdminLicenseRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminLicenciaIdRequest
    adminLicenciaIdRequest: ...,
  } satisfies MobileDeleteAdminLicenseRequest;

  try {
    const data = await api.mobileDeleteAdminLicense(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminLicenciaIdRequest** | [AdminLicenciaIdRequest](AdminLicenciaIdRequest.md) |  | |

### Return type

[**PostAdminLicensesDeleteResponse**](PostAdminLicensesDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileDeleteAdminTenant

> PostAdminTenantsDeleteResponse mobileDeleteAdminTenant(adminTenantIdRequest)

Eliminar una empresa

Elimina permanentemente una empresa y todos sus datos asociados. Es una operación irreversible.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeleteAdminTenantRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminTenantIdRequest
    adminTenantIdRequest: ...,
  } satisfies MobileDeleteAdminTenantRequest;

  try {
    const data = await api.mobileDeleteAdminTenant(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminTenantIdRequest** | [AdminTenantIdRequest](AdminTenantIdRequest.md) |  | |

### Return type

[**PostAdminTenantsDeleteResponse**](PostAdminTenantsDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileDeleteAdminUser

> PostAdminUsersDeleteResponse mobileDeleteAdminUser(adminUserIdRequest)

Eliminar un usuario

Elimina permanentemente un usuario de la plataforma. Bloquea la operación si es un gestor de ventas con registros asociados, si es la propia cuenta o si es el último administrador activo.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeleteAdminUserRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminUserIdRequest
    adminUserIdRequest: ...,
  } satisfies MobileDeleteAdminUserRequest;

  try {
    const data = await api.mobileDeleteAdminUser(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminUserIdRequest** | [AdminUserIdRequest](AdminUserIdRequest.md) |  | |

### Return type

[**PostAdminUsersDeleteResponse**](PostAdminUsersDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **409** | Conflicto |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminActivityLogs

> GetAdminActivityLogsResponse mobileGetAdminActivityLogs(userId, limit)

Obtener el registro de actividad de los usuarios

Devuelve las entradas del registro de actividad ordenadas por fecha descendente, con filtro opcional por usuario. Paridad con la pestaña de actividad del admin web.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminActivityLogsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string | Identificador del usuario a filtrar. (optional)
    userId: userId_example,
    // number | Cantidad máxima de entradas a devolver. (optional)
    limit: 56,
  } satisfies MobileGetAdminActivityLogsRequest;

  try {
    const data = await api.mobileGetAdminActivityLogs(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | `string` | Identificador del usuario a filtrar. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de entradas a devolver. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAdminActivityLogsResponse**](GetAdminActivityLogsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminHealth

> AdminHealthResponse mobileGetAdminHealth()

Consultar salud del sistema

Devuelve métricas globales de la plataforma: total de usuarios reales por rol, empresas activas, sesiones vigentes y licencias con su estado de expiración. Incluye la tendencia de nuevos usuarios de los últimos 14 días con comparación entre semanas.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminHealthRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  try {
    const data = await api.mobileGetAdminHealth();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**AdminHealthResponse**](AdminHealthResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminLicenseStats

> GetAdminLicenseStatsResponse mobileGetAdminLicenseStats(search, planFilter, statusFilter, typeFilter)

Consultar métricas de licencias

Resume las licencias totales, activas, expiradas, de demostración, de prueba de administración y las próximas a vencer en los próximos siete días, respetando los filtros de la lista paginada.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminLicenseStatsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string | Búsqueda por identificador, empresa o responsable. (optional)
    search: search_example,
    // string | Filtro por plan. (optional)
    planFilter: planFilter_example,
    // string | Filtro por estado. (optional)
    statusFilter: statusFilter_example,
    // string | Filtro por tipo. (optional)
    typeFilter: typeFilter_example,
  } satisfies MobileGetAdminLicenseStatsRequest;

  try {
    const data = await api.mobileGetAdminLicenseStats(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **search** | `string` | Búsqueda por identificador, empresa o responsable. | [Optional] [Defaults to `undefined`] |
| **planFilter** | `string` | Filtro por plan. | [Optional] [Defaults to `undefined`] |
| **statusFilter** | `string` | Filtro por estado. | [Optional] [Defaults to `undefined`] |
| **typeFilter** | `string` | Filtro por tipo. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAdminLicenseStatsResponse**](GetAdminLicenseStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminLicenses

> GetAdminLicensesResponse mobileGetAdminLicenses(page, limit, sortBy, sortOrder, search, planFilter, statusFilter, typeFilter)

Listar licencias con filtros

Consulta paginada de licencias con búsqueda por identificador, empresa o responsable, y filtros por plan, estado y tipo. Permite ordenar por fecha, expiración, actividad, empresa o plan.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminLicensesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // number | Número de página. (optional)
    page: 56,
    // number | Elementos por página. (optional)
    limit: 56,
    // 'createdAt' | 'expiracion' | 'activa' | 'tenantId' | 'planId' | Campo de ordenamiento. (optional)
    sortBy: sortBy_example,
    // 'asc' | 'desc' | Dirección del ordenamiento. (optional)
    sortOrder: sortOrder_example,
    // string | Búsqueda por identificador, empresa o responsable. (optional)
    search: search_example,
    // string | Filtro por plan. (optional)
    planFilter: planFilter_example,
    // string | Filtro por estado. (optional)
    statusFilter: statusFilter_example,
    // string | Filtro por tipo. (optional)
    typeFilter: typeFilter_example,
  } satisfies MobileGetAdminLicensesRequest;

  try {
    const data = await api.mobileGetAdminLicenses(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` | Número de página. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Elementos por página. | [Optional] [Defaults to `undefined`] |
| **sortBy** | `createdAt`, `expiracion`, `activa`, `tenantId`, `planId` | Campo de ordenamiento. | [Optional] [Defaults to `undefined`] [Enum: createdAt, expiracion, activa, tenantId, planId] |
| **sortOrder** | `asc`, `desc` | Dirección del ordenamiento. | [Optional] [Defaults to `undefined`] [Enum: asc, desc] |
| **search** | `string` | Búsqueda por identificador, empresa o responsable. | [Optional] [Defaults to `undefined`] |
| **planFilter** | `string` | Filtro por plan. | [Optional] [Defaults to `undefined`] |
| **statusFilter** | `string` | Filtro por estado. | [Optional] [Defaults to `undefined`] |
| **typeFilter** | `string` | Filtro por tipo. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAdminLicensesResponse**](GetAdminLicensesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminPendingMemberships

> Array&lt;PendingMembershipItem&gt; mobileGetAdminPendingMemberships()

Listar solicitudes de membresía pendientes

Enumerar las solicitudes de membresía que aguardan aprobación, con los datos del solicitante y la empresa destino, ordenadas de la más reciente a la más antigua.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminPendingMembershipsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  try {
    const data = await api.mobileGetAdminPendingMemberships();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Array&lt;PendingMembershipItem&gt;**](PendingMembershipItem.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminSessions

> GetAdminSessionsResponse mobileGetAdminSessions()

Listar las sesiones registradas

Lista las sesiones registradas en la plataforma ordenadas por fecha descendente, con los datos del usuario. Paridad con la pestaña de sesiones del admin web.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminSessionsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  try {
    const data = await api.mobileGetAdminSessions();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**GetAdminSessionsResponse**](GetAdminSessionsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminTenantDetail

> GetAdminTenantDetailResponse mobileGetAdminTenantDetail(tenantId)

Obtener el detalle de una empresa

Devuelve la ficha completa de una empresa sin descargar la lista entera: datos fiscales, licencia vigente, miembros activos y conteos de usuarios, productos, almacenes y clientes.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminTenantDetailRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string | Identificador de la empresa.
    tenantId: tenantId_example,
  } satisfies MobileGetAdminTenantDetailRequest;

  try {
    const data = await api.mobileGetAdminTenantDetail(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **tenantId** | `string` | Identificador de la empresa. | [Defaults to `undefined`] |

### Return type

[**GetAdminTenantDetailResponse**](GetAdminTenantDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminTenantLicense

> GetAdminTenantLicenseResponse mobileGetAdminTenantLicense(tenantId)

Ver las licencias de una empresa

Devuelve el historial de licencias de una empresa ordenado por creación junto con la licencia vigente, si existe.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminTenantLicenseRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string | Identificador de la empresa.
    tenantId: tenantId_example,
  } satisfies MobileGetAdminTenantLicenseRequest;

  try {
    const data = await api.mobileGetAdminTenantLicense(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **tenantId** | `string` | Identificador de la empresa. | [Defaults to `undefined`] |

### Return type

[**GetAdminTenantLicenseResponse**](GetAdminTenantLicenseResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminTenantUsers

> GetAdminTenantUsersResponse mobileGetAdminTenantUsers(tenantId)

Listar los usuarios de una empresa

Lista los usuarios pertenecientes a una empresa con su rol operativo y el estado de su membresía, sin descargar el listado global.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminTenantUsersRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string | Identificador de la empresa.
    tenantId: tenantId_example,
  } satisfies MobileGetAdminTenantUsersRequest;

  try {
    const data = await api.mobileGetAdminTenantUsers(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **tenantId** | `string` | Identificador de la empresa. | [Defaults to `undefined`] |

### Return type

[**GetAdminTenantUsersResponse**](GetAdminTenantUsersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminTenants

> Array&lt;AdminTenantItem&gt; mobileGetAdminTenants()

Listar empresas de la plataforma

Enumera las empresas reales de la plataforma, excluyendo las cuentas de demostración, con su plan vigente, estado de licencia y conteo de usuarios, productos y almacenes.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminTenantsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  try {
    const data = await api.mobileGetAdminTenants();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Array&lt;AdminTenantItem&gt;**](AdminTenantItem.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminUserDetail

> GetAdminUserDetailResponse mobileGetAdminUserDetail(userId)

Obtener el detalle de un usuario

Devuelve la ficha completa de un usuario de la plataforma sin descargar la lista entera: datos personales, estado, verificación de email, membresías por empresa y conteo de sesiones activas.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminUserDetailRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string | Identificador del usuario a consultar.
    userId: userId_example,
  } satisfies MobileGetAdminUserDetailRequest;

  try {
    const data = await api.mobileGetAdminUserDetail(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | `string` | Identificador del usuario a consultar. | [Defaults to `undefined`] |

### Return type

[**GetAdminUserDetailResponse**](GetAdminUserDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminUserLoginHistory

> GetAdminUserLoginHistoryResponse mobileGetAdminUserLoginHistory(userId, limit)

Obtener el historial de sesiones de un usuario

Devuelve el historial de inicios de sesión de un usuario ordenado por fecha descendente. Paridad con el diálogo de historial del admin web.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminUserLoginHistoryRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string | Identificador del usuario.
    userId: userId_example,
    // number | Cantidad máxima de entradas a devolver. (optional)
    limit: 56,
  } satisfies MobileGetAdminUserLoginHistoryRequest;

  try {
    const data = await api.mobileGetAdminUserLoginHistory(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | `string` | Identificador del usuario. | [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de entradas a devolver. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAdminUserLoginHistoryResponse**](GetAdminUserLoginHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAdminUsers

> GetAdminUsersResponse mobileGetAdminUsers(tenantId, limit)

Listar usuarios de la plataforma

Lista los usuarios globales para el administrador de la plataforma o los integrantes de una empresa para un gestor. Permite acotar la consulta a una empresa mediante el identificador opcional.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAdminUsersRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string | Identificador de la empresa para acotar la consulta. (optional)
    tenantId: tenantId_example,
    // number | Cantidad máxima de usuarios. (optional)
    limit: 56,
  } satisfies MobileGetAdminUsersRequest;

  try {
    const data = await api.mobileGetAdminUsers(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **tenantId** | `string` | Identificador de la empresa para acotar la consulta. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de usuarios. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAdminUsersResponse**](GetAdminUsersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileLockAdminUser

> PostAdminUsersLockResponse mobileLockAdminUser(lockAdminUserRequest)

Bloquear usuario por 24 horas

Bloquea temporalmente a un usuario de la plataforma durante 24 horas, previniendo nuevos inicios de sesión. Devuelve el estado actualizado del bloqueo y su mensaje de confirmación.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileLockAdminUserRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // LockAdminUserRequest
    lockAdminUserRequest: ...,
  } satisfies MobileLockAdminUserRequest;

  try {
    const data = await api.mobileLockAdminUser(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **lockAdminUserRequest** | [LockAdminUserRequest](LockAdminUserRequest.md) |  | |

### Return type

[**PostAdminUsersLockResponse**](PostAdminUsersLockResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileRejectAdminMembership

> PostAdminMembershipsRejectResponse mobileRejectAdminMembership(rejectAdminMembershipRequest)

Rechazar solicitud de membresía

Rechaza una solicitud de membresía pendiente, elimina la solicitud y devuelve al solicitante a la etapa de selección de empresa para que pueda volver a elegir.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileRejectAdminMembershipRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // RejectAdminMembershipRequest
    rejectAdminMembershipRequest: ...,
  } satisfies MobileRejectAdminMembershipRequest;

  try {
    const data = await api.mobileRejectAdminMembership(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **rejectAdminMembershipRequest** | [RejectAdminMembershipRequest](RejectAdminMembershipRequest.md) |  | |

### Return type

[**PostAdminMembershipsRejectResponse**](PostAdminMembershipsRejectResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileRemoveAdminTenantUser

> PostAdminTenantsRemoveUserResponse mobileRemoveAdminTenantUser(adminRemoveTenantUserRequest)

Quitar un usuario de una empresa

Quita un usuario de una empresa desactivando su membresía, sin eliminar su cuenta de la plataforma. Es reversible reasignándolo.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileRemoveAdminTenantUserRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminRemoveTenantUserRequest
    adminRemoveTenantUserRequest: ...,
  } satisfies MobileRemoveAdminTenantUserRequest;

  try {
    const data = await api.mobileRemoveAdminTenantUser(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminRemoveTenantUserRequest** | [AdminRemoveTenantUserRequest](AdminRemoveTenantUserRequest.md) |  | |

### Return type

[**PostAdminTenantsRemoveUserResponse**](PostAdminTenantsRemoveUserResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **409** | Conflicto |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileRenewAdminLicense

> PostAdminLicensesRenewResponse mobileRenewAdminLicense(renewAdminLicenseRequest)

Renovar una licencia

Renueva una licencia extendiendo su expiración según la duración del plan indicado (o el actual), sincronizando límites y reactivando a los usuarios de la empresa. No registra pagos; el registro de pagos se hace desde la web.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileRenewAdminLicenseRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // RenewAdminLicenseRequest
    renewAdminLicenseRequest: ...,
  } satisfies MobileRenewAdminLicenseRequest;

  try {
    const data = await api.mobileRenewAdminLicense(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **renewAdminLicenseRequest** | [RenewAdminLicenseRequest](RenewAdminLicenseRequest.md) |  | |

### Return type

[**PostAdminLicensesRenewResponse**](PostAdminLicensesRenewResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileResendAdminUserVerification

> PostAdminUsersResendVerificationResponse mobileResendAdminUserVerification(adminUserIdRequest)

Reenviar el email de verificación

Genera un nuevo enlace de verificación y lo reenvía al correo del usuario. Falla si el correo ya fue verificado previamente.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileResendAdminUserVerificationRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminUserIdRequest
    adminUserIdRequest: ...,
  } satisfies MobileResendAdminUserVerificationRequest;

  try {
    const data = await api.mobileResendAdminUserVerification(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminUserIdRequest** | [AdminUserIdRequest](AdminUserIdRequest.md) |  | |

### Return type

[**PostAdminUsersResendVerificationResponse**](PostAdminUsersResendVerificationResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **409** | Conflicto |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileResetAdminUserPassword

> PostAdminUsersResetPasswordResponse mobileResetAdminUserPassword(adminUserIdRequest)

Enviar enlace de restablecimiento de contraseña

Genera un enlace temporal de restablecimiento de contraseña y lo envía al correo del usuario. El administrador nunca ve ni define la contraseña del usuario.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileResetAdminUserPasswordRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminUserIdRequest
    adminUserIdRequest: ...,
  } satisfies MobileResetAdminUserPasswordRequest;

  try {
    const data = await api.mobileResetAdminUserPassword(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminUserIdRequest** | [AdminUserIdRequest](AdminUserIdRequest.md) |  | |

### Return type

[**PostAdminUsersResetPasswordResponse**](PostAdminUsersResetPasswordResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileRevokeAdminSession

> PostAdminSessionsRevokeResponse mobileRevokeAdminSession(adminRevokeSessionRequest)

Revocar una sesión específica

Revoca una sesión puntual de un usuario, cerrando su acceso en ese dispositivo. A diferencia de la acción web equivalente, elimina por el identificador real de la sesión.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileRevokeAdminSessionRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminRevokeSessionRequest
    adminRevokeSessionRequest: ...,
  } satisfies MobileRevokeAdminSessionRequest;

  try {
    const data = await api.mobileRevokeAdminSession(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminRevokeSessionRequest** | [AdminRevokeSessionRequest](AdminRevokeSessionRequest.md) |  | |

### Return type

[**PostAdminSessionsRevokeResponse**](PostAdminSessionsRevokeResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileRevokeAdminUserSessions

> PostAdminUsersRevokeSessionsResponse mobileRevokeAdminUserSessions(adminUserIdRequest)

Revocar las sesiones activas de un usuario

Invalida todas las sesiones activas del usuario, forzando un nuevo inicio de sesión en cada dispositivo donde estuviera conectado.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileRevokeAdminUserSessionsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminUserIdRequest
    adminUserIdRequest: ...,
  } satisfies MobileRevokeAdminUserSessionsRequest;

  try {
    const data = await api.mobileRevokeAdminUserSessions(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminUserIdRequest** | [AdminUserIdRequest](AdminUserIdRequest.md) |  | |

### Return type

[**PostAdminUsersRevokeSessionsResponse**](PostAdminUsersRevokeSessionsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileUnlockAdminUser

> PostAdminUsersLockResponse mobileUnlockAdminUser(unlockAdminUserRequest)

Desbloquear usuario

Desbloquea a un usuario de la plataforma y reinicia sus intentos de inicio de sesión. Devuelve el estado actualizado y su mensaje de confirmación.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileUnlockAdminUserRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // UnlockAdminUserRequest
    unlockAdminUserRequest: ...,
  } satisfies MobileUnlockAdminUserRequest;

  try {
    const data = await api.mobileUnlockAdminUser(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **unlockAdminUserRequest** | [UnlockAdminUserRequest](UnlockAdminUserRequest.md) |  | |

### Return type

[**PostAdminUsersLockResponse**](PostAdminUsersLockResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileUpdateAdminTenant

> PatchAdminTenantsUpdateResponse mobileUpdateAdminTenant(updateAdminTenantRequest)

Editar los datos de una empresa

Actualiza el nombre, los datos fiscales y la configuración de una empresa. Valida que el identificador público no esté en uso por otra empresa.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileUpdateAdminTenantRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // UpdateAdminTenantRequest
    updateAdminTenantRequest: ...,
  } satisfies MobileUpdateAdminTenantRequest;

  try {
    const data = await api.mobileUpdateAdminTenant(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **updateAdminTenantRequest** | [UpdateAdminTenantRequest](UpdateAdminTenantRequest.md) |  | |

### Return type

[**PatchAdminTenantsUpdateResponse**](PatchAdminTenantsUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **409** | Conflicto |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileUpdateAdminTenantLicense

> PatchAdminTenantsLicenseUpdateResponse mobileUpdateAdminTenantLicense(updateAdminTenantLicenseRequest)

Actualizar la licencia de una empresa

Cambia el plan, los límites o el vencimiento de una licencia. Al cambiar de plan se sincronizan límites y precios del plan, salvo los límites indicados explícitamente.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileUpdateAdminTenantLicenseRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // UpdateAdminTenantLicenseRequest
    updateAdminTenantLicenseRequest: ...,
  } satisfies MobileUpdateAdminTenantLicenseRequest;

  try {
    const data = await api.mobileUpdateAdminTenantLicense(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **updateAdminTenantLicenseRequest** | [UpdateAdminTenantLicenseRequest](UpdateAdminTenantLicenseRequest.md) |  | |

### Return type

[**PatchAdminTenantsLicenseUpdateResponse**](PatchAdminTenantsLicenseUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileUpdateAdminUser

> PatchAdminUsersUpdateResponse mobileUpdateAdminUser(updateAdminUserRequest)

Editar nombre, email o rol de un usuario

Actualiza los datos básicos de un usuario: nombre, correo electrónico o rol de plataforma. Valida que el correo no esté en uso por otro usuario y protege al último administrador activo.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileUpdateAdminUserRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // UpdateAdminUserRequest
    updateAdminUserRequest: ...,
  } satisfies MobileUpdateAdminUserRequest;

  try {
    const data = await api.mobileUpdateAdminUser(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **updateAdminUserRequest** | [UpdateAdminUserRequest](UpdateAdminUserRequest.md) |  | |

### Return type

[**PatchAdminUsersUpdateResponse**](PatchAdminUsersUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **409** | Conflicto |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileVerifyAdminUserEmail

> PostAdminUsersVerifyEmailResponse mobileVerifyAdminUserEmail(adminUserIdRequest)

Marcar el email como verificado

Marca manualmente el correo de un usuario como verificado, sin necesidad de que complete el flujo de verificación por email. Es idempotente si ya estaba verificado.

### Example

```ts
import {
  Configuration,
  AdminApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileVerifyAdminUserEmailRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // AdminUserIdRequest
    adminUserIdRequest: ...,
  } satisfies MobileVerifyAdminUserEmailRequest;

  try {
    const data = await api.mobileVerifyAdminUserEmail(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **adminUserIdRequest** | [AdminUserIdRequest](AdminUserIdRequest.md) |  | |

### Return type

[**PostAdminUsersVerifyEmailResponse**](PostAdminUsersVerifyEmailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

