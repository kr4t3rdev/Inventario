# tcp_mobile_v1_sdk.api.AdminApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileActivateAdminLicense**](AdminApi.md#mobileactivateadminlicense) | **POST** /admin/licenses/activate | Activar una licencia
[**mobileActivateAdminTenant**](AdminApi.md#mobileactivateadmintenant) | **POST** /admin/tenants/activate | Activar una empresa
[**mobileActivateAdminUser**](AdminApi.md#mobileactivateadminuser) | **POST** /admin/users/activate | Activar un usuario
[**mobileApproveAdminMembership**](AdminApi.md#mobileapproveadminmembership) | **POST** /admin/memberships/approve | Aprobar solicitud de membresía
[**mobileAssignAdminTenantLicense**](AdminApi.md#mobileassignadmintenantlicense) | **POST** /admin/tenants/license/assign | Asignar una licencia a una empresa
[**mobileAssignAdminUserTenant**](AdminApi.md#mobileassignadminusertenant) | **POST** /admin/users/assign-tenant | Asignar o cambiar la empresa de un usuario
[**mobileChangeAdminUserTenantRole**](AdminApi.md#mobilechangeadminusertenantrole) | **PATCH** /admin/users/change-tenant-role | Cambiar el rol de un usuario dentro de una empresa
[**mobileDeactivateAdminLicense**](AdminApi.md#mobiledeactivateadminlicense) | **POST** /admin/licenses/deactivate | Desactivar una licencia
[**mobileDeactivateAdminTenant**](AdminApi.md#mobiledeactivateadmintenant) | **POST** /admin/tenants/deactivate | Desactivar una empresa
[**mobileDeactivateAdminTenantLicense**](AdminApi.md#mobiledeactivateadmintenantlicense) | **POST** /admin/tenants/license/deactivate | Desactivar la licencia de una empresa
[**mobileDeactivateAdminUser**](AdminApi.md#mobiledeactivateadminuser) | **POST** /admin/users/deactivate | Desactivar un usuario
[**mobileDeleteAdminLicense**](AdminApi.md#mobiledeleteadminlicense) | **POST** /admin/licenses/delete | Eliminar una licencia
[**mobileDeleteAdminTenant**](AdminApi.md#mobiledeleteadmintenant) | **POST** /admin/tenants/delete | Eliminar una empresa
[**mobileDeleteAdminUser**](AdminApi.md#mobiledeleteadminuser) | **POST** /admin/users/delete | Eliminar un usuario
[**mobileGetAdminActivityLogs**](AdminApi.md#mobilegetadminactivitylogs) | **GET** /admin/activity-logs | Obtener el registro de actividad de los usuarios
[**mobileGetAdminHealth**](AdminApi.md#mobilegetadminhealth) | **GET** /admin/health | Consultar salud del sistema
[**mobileGetAdminLicenseStats**](AdminApi.md#mobilegetadminlicensestats) | **GET** /admin/licenses/stats | Consultar métricas de licencias
[**mobileGetAdminLicenses**](AdminApi.md#mobilegetadminlicenses) | **GET** /admin/licenses | Listar licencias con filtros
[**mobileGetAdminPendingMemberships**](AdminApi.md#mobilegetadminpendingmemberships) | **GET** /admin/memberships/pending | Listar solicitudes de membresía pendientes
[**mobileGetAdminSessions**](AdminApi.md#mobilegetadminsessions) | **GET** /admin/sessions | Listar las sesiones registradas
[**mobileGetAdminTenantDetail**](AdminApi.md#mobilegetadmintenantdetail) | **GET** /admin/tenants/detail | Obtener el detalle de una empresa
[**mobileGetAdminTenantLicense**](AdminApi.md#mobilegetadmintenantlicense) | **GET** /admin/tenants/license | Ver las licencias de una empresa
[**mobileGetAdminTenantUsers**](AdminApi.md#mobilegetadmintenantusers) | **GET** /admin/tenants/users | Listar los usuarios de una empresa
[**mobileGetAdminTenants**](AdminApi.md#mobilegetadmintenants) | **GET** /admin/tenants | Listar empresas de la plataforma
[**mobileGetAdminUserDetail**](AdminApi.md#mobilegetadminuserdetail) | **GET** /admin/users/detail | Obtener el detalle de un usuario
[**mobileGetAdminUserLoginHistory**](AdminApi.md#mobilegetadminuserloginhistory) | **GET** /admin/users/login-history | Obtener el historial de sesiones de un usuario
[**mobileGetAdminUsers**](AdminApi.md#mobilegetadminusers) | **GET** /admin/users | Listar usuarios de la plataforma
[**mobileLockAdminUser**](AdminApi.md#mobilelockadminuser) | **POST** /admin/users/lock | Bloquear usuario por 24 horas
[**mobileRejectAdminMembership**](AdminApi.md#mobilerejectadminmembership) | **POST** /admin/memberships/reject | Rechazar solicitud de membresía
[**mobileRemoveAdminTenantUser**](AdminApi.md#mobileremoveadmintenantuser) | **POST** /admin/tenants/remove-user | Quitar un usuario de una empresa
[**mobileRenewAdminLicense**](AdminApi.md#mobilerenewadminlicense) | **POST** /admin/licenses/renew | Renovar una licencia
[**mobileResendAdminUserVerification**](AdminApi.md#mobileresendadminuserverification) | **POST** /admin/users/resend-verification | Reenviar el email de verificación
[**mobileResetAdminUserPassword**](AdminApi.md#mobileresetadminuserpassword) | **POST** /admin/users/reset-password | Enviar enlace de restablecimiento de contraseña
[**mobileRevokeAdminSession**](AdminApi.md#mobilerevokeadminsession) | **POST** /admin/sessions/revoke | Revocar una sesión específica
[**mobileRevokeAdminUserSessions**](AdminApi.md#mobilerevokeadminusersessions) | **POST** /admin/users/revoke-sessions | Revocar las sesiones activas de un usuario
[**mobileUnlockAdminUser**](AdminApi.md#mobileunlockadminuser) | **POST** /admin/users/unlock | Desbloquear usuario
[**mobileUpdateAdminTenant**](AdminApi.md#mobileupdateadmintenant) | **PATCH** /admin/tenants/update | Editar los datos de una empresa
[**mobileUpdateAdminTenantLicense**](AdminApi.md#mobileupdateadmintenantlicense) | **PATCH** /admin/tenants/license/update | Actualizar la licencia de una empresa
[**mobileUpdateAdminUser**](AdminApi.md#mobileupdateadminuser) | **PATCH** /admin/users/update | Editar nombre, email o rol de un usuario
[**mobileVerifyAdminUserEmail**](AdminApi.md#mobileverifyadminuseremail) | **POST** /admin/users/verify-email | Marcar el email como verificado


# **mobileActivateAdminLicense**
> PostAdminLicensesActivateResponse mobileActivateAdminLicense(adminLicenciaIdRequest)

Activar una licencia

Activa una licencia desactivada de una empresa, restituyendo el acceso a sus usuarios dentro del período de vigencia.

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
final adminLicenciaIdRequest = AdminLicenciaIdRequest(); // AdminLicenciaIdRequest | 

try {
    final result = api_instance.mobileActivateAdminLicense(adminLicenciaIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileActivateAdminLicense: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md)|  | 

### Return type

[**PostAdminLicensesActivateResponse**](PostAdminLicensesActivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileActivateAdminTenant**
> PostAdminTenantsActivateResponse mobileActivateAdminTenant(adminTenantIdRequest)

Activar una empresa

Activa una empresa reactivando todas sus membresías, restituyendo el acceso de sus miembros. No modifica las licencias.

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
final adminTenantIdRequest = AdminTenantIdRequest(); // AdminTenantIdRequest | 

try {
    final result = api_instance.mobileActivateAdminTenant(adminTenantIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileActivateAdminTenant: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminTenantIdRequest** | [**AdminTenantIdRequest**](AdminTenantIdRequest.md)|  | 

### Return type

[**PostAdminTenantsActivateResponse**](PostAdminTenantsActivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileActivateAdminUser**
> PostAdminUsersActivateResponse mobileActivateAdminUser(adminUserIdRequest)

Activar un usuario

Reactiva el acceso de un usuario desactivado, limpiando además cualquier bloqueo temporal y los intentos fallidos de inicio de sesión acumulados.

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
final adminUserIdRequest = AdminUserIdRequest(); // AdminUserIdRequest | 

try {
    final result = api_instance.mobileActivateAdminUser(adminUserIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileActivateAdminUser: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | 

### Return type

[**PostAdminUsersActivateResponse**](PostAdminUsersActivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

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

# **mobileAssignAdminTenantLicense**
> PostAdminTenantsLicenseAssignResponse mobileAssignAdminTenantLicense(assignAdminTenantLicenseRequest)

Asignar una licencia a una empresa

Crea una licencia nueva para la empresa con el plan indicado, desactivando las licencias vigentes anteriores para evitar ambigüedad. Calcula inicio y vencimiento desde la duración del plan.

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
final assignAdminTenantLicenseRequest = AssignAdminTenantLicenseRequest(); // AssignAdminTenantLicenseRequest | 

try {
    final result = api_instance.mobileAssignAdminTenantLicense(assignAdminTenantLicenseRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileAssignAdminTenantLicense: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **assignAdminTenantLicenseRequest** | [**AssignAdminTenantLicenseRequest**](AssignAdminTenantLicenseRequest.md)|  | 

### Return type

[**PostAdminTenantsLicenseAssignResponse**](PostAdminTenantsLicenseAssignResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileAssignAdminUserTenant**
> PostAdminUsersAssignTenantResponse mobileAssignAdminUserTenant(assignAdminUserTenantRequest)

Asignar o cambiar la empresa de un usuario

Crea o actualiza la membresía de un usuario en una empresa con el rol operativo indicado. Puede desactivar las demás membresías para efectuar un cambio de empresa.

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
final assignAdminUserTenantRequest = AssignAdminUserTenantRequest(); // AssignAdminUserTenantRequest | 

try {
    final result = api_instance.mobileAssignAdminUserTenant(assignAdminUserTenantRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileAssignAdminUserTenant: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **assignAdminUserTenantRequest** | [**AssignAdminUserTenantRequest**](AssignAdminUserTenantRequest.md)|  | 

### Return type

[**PostAdminUsersAssignTenantResponse**](PostAdminUsersAssignTenantResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileChangeAdminUserTenantRole**
> PatchAdminUsersChangeTenantRoleResponse mobileChangeAdminUserTenantRole(changeAdminUserTenantRoleRequest)

Cambiar el rol de un usuario dentro de una empresa

Actualiza el rol operativo (manager, economico o dependiente) de la membresía existente de un usuario en una empresa.

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
final changeAdminUserTenantRoleRequest = ChangeAdminUserTenantRoleRequest(); // ChangeAdminUserTenantRoleRequest | 

try {
    final result = api_instance.mobileChangeAdminUserTenantRole(changeAdminUserTenantRoleRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileChangeAdminUserTenantRole: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **changeAdminUserTenantRoleRequest** | [**ChangeAdminUserTenantRoleRequest**](ChangeAdminUserTenantRoleRequest.md)|  | 

### Return type

[**PatchAdminUsersChangeTenantRoleResponse**](PatchAdminUsersChangeTenantRoleResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeactivateAdminLicense**
> PostAdminLicensesDeactivateResponse mobileDeactivateAdminLicense(adminLicenciaIdRequest)

Desactivar una licencia

Desactiva una licencia activa de una empresa, suspendiendo el acceso de sus usuarios hasta que se reactive o renueve.

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
final adminLicenciaIdRequest = AdminLicenciaIdRequest(); // AdminLicenciaIdRequest | 

try {
    final result = api_instance.mobileDeactivateAdminLicense(adminLicenciaIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileDeactivateAdminLicense: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md)|  | 

### Return type

[**PostAdminLicensesDeactivateResponse**](PostAdminLicensesDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeactivateAdminTenant**
> PostAdminTenantsDeactivateResponse mobileDeactivateAdminTenant(adminTenantIdRequest)

Desactivar una empresa

Desactiva una empresa bloqueando el acceso de todos sus miembros al desactivar sus membresías. No modifica las licencias.

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
final adminTenantIdRequest = AdminTenantIdRequest(); // AdminTenantIdRequest | 

try {
    final result = api_instance.mobileDeactivateAdminTenant(adminTenantIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileDeactivateAdminTenant: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminTenantIdRequest** | [**AdminTenantIdRequest**](AdminTenantIdRequest.md)|  | 

### Return type

[**PostAdminTenantsDeactivateResponse**](PostAdminTenantsDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeactivateAdminTenantLicense**
> PostAdminTenantsLicenseDeactivateResponse mobileDeactivateAdminTenantLicense(adminLicenciaIdRequest)

Desactivar la licencia de una empresa

Desactiva una licencia específica de una empresa, suspendiendo el acceso asociado hasta que se reactive o renueve.

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
final adminLicenciaIdRequest = AdminLicenciaIdRequest(); // AdminLicenciaIdRequest | 

try {
    final result = api_instance.mobileDeactivateAdminTenantLicense(adminLicenciaIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileDeactivateAdminTenantLicense: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md)|  | 

### Return type

[**PostAdminTenantsLicenseDeactivateResponse**](PostAdminTenantsLicenseDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeactivateAdminUser**
> PostAdminUsersDeactivateResponse mobileDeactivateAdminUser(adminUserIdRequest)

Desactivar un usuario

Desactiva el acceso de un usuario y revoca de inmediato todas sus sesiones activas. No permite desactivar la propia cuenta ni al último administrador activo de la plataforma.

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
final adminUserIdRequest = AdminUserIdRequest(); // AdminUserIdRequest | 

try {
    final result = api_instance.mobileDeactivateAdminUser(adminUserIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileDeactivateAdminUser: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | 

### Return type

[**PostAdminUsersDeactivateResponse**](PostAdminUsersDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeleteAdminLicense**
> PostAdminLicensesDeleteResponse mobileDeleteAdminLicense(adminLicenciaIdRequest)

Eliminar una licencia

Elimina permanentemente una licencia de una empresa. Es una operación irreversible: la empresa queda sin licencia hasta que se le asigne una nueva.

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
final adminLicenciaIdRequest = AdminLicenciaIdRequest(); // AdminLicenciaIdRequest | 

try {
    final result = api_instance.mobileDeleteAdminLicense(adminLicenciaIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileDeleteAdminLicense: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md)|  | 

### Return type

[**PostAdminLicensesDeleteResponse**](PostAdminLicensesDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeleteAdminTenant**
> PostAdminTenantsDeleteResponse mobileDeleteAdminTenant(adminTenantIdRequest)

Eliminar una empresa

Elimina permanentemente una empresa y todos sus datos asociados. Es una operación irreversible.

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
final adminTenantIdRequest = AdminTenantIdRequest(); // AdminTenantIdRequest | 

try {
    final result = api_instance.mobileDeleteAdminTenant(adminTenantIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileDeleteAdminTenant: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminTenantIdRequest** | [**AdminTenantIdRequest**](AdminTenantIdRequest.md)|  | 

### Return type

[**PostAdminTenantsDeleteResponse**](PostAdminTenantsDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeleteAdminUser**
> PostAdminUsersDeleteResponse mobileDeleteAdminUser(adminUserIdRequest)

Eliminar un usuario

Elimina permanentemente un usuario de la plataforma. Bloquea la operación si es un gestor de ventas con registros asociados, si es la propia cuenta o si es el último administrador activo.

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
final adminUserIdRequest = AdminUserIdRequest(); // AdminUserIdRequest | 

try {
    final result = api_instance.mobileDeleteAdminUser(adminUserIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileDeleteAdminUser: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | 

### Return type

[**PostAdminUsersDeleteResponse**](PostAdminUsersDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminActivityLogs**
> GetAdminActivityLogsResponse mobileGetAdminActivityLogs(userId, limit)

Obtener el registro de actividad de los usuarios

Devuelve las entradas del registro de actividad ordenadas por fecha descendente, con filtro opcional por usuario. Paridad con la pestaña de actividad del admin web.

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
final userId = userId_example; // String | Identificador del usuario a filtrar.
final limit = 56; // int | Cantidad máxima de entradas a devolver.

try {
    final result = api_instance.mobileGetAdminActivityLogs(userId, limit);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminActivityLogs: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **String**| Identificador del usuario a filtrar. | [optional] 
 **limit** | **int**| Cantidad máxima de entradas a devolver. | [optional] 

### Return type

[**GetAdminActivityLogsResponse**](GetAdminActivityLogsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
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

# **mobileGetAdminSessions**
> GetAdminSessionsResponse mobileGetAdminSessions()

Listar las sesiones registradas

Lista las sesiones registradas en la plataforma ordenadas por fecha descendente, con los datos del usuario. Paridad con la pestaña de sesiones del admin web.

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
    final result = api_instance.mobileGetAdminSessions();
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminSessions: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAdminSessionsResponse**](GetAdminSessionsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminTenantDetail**
> GetAdminTenantDetailResponse mobileGetAdminTenantDetail(tenantId)

Obtener el detalle de una empresa

Devuelve la ficha completa de una empresa sin descargar la lista entera: datos fiscales, licencia vigente, miembros activos y conteos de usuarios, productos, almacenes y clientes.

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
final tenantId = tenantId_example; // String | Identificador de la empresa.

try {
    final result = api_instance.mobileGetAdminTenantDetail(tenantId);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminTenantDetail: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tenantId** | **String**| Identificador de la empresa. | 

### Return type

[**GetAdminTenantDetailResponse**](GetAdminTenantDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminTenantLicense**
> GetAdminTenantLicenseResponse mobileGetAdminTenantLicense(tenantId)

Ver las licencias de una empresa

Devuelve el historial de licencias de una empresa ordenado por creación junto con la licencia vigente, si existe.

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
final tenantId = tenantId_example; // String | Identificador de la empresa.

try {
    final result = api_instance.mobileGetAdminTenantLicense(tenantId);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminTenantLicense: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tenantId** | **String**| Identificador de la empresa. | 

### Return type

[**GetAdminTenantLicenseResponse**](GetAdminTenantLicenseResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminTenantUsers**
> GetAdminTenantUsersResponse mobileGetAdminTenantUsers(tenantId)

Listar los usuarios de una empresa

Lista los usuarios pertenecientes a una empresa con su rol operativo y el estado de su membresía, sin descargar el listado global.

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
final tenantId = tenantId_example; // String | Identificador de la empresa.

try {
    final result = api_instance.mobileGetAdminTenantUsers(tenantId);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminTenantUsers: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tenantId** | **String**| Identificador de la empresa. | 

### Return type

[**GetAdminTenantUsersResponse**](GetAdminTenantUsersResponse.md)

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

# **mobileGetAdminUserDetail**
> GetAdminUserDetailResponse mobileGetAdminUserDetail(userId)

Obtener el detalle de un usuario

Devuelve la ficha completa de un usuario de la plataforma sin descargar la lista entera: datos personales, estado, verificación de email, membresías por empresa y conteo de sesiones activas.

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
final userId = userId_example; // String | Identificador del usuario a consultar.

try {
    final result = api_instance.mobileGetAdminUserDetail(userId);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminUserDetail: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **String**| Identificador del usuario a consultar. | 

### Return type

[**GetAdminUserDetailResponse**](GetAdminUserDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminUserLoginHistory**
> GetAdminUserLoginHistoryResponse mobileGetAdminUserLoginHistory(userId, limit)

Obtener el historial de sesiones de un usuario

Devuelve el historial de inicios de sesión de un usuario ordenado por fecha descendente. Paridad con el diálogo de historial del admin web.

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
final userId = userId_example; // String | Identificador del usuario.
final limit = 56; // int | Cantidad máxima de entradas a devolver.

try {
    final result = api_instance.mobileGetAdminUserLoginHistory(userId, limit);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileGetAdminUserLoginHistory: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **String**| Identificador del usuario. | 
 **limit** | **int**| Cantidad máxima de entradas a devolver. | [optional] 

### Return type

[**GetAdminUserLoginHistoryResponse**](GetAdminUserLoginHistoryResponse.md)

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

# **mobileRemoveAdminTenantUser**
> PostAdminTenantsRemoveUserResponse mobileRemoveAdminTenantUser(adminRemoveTenantUserRequest)

Quitar un usuario de una empresa

Quita un usuario de una empresa desactivando su membresía, sin eliminar su cuenta de la plataforma. Es reversible reasignándolo.

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
final adminRemoveTenantUserRequest = AdminRemoveTenantUserRequest(); // AdminRemoveTenantUserRequest | 

try {
    final result = api_instance.mobileRemoveAdminTenantUser(adminRemoveTenantUserRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileRemoveAdminTenantUser: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminRemoveTenantUserRequest** | [**AdminRemoveTenantUserRequest**](AdminRemoveTenantUserRequest.md)|  | 

### Return type

[**PostAdminTenantsRemoveUserResponse**](PostAdminTenantsRemoveUserResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileRenewAdminLicense**
> PostAdminLicensesRenewResponse mobileRenewAdminLicense(renewAdminLicenseRequest)

Renovar una licencia

Renueva una licencia extendiendo su expiración según la duración del plan indicado (o el actual), sincronizando límites y reactivando a los usuarios de la empresa. No registra pagos; el registro de pagos se hace desde la web.

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
final renewAdminLicenseRequest = RenewAdminLicenseRequest(); // RenewAdminLicenseRequest | 

try {
    final result = api_instance.mobileRenewAdminLicense(renewAdminLicenseRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileRenewAdminLicense: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **renewAdminLicenseRequest** | [**RenewAdminLicenseRequest**](RenewAdminLicenseRequest.md)|  | 

### Return type

[**PostAdminLicensesRenewResponse**](PostAdminLicensesRenewResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileResendAdminUserVerification**
> PostAdminUsersResendVerificationResponse mobileResendAdminUserVerification(adminUserIdRequest)

Reenviar el email de verificación

Genera un nuevo enlace de verificación y lo reenvía al correo del usuario. Falla si el correo ya fue verificado previamente.

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
final adminUserIdRequest = AdminUserIdRequest(); // AdminUserIdRequest | 

try {
    final result = api_instance.mobileResendAdminUserVerification(adminUserIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileResendAdminUserVerification: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | 

### Return type

[**PostAdminUsersResendVerificationResponse**](PostAdminUsersResendVerificationResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileResetAdminUserPassword**
> PostAdminUsersResetPasswordResponse mobileResetAdminUserPassword(adminUserIdRequest)

Enviar enlace de restablecimiento de contraseña

Genera un enlace temporal de restablecimiento de contraseña y lo envía al correo del usuario. El administrador nunca ve ni define la contraseña del usuario.

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
final adminUserIdRequest = AdminUserIdRequest(); // AdminUserIdRequest | 

try {
    final result = api_instance.mobileResetAdminUserPassword(adminUserIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileResetAdminUserPassword: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | 

### Return type

[**PostAdminUsersResetPasswordResponse**](PostAdminUsersResetPasswordResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileRevokeAdminSession**
> PostAdminSessionsRevokeResponse mobileRevokeAdminSession(adminRevokeSessionRequest)

Revocar una sesión específica

Revoca una sesión puntual de un usuario, cerrando su acceso en ese dispositivo. A diferencia de la acción web equivalente, elimina por el identificador real de la sesión.

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
final adminRevokeSessionRequest = AdminRevokeSessionRequest(); // AdminRevokeSessionRequest | 

try {
    final result = api_instance.mobileRevokeAdminSession(adminRevokeSessionRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileRevokeAdminSession: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminRevokeSessionRequest** | [**AdminRevokeSessionRequest**](AdminRevokeSessionRequest.md)|  | 

### Return type

[**PostAdminSessionsRevokeResponse**](PostAdminSessionsRevokeResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileRevokeAdminUserSessions**
> PostAdminUsersRevokeSessionsResponse mobileRevokeAdminUserSessions(adminUserIdRequest)

Revocar las sesiones activas de un usuario

Invalida todas las sesiones activas del usuario, forzando un nuevo inicio de sesión en cada dispositivo donde estuviera conectado.

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
final adminUserIdRequest = AdminUserIdRequest(); // AdminUserIdRequest | 

try {
    final result = api_instance.mobileRevokeAdminUserSessions(adminUserIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileRevokeAdminUserSessions: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | 

### Return type

[**PostAdminUsersRevokeSessionsResponse**](PostAdminUsersRevokeSessionsResponse.md)

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

# **mobileUpdateAdminTenant**
> PatchAdminTenantsUpdateResponse mobileUpdateAdminTenant(updateAdminTenantRequest)

Editar los datos de una empresa

Actualiza el nombre, los datos fiscales y la configuración de una empresa. Valida que el identificador público no esté en uso por otra empresa.

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
final updateAdminTenantRequest = UpdateAdminTenantRequest(); // UpdateAdminTenantRequest | 

try {
    final result = api_instance.mobileUpdateAdminTenant(updateAdminTenantRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileUpdateAdminTenant: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **updateAdminTenantRequest** | [**UpdateAdminTenantRequest**](UpdateAdminTenantRequest.md)|  | 

### Return type

[**PatchAdminTenantsUpdateResponse**](PatchAdminTenantsUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileUpdateAdminTenantLicense**
> PatchAdminTenantsLicenseUpdateResponse mobileUpdateAdminTenantLicense(updateAdminTenantLicenseRequest)

Actualizar la licencia de una empresa

Cambia el plan, los límites o el vencimiento de una licencia. Al cambiar de plan se sincronizan límites y precios del plan, salvo los límites indicados explícitamente.

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
final updateAdminTenantLicenseRequest = UpdateAdminTenantLicenseRequest(); // UpdateAdminTenantLicenseRequest | 

try {
    final result = api_instance.mobileUpdateAdminTenantLicense(updateAdminTenantLicenseRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileUpdateAdminTenantLicense: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **updateAdminTenantLicenseRequest** | [**UpdateAdminTenantLicenseRequest**](UpdateAdminTenantLicenseRequest.md)|  | 

### Return type

[**PatchAdminTenantsLicenseUpdateResponse**](PatchAdminTenantsLicenseUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileUpdateAdminUser**
> PatchAdminUsersUpdateResponse mobileUpdateAdminUser(updateAdminUserRequest)

Editar nombre, email o rol de un usuario

Actualiza los datos básicos de un usuario: nombre, correo electrónico o rol de plataforma. Valida que el correo no esté en uso por otro usuario y protege al último administrador activo.

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
final updateAdminUserRequest = UpdateAdminUserRequest(); // UpdateAdminUserRequest | 

try {
    final result = api_instance.mobileUpdateAdminUser(updateAdminUserRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileUpdateAdminUser: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **updateAdminUserRequest** | [**UpdateAdminUserRequest**](UpdateAdminUserRequest.md)|  | 

### Return type

[**PatchAdminUsersUpdateResponse**](PatchAdminUsersUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileVerifyAdminUserEmail**
> PostAdminUsersVerifyEmailResponse mobileVerifyAdminUserEmail(adminUserIdRequest)

Marcar el email como verificado

Marca manualmente el correo de un usuario como verificado, sin necesidad de que complete el flujo de verificación por email. Es idempotente si ya estaba verificado.

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
final adminUserIdRequest = AdminUserIdRequest(); // AdminUserIdRequest | 

try {
    final result = api_instance.mobileVerifyAdminUserEmail(adminUserIdRequest);
    print(result);
} catch (e) {
    print('Exception when calling AdminApi->mobileVerifyAdminUserEmail: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | 

### Return type

[**PostAdminUsersVerifyEmailResponse**](PostAdminUsersVerifyEmailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

