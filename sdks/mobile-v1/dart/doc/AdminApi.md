# tcp_mobile_v1_sdk.api.AdminApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileApproveAdminMembership**](AdminApi.md#mobileapproveadminmembership) | **POST** /admin/memberships/approve | Aprobar solicitud de membresía
[**mobileGetAdminHealth**](AdminApi.md#mobilegetadminhealth) | **GET** /admin/health | Consultar salud del sistema
[**mobileGetAdminLicenseStats**](AdminApi.md#mobilegetadminlicensestats) | **GET** /admin/licenses/stats | Consultar métricas de licencias
[**mobileGetAdminLicenses**](AdminApi.md#mobilegetadminlicenses) | **GET** /admin/licenses | Listar licencias con filtros
[**mobileGetAdminPendingMemberships**](AdminApi.md#mobilegetadminpendingmemberships) | **GET** /admin/memberships/pending | Listar solicitudes de membresía pendientes
[**mobileGetAdminTenants**](AdminApi.md#mobilegetadmintenants) | **GET** /admin/tenants | Listar empresas de la plataforma
[**mobileGetAdminUsers**](AdminApi.md#mobilegetadminusers) | **GET** /admin/users | Listar usuarios de la plataforma
[**mobileLockAdminUser**](AdminApi.md#mobilelockadminuser) | **POST** /admin/users/lock | Bloquear usuario por 24 horas
[**mobileRejectAdminMembership**](AdminApi.md#mobilerejectadminmembership) | **POST** /admin/memberships/reject | Rechazar solicitud de membresía
[**mobileUnlockAdminUser**](AdminApi.md#mobileunlockadminuser) | **POST** /admin/users/unlock | Desbloquear usuario


# **mobileApproveAdminMembership**
> PostAdminMembershipsApproveResponse mobileApproveAdminMembership(approveAdminMembershipRequest)

Aprobar solicitud de membresía

Aprueba una solicitud de membresía pendiente, activa al usuario, cierra su flujo de incorporación y crea su registro de empleado en la empresa cuando aún no existe.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AdminApi();
final approveAdminMembershipRequest = ApproveAdminMembershipRequest(); // ApproveAdminMembershipRequest | 

try {
    final result = api_instance.mobileApproveAdminMembership(approveAdminMembershipRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileApproveAdminMembership: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **approveAdminMembershipRequest** | [**ApproveAdminMembershipRequest**](ApproveAdminMembershipRequest.md)|  | 

### Return type

[**PostAdminMembershipsApproveResponse**](PostAdminMembershipsApproveResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminHealth**
> AdminHealthResponse mobileGetAdminHealth()

Consultar salud del sistema

Devuelve métricas globales de la plataforma: total de usuarios reales por rol, empresas activas, sesiones vigentes y licencias con su estado de expiración. Incluye la tendencia de nuevos usuarios de los últimos 14 días con comparación entre semanas.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AdminApi();

try {
    final result = api_instance.mobileGetAdminHealth();
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminHealth: $e\n');
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
> GetAdminLicenseStatsResponse mobileGetAdminLicenseStats(search, planFilter, statusFilter, typeFilter)

Consultar métricas de licencias

Resume las licencias totales, activas, expiradas, de demostración, de prueba de administración y las próximas a vencer en los próximos siete días, respetando los filtros de la lista paginada.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AdminApi();
final search = search_example; // String | Búsqueda por identificador, empresa o responsable.
final planFilter = planFilter_example; // String | Filtro por plan.
final statusFilter = statusFilter_example; // String | Filtro por estado.
final typeFilter = typeFilter_example; // String | Filtro por tipo.

try {
    final result = api_instance.mobileGetAdminLicenseStats(search, planFilter, statusFilter, typeFilter);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminLicenseStats: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **search** | **String**| Búsqueda por identificador, empresa o responsable. | [optional] 
 **planFilter** | **String**| Filtro por plan. | [optional] 
 **statusFilter** | **String**| Filtro por estado. | [optional] 
 **typeFilter** | **String**| Filtro por tipo. | [optional] 

### Return type

[**GetAdminLicenseStatsResponse**](GetAdminLicenseStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminLicenses**
> GetAdminLicensesResponse mobileGetAdminLicenses(page, limit, sortBy, sortOrder, search, planFilter, statusFilter, typeFilter)

Listar licencias con filtros

Consulta paginada de licencias con búsqueda por identificador, empresa o responsable, y filtros por plan, estado y tipo. Permite ordenar por fecha, expiración, actividad, empresa o plan.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AdminApi();
final page = 56; // int | Número de página.
final limit = 56; // int | Elementos por página.
final sortBy = sortBy_example; // String | Campo de ordenamiento.
final sortOrder = sortOrder_example; // String | Dirección del ordenamiento.
final search = search_example; // String | Búsqueda por identificador, empresa o responsable.
final planFilter = planFilter_example; // String | Filtro por plan.
final statusFilter = statusFilter_example; // String | Filtro por estado.
final typeFilter = typeFilter_example; // String | Filtro por tipo.

try {
    final result = api_instance.mobileGetAdminLicenses(page, limit, sortBy, sortOrder, search, planFilter, statusFilter, typeFilter);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminLicenses: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**| Número de página. | [optional] 
 **limit** | **int**| Elementos por página. | [optional] 
 **sortBy** | **String**| Campo de ordenamiento. | [optional] 
 **sortOrder** | **String**| Dirección del ordenamiento. | [optional] 
 **search** | **String**| Búsqueda por identificador, empresa o responsable. | [optional] 
 **planFilter** | **String**| Filtro por plan. | [optional] 
 **statusFilter** | **String**| Filtro por estado. | [optional] 
 **typeFilter** | **String**| Filtro por tipo. | [optional] 

### Return type

[**GetAdminLicensesResponse**](GetAdminLicensesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminPendingMemberships**
> List<PendingMembershipItem> mobileGetAdminPendingMemberships()

Listar solicitudes de membresía pendientes

Enumerar las solicitudes de membresía que aguardan aprobación, con los datos del solicitante y la empresa destino, ordenadas de la más reciente a la más antigua.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AdminApi();

try {
    final result = api_instance.mobileGetAdminPendingMemberships();
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminPendingMemberships: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**List<PendingMembershipItem>**](PendingMembershipItem.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminTenants**
> List<AdminTenantItem> mobileGetAdminTenants()

Listar empresas de la plataforma

Enumera las empresas reales de la plataforma, excluyendo las cuentas de demostración, con su plan vigente, estado de licencia y conteo de usuarios, productos y almacenes.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AdminApi();

try {
    final result = api_instance.mobileGetAdminTenants();
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminTenants: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**List<AdminTenantItem>**](AdminTenantItem.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminUsers**
> GetAdminUsersResponse mobileGetAdminUsers(tenantId, limit)

Listar usuarios de la plataforma

Lista los usuarios globales para el administrador de la plataforma o los integrantes de una empresa para un gestor. Permite acotar la consulta a una empresa mediante el identificador opcional.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AdminApi();
final tenantId = tenantId_example; // String | Identificador de la empresa para acotar la consulta.
final limit = 56; // int | Cantidad máxima de usuarios.

try {
    final result = api_instance.mobileGetAdminUsers(tenantId, limit);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminUsers: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tenantId** | **String**| Identificador de la empresa para acotar la consulta. | [optional] 
 **limit** | **int**| Cantidad máxima de usuarios. | [optional] 

### Return type

[**GetAdminUsersResponse**](GetAdminUsersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileLockAdminUser**
> PostAdminUsersLockResponse mobileLockAdminUser(lockAdminUserRequest)

Bloquear usuario por 24 horas

Bloquea temporalmente a un usuario de la plataforma durante 24 horas, previniendo nuevos inicios de sesión. Devuelve el estado actualizado del bloqueo y su mensaje de confirmación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AdminApi();
final lockAdminUserRequest = LockAdminUserRequest(); // LockAdminUserRequest | 

try {
    final result = api_instance.mobileLockAdminUser(lockAdminUserRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileLockAdminUser: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **lockAdminUserRequest** | [**LockAdminUserRequest**](LockAdminUserRequest.md)|  | 

### Return type

[**PostAdminUsersLockResponse**](PostAdminUsersLockResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileRejectAdminMembership**
> PostAdminMembershipsRejectResponse mobileRejectAdminMembership(rejectAdminMembershipRequest)

Rechazar solicitud de membresía

Rechaza una solicitud de membresía pendiente, elimina la solicitud y devuelve al solicitante a la etapa de selección de empresa para que pueda volver a elegir.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AdminApi();
final rejectAdminMembershipRequest = RejectAdminMembershipRequest(); // RejectAdminMembershipRequest | 

try {
    final result = api_instance.mobileRejectAdminMembership(rejectAdminMembershipRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileRejectAdminMembership: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **rejectAdminMembershipRequest** | [**RejectAdminMembershipRequest**](RejectAdminMembershipRequest.md)|  | 

### Return type

[**PostAdminMembershipsRejectResponse**](PostAdminMembershipsRejectResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileUnlockAdminUser**
> PostAdminUsersLockResponse mobileUnlockAdminUser(unlockAdminUserRequest)

Desbloquear usuario

Desbloquea a un usuario de la plataforma y reinicia sus intentos de inicio de sesión. Devuelve el estado actualizado y su mensaje de confirmación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AdminApi();
final unlockAdminUserRequest = UnlockAdminUserRequest(); // UnlockAdminUserRequest | 

try {
    final result = api_instance.mobileUnlockAdminUser(unlockAdminUserRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileUnlockAdminUser: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **unlockAdminUserRequest** | [**UnlockAdminUserRequest**](UnlockAdminUserRequest.md)|  | 

### Return type

[**PostAdminUsersLockResponse**](PostAdminUsersLockResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

