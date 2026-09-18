# AdminAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileApproveAdminMembership**](AdminAPI.md#mobileapproveadminmembership) | **POST** /admin/memberships/approve | Aprobar solicitud de membresía
[**mobileGetAdminHealth**](AdminAPI.md#mobilegetadminhealth) | **GET** /admin/health | Consultar salud del sistema
[**mobileGetAdminLicenseStats**](AdminAPI.md#mobilegetadminlicensestats) | **GET** /admin/licenses/stats | Consultar métricas de licencias
[**mobileGetAdminLicenses**](AdminAPI.md#mobilegetadminlicenses) | **GET** /admin/licenses | Listar licencias con filtros
[**mobileGetAdminPendingMemberships**](AdminAPI.md#mobilegetadminpendingmemberships) | **GET** /admin/memberships/pending | Listar solicitudes de membresía pendientes
[**mobileGetAdminTenants**](AdminAPI.md#mobilegetadmintenants) | **GET** /admin/tenants | Listar empresas de la plataforma
[**mobileGetAdminUsers**](AdminAPI.md#mobilegetadminusers) | **GET** /admin/users | Listar usuarios de la plataforma
[**mobileLockAdminUser**](AdminAPI.md#mobilelockadminuser) | **POST** /admin/users/lock | Bloquear usuario por 24 horas
[**mobileRejectAdminMembership**](AdminAPI.md#mobilerejectadminmembership) | **POST** /admin/memberships/reject | Rechazar solicitud de membresía
[**mobileUnlockAdminUser**](AdminAPI.md#mobileunlockadminuser) | **POST** /admin/users/unlock | Desbloquear usuario


# **mobileApproveAdminMembership**
```swift
    open class func mobileApproveAdminMembership(approveAdminMembershipRequest: ApproveAdminMembershipRequest, completion: @escaping (_ data: PostAdminMembershipsApproveResponse?, _ error: Error?) -> Void)
```

Aprobar solicitud de membresía

Aprueba una solicitud de membresía pendiente, activa al usuario, cierra su flujo de incorporación y crea su registro de empleado en la empresa cuando aún no existe.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let approveAdminMembershipRequest = ApproveAdminMembershipRequest(membershipId: "membershipId_example", tenantRole: "tenantRole_example") // ApproveAdminMembershipRequest | 

// Aprobar solicitud de membresía
AdminAPI.mobileApproveAdminMembership(approveAdminMembershipRequest: approveAdminMembershipRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **approveAdminMembershipRequest** | [**ApproveAdminMembershipRequest**](ApproveAdminMembershipRequest.md) |  | 

### Return type

[**PostAdminMembershipsApproveResponse**](PostAdminMembershipsApproveResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminHealth**
```swift
    open class func mobileGetAdminHealth(completion: @escaping (_ data: AdminHealthResponse?, _ error: Error?) -> Void)
```

Consultar salud del sistema

Devuelve métricas globales de la plataforma: total de usuarios reales por rol, empresas activas, sesiones vigentes y licencias con su estado de expiración. Incluye la tendencia de nuevos usuarios de los últimos 14 días con comparación entre semanas.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar salud del sistema
AdminAPI.mobileGetAdminHealth() { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AdminHealthResponse**](AdminHealthResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminLicenseStats**
```swift
    open class func mobileGetAdminLicenseStats(search: String? = nil, planFilter: String? = nil, statusFilter: String? = nil, typeFilter: String? = nil, completion: @escaping (_ data: GetAdminLicenseStatsResponse?, _ error: Error?) -> Void)
```

Consultar métricas de licencias

Resume las licencias totales, activas, expiradas, de demostración, de prueba de administración y las próximas a vencer en los próximos siete días, respetando los filtros de la lista paginada.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let search = "search_example" // String | Búsqueda por identificador, empresa o responsable. (optional)
let planFilter = "planFilter_example" // String | Filtro por plan. (optional)
let statusFilter = "statusFilter_example" // String | Filtro por estado. (optional)
let typeFilter = "typeFilter_example" // String | Filtro por tipo. (optional)

// Consultar métricas de licencias
AdminAPI.mobileGetAdminLicenseStats(search: search, planFilter: planFilter, statusFilter: statusFilter, typeFilter: typeFilter) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **search** | **String** | Búsqueda por identificador, empresa o responsable. | [optional] 
 **planFilter** | **String** | Filtro por plan. | [optional] 
 **statusFilter** | **String** | Filtro por estado. | [optional] 
 **typeFilter** | **String** | Filtro por tipo. | [optional] 

### Return type

[**GetAdminLicenseStatsResponse**](GetAdminLicenseStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminLicenses**
```swift
    open class func mobileGetAdminLicenses(page: Int? = nil, limit: Int? = nil, sortBy: SortBy_mobileGetAdminLicenses? = nil, sortOrder: SortOrder_mobileGetAdminLicenses? = nil, search: String? = nil, planFilter: String? = nil, statusFilter: String? = nil, typeFilter: String? = nil, completion: @escaping (_ data: GetAdminLicensesResponse?, _ error: Error?) -> Void)
```

Listar licencias con filtros

Consulta paginada de licencias con búsqueda por identificador, empresa o responsable, y filtros por plan, estado y tipo. Permite ordenar por fecha, expiración, actividad, empresa o plan.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let page = 987 // Int | Número de página. (optional)
let limit = 987 // Int | Elementos por página. (optional)
let sortBy = "sortBy_example" // String | Campo de ordenamiento. (optional)
let sortOrder = "sortOrder_example" // String | Dirección del ordenamiento. (optional)
let search = "search_example" // String | Búsqueda por identificador, empresa o responsable. (optional)
let planFilter = "planFilter_example" // String | Filtro por plan. (optional)
let statusFilter = "statusFilter_example" // String | Filtro por estado. (optional)
let typeFilter = "typeFilter_example" // String | Filtro por tipo. (optional)

// Listar licencias con filtros
AdminAPI.mobileGetAdminLicenses(page: page, limit: limit, sortBy: sortBy, sortOrder: sortOrder, search: search, planFilter: planFilter, statusFilter: statusFilter, typeFilter: typeFilter) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **Int** | Número de página. | [optional] 
 **limit** | **Int** | Elementos por página. | [optional] 
 **sortBy** | **String** | Campo de ordenamiento. | [optional] 
 **sortOrder** | **String** | Dirección del ordenamiento. | [optional] 
 **search** | **String** | Búsqueda por identificador, empresa o responsable. | [optional] 
 **planFilter** | **String** | Filtro por plan. | [optional] 
 **statusFilter** | **String** | Filtro por estado. | [optional] 
 **typeFilter** | **String** | Filtro por tipo. | [optional] 

### Return type

[**GetAdminLicensesResponse**](GetAdminLicensesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminPendingMemberships**
```swift
    open class func mobileGetAdminPendingMemberships(completion: @escaping (_ data: [PendingMembershipItem]?, _ error: Error?) -> Void)
```

Listar solicitudes de membresía pendientes

Enumerar las solicitudes de membresía que aguardan aprobación, con los datos del solicitante y la empresa destino, ordenadas de la más reciente a la más antigua.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar solicitudes de membresía pendientes
AdminAPI.mobileGetAdminPendingMemberships() { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**[PendingMembershipItem]**](PendingMembershipItem.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminTenants**
```swift
    open class func mobileGetAdminTenants(completion: @escaping (_ data: [AdminTenantItem]?, _ error: Error?) -> Void)
```

Listar empresas de la plataforma

Enumera las empresas reales de la plataforma, excluyendo las cuentas de demostración, con su plan vigente, estado de licencia y conteo de usuarios, productos y almacenes.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar empresas de la plataforma
AdminAPI.mobileGetAdminTenants() { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**[AdminTenantItem]**](AdminTenantItem.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminUsers**
```swift
    open class func mobileGetAdminUsers(tenantId: String? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAdminUsersResponse?, _ error: Error?) -> Void)
```

Listar usuarios de la plataforma

Lista los usuarios globales para el administrador de la plataforma o los integrantes de una empresa para un gestor. Permite acotar la consulta a una empresa mediante el identificador opcional.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let tenantId = "tenantId_example" // String | Identificador de la empresa para acotar la consulta. (optional)
let limit = 987 // Int | Cantidad máxima de usuarios. (optional)

// Listar usuarios de la plataforma
AdminAPI.mobileGetAdminUsers(tenantId: tenantId, limit: limit) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tenantId** | **String** | Identificador de la empresa para acotar la consulta. | [optional] 
 **limit** | **Int** | Cantidad máxima de usuarios. | [optional] 

### Return type

[**GetAdminUsersResponse**](GetAdminUsersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileLockAdminUser**
```swift
    open class func mobileLockAdminUser(lockAdminUserRequest: LockAdminUserRequest, completion: @escaping (_ data: PostAdminUsersLockResponse?, _ error: Error?) -> Void)
```

Bloquear usuario por 24 horas

Bloquea temporalmente a un usuario de la plataforma durante 24 horas, previniendo nuevos inicios de sesión. Devuelve el estado actualizado del bloqueo y su mensaje de confirmación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let lockAdminUserRequest = LockAdminUserRequest(userId: "userId_example") // LockAdminUserRequest | 

// Bloquear usuario por 24 horas
AdminAPI.mobileLockAdminUser(lockAdminUserRequest: lockAdminUserRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **lockAdminUserRequest** | [**LockAdminUserRequest**](LockAdminUserRequest.md) |  | 

### Return type

[**PostAdminUsersLockResponse**](PostAdminUsersLockResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileRejectAdminMembership**
```swift
    open class func mobileRejectAdminMembership(rejectAdminMembershipRequest: RejectAdminMembershipRequest, completion: @escaping (_ data: PostAdminMembershipsRejectResponse?, _ error: Error?) -> Void)
```

Rechazar solicitud de membresía

Rechaza una solicitud de membresía pendiente, elimina la solicitud y devuelve al solicitante a la etapa de selección de empresa para que pueda volver a elegir.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let rejectAdminMembershipRequest = RejectAdminMembershipRequest(membershipId: "membershipId_example") // RejectAdminMembershipRequest | 

// Rechazar solicitud de membresía
AdminAPI.mobileRejectAdminMembership(rejectAdminMembershipRequest: rejectAdminMembershipRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **rejectAdminMembershipRequest** | [**RejectAdminMembershipRequest**](RejectAdminMembershipRequest.md) |  | 

### Return type

[**PostAdminMembershipsRejectResponse**](PostAdminMembershipsRejectResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileUnlockAdminUser**
```swift
    open class func mobileUnlockAdminUser(unlockAdminUserRequest: UnlockAdminUserRequest, completion: @escaping (_ data: PostAdminUsersLockResponse?, _ error: Error?) -> Void)
```

Desbloquear usuario

Desbloquea a un usuario de la plataforma y reinicia sus intentos de inicio de sesión. Devuelve el estado actualizado y su mensaje de confirmación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let unlockAdminUserRequest = UnlockAdminUserRequest(userId: "userId_example") // UnlockAdminUserRequest | 

// Desbloquear usuario
AdminAPI.mobileUnlockAdminUser(unlockAdminUserRequest: unlockAdminUserRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **unlockAdminUserRequest** | [**UnlockAdminUserRequest**](UnlockAdminUserRequest.md) |  | 

### Return type

[**PostAdminUsersLockResponse**](PostAdminUsersLockResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

