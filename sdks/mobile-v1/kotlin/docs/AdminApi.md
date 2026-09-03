# AdminApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileApproveAdminMembership**](AdminApi.md#mobileApproveAdminMembership) | **POST** /admin/memberships/approve | Aprobar solicitud de membresía |
| [**mobileGetAdminHealth**](AdminApi.md#mobileGetAdminHealth) | **GET** /admin/health | Consultar salud del sistema |
| [**mobileGetAdminLicenseStats**](AdminApi.md#mobileGetAdminLicenseStats) | **GET** /admin/licenses/stats | Consultar métricas de licencias |
| [**mobileGetAdminLicenses**](AdminApi.md#mobileGetAdminLicenses) | **GET** /admin/licenses | Listar licencias con filtros |
| [**mobileGetAdminPendingMemberships**](AdminApi.md#mobileGetAdminPendingMemberships) | **GET** /admin/memberships/pending | Listar solicitudes de membresía pendientes |
| [**mobileGetAdminTenants**](AdminApi.md#mobileGetAdminTenants) | **GET** /admin/tenants | Listar empresas de la plataforma |
| [**mobileGetAdminUsers**](AdminApi.md#mobileGetAdminUsers) | **GET** /admin/users | Listar usuarios de la plataforma |
| [**mobileLockAdminUser**](AdminApi.md#mobileLockAdminUser) | **POST** /admin/users/lock | Bloquear usuario por 24 horas |
| [**mobileRejectAdminMembership**](AdminApi.md#mobileRejectAdminMembership) | **POST** /admin/memberships/reject | Rechazar solicitud de membresía |
| [**mobileUnlockAdminUser**](AdminApi.md#mobileUnlockAdminUser) | **POST** /admin/users/unlock | Desbloquear usuario |


<a id="mobileApproveAdminMembership"></a>
# **mobileApproveAdminMembership**
> PostAdminMembershipsApproveResponse mobileApproveAdminMembership(approveAdminMembershipRequest)

Aprobar solicitud de membresía

Aprueba una solicitud de membresía pendiente, activa al usuario, cierra su flujo de incorporación y crea su registro de empleado en la empresa cuando aún no existe.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val approveAdminMembershipRequest : ApproveAdminMembershipRequest =  // ApproveAdminMembershipRequest | 
try {
    val result : PostAdminMembershipsApproveResponse = apiInstance.mobileApproveAdminMembership(approveAdminMembershipRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileApproveAdminMembership")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileApproveAdminMembership")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **approveAdminMembershipRequest** | [**ApproveAdminMembershipRequest**](ApproveAdminMembershipRequest.md)|  | |

### Return type

[**PostAdminMembershipsApproveResponse**](PostAdminMembershipsApproveResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileGetAdminHealth"></a>
# **mobileGetAdminHealth**
> AdminHealthResponse mobileGetAdminHealth()

Consultar salud del sistema

Devuelve métricas globales de la plataforma: total de usuarios reales por rol, empresas activas, sesiones vigentes y licencias con su estado de expiración. Incluye la tendencia de nuevos usuarios de los últimos 14 días con comparación entre semanas.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
try {
    val result : AdminHealthResponse = apiInstance.mobileGetAdminHealth()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminHealth")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminHealth")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AdminHealthResponse**](AdminHealthResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAdminLicenseStats"></a>
# **mobileGetAdminLicenseStats**
> GetAdminLicenseStatsResponse mobileGetAdminLicenseStats(search, planFilter, statusFilter, typeFilter)

Consultar métricas de licencias

Resume las licencias totales, activas, expiradas, de demostración, de prueba de administración y las próximas a vencer en los próximos siete días, respetando los filtros de la lista paginada.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val search : kotlin.String = search_example // kotlin.String | Búsqueda por identificador, empresa o responsable.
val planFilter : kotlin.String = planFilter_example // kotlin.String | Filtro por plan.
val statusFilter : kotlin.String = statusFilter_example // kotlin.String | Filtro por estado.
val typeFilter : kotlin.String = typeFilter_example // kotlin.String | Filtro por tipo.
try {
    val result : GetAdminLicenseStatsResponse = apiInstance.mobileGetAdminLicenseStats(search, planFilter, statusFilter, typeFilter)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminLicenseStats")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminLicenseStats")
    e.printStackTrace()
}
```

### Parameters
| **search** | **kotlin.String**| Búsqueda por identificador, empresa o responsable. | [optional] |
| **planFilter** | **kotlin.String**| Filtro por plan. | [optional] |
| **statusFilter** | **kotlin.String**| Filtro por estado. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **typeFilter** | **kotlin.String**| Filtro por tipo. | [optional] |

### Return type

[**GetAdminLicenseStatsResponse**](GetAdminLicenseStatsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAdminLicenses"></a>
# **mobileGetAdminLicenses**
> GetAdminLicensesResponse mobileGetAdminLicenses(page, limit, sortBy, sortOrder, search, planFilter, statusFilter, typeFilter)

Listar licencias con filtros

Consulta paginada de licencias con búsqueda por identificador, empresa o responsable, y filtros por plan, estado y tipo. Permite ordenar por fecha, expiración, actividad, empresa o plan.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val page : kotlin.Int = 56 // kotlin.Int | Número de página.
val limit : kotlin.Int = 56 // kotlin.Int | Elementos por página.
val sortBy : kotlin.String = sortBy_example // kotlin.String | Campo de ordenamiento.
val sortOrder : kotlin.String = sortOrder_example // kotlin.String | Dirección del ordenamiento.
val search : kotlin.String = search_example // kotlin.String | Búsqueda por identificador, empresa o responsable.
val planFilter : kotlin.String = planFilter_example // kotlin.String | Filtro por plan.
val statusFilter : kotlin.String = statusFilter_example // kotlin.String | Filtro por estado.
val typeFilter : kotlin.String = typeFilter_example // kotlin.String | Filtro por tipo.
try {
    val result : GetAdminLicensesResponse = apiInstance.mobileGetAdminLicenses(page, limit, sortBy, sortOrder, search, planFilter, statusFilter, typeFilter)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminLicenses")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminLicenses")
    e.printStackTrace()
}
```

### Parameters
| **page** | **kotlin.Int**| Número de página. | [optional] |
| **limit** | **kotlin.Int**| Elementos por página. | [optional] |
| **sortBy** | **kotlin.String**| Campo de ordenamiento. | [optional] [enum: createdAt, expiracion, activa, tenantId, planId] |
| **sortOrder** | **kotlin.String**| Dirección del ordenamiento. | [optional] [enum: asc, desc] |
| **search** | **kotlin.String**| Búsqueda por identificador, empresa o responsable. | [optional] |
| **planFilter** | **kotlin.String**| Filtro por plan. | [optional] |
| **statusFilter** | **kotlin.String**| Filtro por estado. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **typeFilter** | **kotlin.String**| Filtro por tipo. | [optional] |

### Return type

[**GetAdminLicensesResponse**](GetAdminLicensesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAdminPendingMemberships"></a>
# **mobileGetAdminPendingMemberships**
> kotlin.collections.List&lt;PendingMembershipItem&gt; mobileGetAdminPendingMemberships()

Listar solicitudes de membresía pendientes

Enumerar las solicitudes de membresía que aguardan aprobación, con los datos del solicitante y la empresa destino, ordenadas de la más reciente a la más antigua.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
try {
    val result : kotlin.collections.List<PendingMembershipItem> = apiInstance.mobileGetAdminPendingMemberships()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminPendingMemberships")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminPendingMemberships")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**kotlin.collections.List&lt;PendingMembershipItem&gt;**](PendingMembershipItem.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAdminTenants"></a>
# **mobileGetAdminTenants**
> kotlin.collections.List&lt;AdminTenantItem&gt; mobileGetAdminTenants()

Listar empresas de la plataforma

Enumera las empresas reales de la plataforma, excluyendo las cuentas de demostración, con su plan vigente, estado de licencia y conteo de usuarios, productos y almacenes.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
try {
    val result : kotlin.collections.List<AdminTenantItem> = apiInstance.mobileGetAdminTenants()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminTenants")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminTenants")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**kotlin.collections.List&lt;AdminTenantItem&gt;**](AdminTenantItem.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAdminUsers"></a>
# **mobileGetAdminUsers**
> GetAdminUsersResponse mobileGetAdminUsers(tenantId, limit)

Listar usuarios de la plataforma

Lista los usuarios globales para el administrador de la plataforma o los integrantes de una empresa para un gestor. Permite acotar la consulta a una empresa mediante el identificador opcional.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val tenantId : kotlin.String = tenantId_example // kotlin.String | Identificador de la empresa para acotar la consulta.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de usuarios.
try {
    val result : GetAdminUsersResponse = apiInstance.mobileGetAdminUsers(tenantId, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminUsers")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminUsers")
    e.printStackTrace()
}
```

### Parameters
| **tenantId** | **kotlin.String**| Identificador de la empresa para acotar la consulta. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de usuarios. | [optional] |

### Return type

[**GetAdminUsersResponse**](GetAdminUsersResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileLockAdminUser"></a>
# **mobileLockAdminUser**
> PostAdminUsersLockResponse mobileLockAdminUser(lockAdminUserRequest)

Bloquear usuario por 24 horas

Bloquea temporalmente a un usuario de la plataforma durante 24 horas, previniendo nuevos inicios de sesión. Devuelve el estado actualizado del bloqueo y su mensaje de confirmación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val lockAdminUserRequest : LockAdminUserRequest =  // LockAdminUserRequest | 
try {
    val result : PostAdminUsersLockResponse = apiInstance.mobileLockAdminUser(lockAdminUserRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileLockAdminUser")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileLockAdminUser")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **lockAdminUserRequest** | [**LockAdminUserRequest**](LockAdminUserRequest.md)|  | |

### Return type

[**PostAdminUsersLockResponse**](PostAdminUsersLockResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileRejectAdminMembership"></a>
# **mobileRejectAdminMembership**
> PostAdminMembershipsRejectResponse mobileRejectAdminMembership(rejectAdminMembershipRequest)

Rechazar solicitud de membresía

Rechaza una solicitud de membresía pendiente, elimina la solicitud y devuelve al solicitante a la etapa de selección de empresa para que pueda volver a elegir.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val rejectAdminMembershipRequest : RejectAdminMembershipRequest =  // RejectAdminMembershipRequest | 
try {
    val result : PostAdminMembershipsRejectResponse = apiInstance.mobileRejectAdminMembership(rejectAdminMembershipRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileRejectAdminMembership")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileRejectAdminMembership")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **rejectAdminMembershipRequest** | [**RejectAdminMembershipRequest**](RejectAdminMembershipRequest.md)|  | |

### Return type

[**PostAdminMembershipsRejectResponse**](PostAdminMembershipsRejectResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileUnlockAdminUser"></a>
# **mobileUnlockAdminUser**
> PostAdminUsersLockResponse mobileUnlockAdminUser(unlockAdminUserRequest)

Desbloquear usuario

Desbloquea a un usuario de la plataforma y reinicia sus intentos de inicio de sesión. Devuelve el estado actualizado y su mensaje de confirmación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val unlockAdminUserRequest : UnlockAdminUserRequest =  // UnlockAdminUserRequest | 
try {
    val result : PostAdminUsersLockResponse = apiInstance.mobileUnlockAdminUser(unlockAdminUserRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileUnlockAdminUser")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileUnlockAdminUser")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **unlockAdminUserRequest** | [**UnlockAdminUserRequest**](UnlockAdminUserRequest.md)|  | |

### Return type

[**PostAdminUsersLockResponse**](PostAdminUsersLockResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

