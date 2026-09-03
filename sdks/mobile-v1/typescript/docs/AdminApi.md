# AdminApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileApproveAdminMembership**](AdminApi.md#mobileapproveadminmembership) | **POST** /admin/memberships/approve | Aprobar solicitud de membresía |
| [**mobileGetAdminHealth**](AdminApi.md#mobilegetadminhealth) | **GET** /admin/health | Consultar salud del sistema |
| [**mobileGetAdminLicenseStats**](AdminApi.md#mobilegetadminlicensestats) | **GET** /admin/licenses/stats | Consultar métricas de licencias |
| [**mobileGetAdminLicenses**](AdminApi.md#mobilegetadminlicenses) | **GET** /admin/licenses | Listar licencias con filtros |
| [**mobileGetAdminPendingMemberships**](AdminApi.md#mobilegetadminpendingmemberships) | **GET** /admin/memberships/pending | Listar solicitudes de membresía pendientes |
| [**mobileGetAdminTenants**](AdminApi.md#mobilegetadmintenants) | **GET** /admin/tenants | Listar empresas de la plataforma |
| [**mobileGetAdminUsers**](AdminApi.md#mobilegetadminusers) | **GET** /admin/users | Listar usuarios de la plataforma |
| [**mobileLockAdminUser**](AdminApi.md#mobilelockadminuser) | **POST** /admin/users/lock | Bloquear usuario por 24 horas |
| [**mobileRejectAdminMembership**](AdminApi.md#mobilerejectadminmembership) | **POST** /admin/memberships/reject | Rechazar solicitud de membresía |
| [**mobileUnlockAdminUser**](AdminApi.md#mobileunlockadminuser) | **POST** /admin/users/unlock | Desbloquear usuario |



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

