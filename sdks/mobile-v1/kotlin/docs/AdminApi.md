# AdminApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileActivateAdminLicense**](AdminApi.md#mobileActivateAdminLicense) | **POST** /admin/licenses/activate | Activar una licencia |
| [**mobileActivateAdminTenant**](AdminApi.md#mobileActivateAdminTenant) | **POST** /admin/tenants/activate | Activar una empresa |
| [**mobileActivateAdminUser**](AdminApi.md#mobileActivateAdminUser) | **POST** /admin/users/activate | Activar un usuario |
| [**mobileApproveAdminMembership**](AdminApi.md#mobileApproveAdminMembership) | **POST** /admin/memberships/approve | Aprobar solicitud de membresía |
| [**mobileAssignAdminTenantLicense**](AdminApi.md#mobileAssignAdminTenantLicense) | **POST** /admin/tenants/license/assign | Asignar una licencia a una empresa |
| [**mobileAssignAdminUserTenant**](AdminApi.md#mobileAssignAdminUserTenant) | **POST** /admin/users/assign-tenant | Asignar o cambiar la empresa de un usuario |
| [**mobileChangeAdminUserTenantRole**](AdminApi.md#mobileChangeAdminUserTenantRole) | **PATCH** /admin/users/change-tenant-role | Cambiar el rol de un usuario dentro de una empresa |
| [**mobileDeactivateAdminLicense**](AdminApi.md#mobileDeactivateAdminLicense) | **POST** /admin/licenses/deactivate | Desactivar una licencia |
| [**mobileDeactivateAdminTenant**](AdminApi.md#mobileDeactivateAdminTenant) | **POST** /admin/tenants/deactivate | Desactivar una empresa |
| [**mobileDeactivateAdminTenantLicense**](AdminApi.md#mobileDeactivateAdminTenantLicense) | **POST** /admin/tenants/license/deactivate | Desactivar la licencia de una empresa |
| [**mobileDeactivateAdminUser**](AdminApi.md#mobileDeactivateAdminUser) | **POST** /admin/users/deactivate | Desactivar un usuario |
| [**mobileDeleteAdminLicense**](AdminApi.md#mobileDeleteAdminLicense) | **POST** /admin/licenses/delete | Eliminar una licencia |
| [**mobileDeleteAdminTenant**](AdminApi.md#mobileDeleteAdminTenant) | **POST** /admin/tenants/delete | Eliminar una empresa |
| [**mobileDeleteAdminUser**](AdminApi.md#mobileDeleteAdminUser) | **POST** /admin/users/delete | Eliminar un usuario |
| [**mobileGetAdminActivityLogs**](AdminApi.md#mobileGetAdminActivityLogs) | **GET** /admin/activity-logs | Obtener el registro de actividad de los usuarios |
| [**mobileGetAdminHealth**](AdminApi.md#mobileGetAdminHealth) | **GET** /admin/health | Consultar salud del sistema |
| [**mobileGetAdminLicenseStats**](AdminApi.md#mobileGetAdminLicenseStats) | **GET** /admin/licenses/stats | Consultar métricas de licencias |
| [**mobileGetAdminLicenses**](AdminApi.md#mobileGetAdminLicenses) | **GET** /admin/licenses | Listar licencias con filtros |
| [**mobileGetAdminPendingMemberships**](AdminApi.md#mobileGetAdminPendingMemberships) | **GET** /admin/memberships/pending | Listar solicitudes de membresía pendientes |
| [**mobileGetAdminSessions**](AdminApi.md#mobileGetAdminSessions) | **GET** /admin/sessions | Listar las sesiones registradas |
| [**mobileGetAdminTenantDetail**](AdminApi.md#mobileGetAdminTenantDetail) | **GET** /admin/tenants/detail | Obtener el detalle de una empresa |
| [**mobileGetAdminTenantLicense**](AdminApi.md#mobileGetAdminTenantLicense) | **GET** /admin/tenants/license | Ver las licencias de una empresa |
| [**mobileGetAdminTenantUsers**](AdminApi.md#mobileGetAdminTenantUsers) | **GET** /admin/tenants/users | Listar los usuarios de una empresa |
| [**mobileGetAdminTenants**](AdminApi.md#mobileGetAdminTenants) | **GET** /admin/tenants | Listar empresas de la plataforma |
| [**mobileGetAdminUserDetail**](AdminApi.md#mobileGetAdminUserDetail) | **GET** /admin/users/detail | Obtener el detalle de un usuario |
| [**mobileGetAdminUserLoginHistory**](AdminApi.md#mobileGetAdminUserLoginHistory) | **GET** /admin/users/login-history | Obtener el historial de sesiones de un usuario |
| [**mobileGetAdminUsers**](AdminApi.md#mobileGetAdminUsers) | **GET** /admin/users | Listar usuarios de la plataforma |
| [**mobileLockAdminUser**](AdminApi.md#mobileLockAdminUser) | **POST** /admin/users/lock | Bloquear usuario por 24 horas |
| [**mobileRejectAdminMembership**](AdminApi.md#mobileRejectAdminMembership) | **POST** /admin/memberships/reject | Rechazar solicitud de membresía |
| [**mobileRemoveAdminTenantUser**](AdminApi.md#mobileRemoveAdminTenantUser) | **POST** /admin/tenants/remove-user | Quitar un usuario de una empresa |
| [**mobileRenewAdminLicense**](AdminApi.md#mobileRenewAdminLicense) | **POST** /admin/licenses/renew | Renovar una licencia |
| [**mobileResendAdminUserVerification**](AdminApi.md#mobileResendAdminUserVerification) | **POST** /admin/users/resend-verification | Reenviar el email de verificación |
| [**mobileResetAdminUserPassword**](AdminApi.md#mobileResetAdminUserPassword) | **POST** /admin/users/reset-password | Enviar enlace de restablecimiento de contraseña |
| [**mobileRevokeAdminSession**](AdminApi.md#mobileRevokeAdminSession) | **POST** /admin/sessions/revoke | Revocar una sesión específica |
| [**mobileRevokeAdminUserSessions**](AdminApi.md#mobileRevokeAdminUserSessions) | **POST** /admin/users/revoke-sessions | Revocar las sesiones activas de un usuario |
| [**mobileUnlockAdminUser**](AdminApi.md#mobileUnlockAdminUser) | **POST** /admin/users/unlock | Desbloquear usuario |
| [**mobileUpdateAdminTenant**](AdminApi.md#mobileUpdateAdminTenant) | **PATCH** /admin/tenants/update | Editar los datos de una empresa |
| [**mobileUpdateAdminTenantLicense**](AdminApi.md#mobileUpdateAdminTenantLicense) | **PATCH** /admin/tenants/license/update | Actualizar la licencia de una empresa |
| [**mobileUpdateAdminUser**](AdminApi.md#mobileUpdateAdminUser) | **PATCH** /admin/users/update | Editar nombre, email o rol de un usuario |
| [**mobileVerifyAdminUserEmail**](AdminApi.md#mobileVerifyAdminUserEmail) | **POST** /admin/users/verify-email | Marcar el email como verificado |


<a id="mobileActivateAdminLicense"></a>
# **mobileActivateAdminLicense**
> PostAdminLicensesActivateResponse mobileActivateAdminLicense(adminLicenciaIdRequest)

Activar una licencia

Activa una licencia desactivada de una empresa, restituyendo el acceso a sus usuarios dentro del período de vigencia.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminLicenciaIdRequest : AdminLicenciaIdRequest =  // AdminLicenciaIdRequest | 
try {
    val result : PostAdminLicensesActivateResponse = apiInstance.mobileActivateAdminLicense(adminLicenciaIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileActivateAdminLicense")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileActivateAdminLicense")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md)|  | |

### Return type

[**PostAdminLicensesActivateResponse**](PostAdminLicensesActivateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileActivateAdminTenant"></a>
# **mobileActivateAdminTenant**
> PostAdminTenantsActivateResponse mobileActivateAdminTenant(adminTenantIdRequest)

Activar una empresa

Activa una empresa reactivando todas sus membresías, restituyendo el acceso de sus miembros. No modifica las licencias.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminTenantIdRequest : AdminTenantIdRequest =  // AdminTenantIdRequest | 
try {
    val result : PostAdminTenantsActivateResponse = apiInstance.mobileActivateAdminTenant(adminTenantIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileActivateAdminTenant")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileActivateAdminTenant")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminTenantIdRequest** | [**AdminTenantIdRequest**](AdminTenantIdRequest.md)|  | |

### Return type

[**PostAdminTenantsActivateResponse**](PostAdminTenantsActivateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileActivateAdminUser"></a>
# **mobileActivateAdminUser**
> PostAdminUsersActivateResponse mobileActivateAdminUser(adminUserIdRequest)

Activar un usuario

Reactiva el acceso de un usuario desactivado, limpiando además cualquier bloqueo temporal y los intentos fallidos de inicio de sesión acumulados.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminUserIdRequest : AdminUserIdRequest =  // AdminUserIdRequest | 
try {
    val result : PostAdminUsersActivateResponse = apiInstance.mobileActivateAdminUser(adminUserIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileActivateAdminUser")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileActivateAdminUser")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | |

### Return type

[**PostAdminUsersActivateResponse**](PostAdminUsersActivateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

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

<a id="mobileAssignAdminTenantLicense"></a>
# **mobileAssignAdminTenantLicense**
> PostAdminTenantsLicenseAssignResponse mobileAssignAdminTenantLicense(assignAdminTenantLicenseRequest)

Asignar una licencia a una empresa

Crea una licencia nueva para la empresa con el plan indicado, desactivando las licencias vigentes anteriores para evitar ambigüedad. Calcula inicio y vencimiento desde la duración del plan.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val assignAdminTenantLicenseRequest : AssignAdminTenantLicenseRequest =  // AssignAdminTenantLicenseRequest | 
try {
    val result : PostAdminTenantsLicenseAssignResponse = apiInstance.mobileAssignAdminTenantLicense(assignAdminTenantLicenseRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileAssignAdminTenantLicense")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileAssignAdminTenantLicense")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **assignAdminTenantLicenseRequest** | [**AssignAdminTenantLicenseRequest**](AssignAdminTenantLicenseRequest.md)|  | |

### Return type

[**PostAdminTenantsLicenseAssignResponse**](PostAdminTenantsLicenseAssignResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileAssignAdminUserTenant"></a>
# **mobileAssignAdminUserTenant**
> PostAdminUsersAssignTenantResponse mobileAssignAdminUserTenant(assignAdminUserTenantRequest)

Asignar o cambiar la empresa de un usuario

Crea o actualiza la membresía de un usuario en una empresa con el rol operativo indicado. Puede desactivar las demás membresías para efectuar un cambio de empresa.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val assignAdminUserTenantRequest : AssignAdminUserTenantRequest =  // AssignAdminUserTenantRequest | 
try {
    val result : PostAdminUsersAssignTenantResponse = apiInstance.mobileAssignAdminUserTenant(assignAdminUserTenantRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileAssignAdminUserTenant")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileAssignAdminUserTenant")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **assignAdminUserTenantRequest** | [**AssignAdminUserTenantRequest**](AssignAdminUserTenantRequest.md)|  | |

### Return type

[**PostAdminUsersAssignTenantResponse**](PostAdminUsersAssignTenantResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileChangeAdminUserTenantRole"></a>
# **mobileChangeAdminUserTenantRole**
> PatchAdminUsersChangeTenantRoleResponse mobileChangeAdminUserTenantRole(changeAdminUserTenantRoleRequest)

Cambiar el rol de un usuario dentro de una empresa

Actualiza el rol operativo (manager, economico o dependiente) de la membresía existente de un usuario en una empresa.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val changeAdminUserTenantRoleRequest : ChangeAdminUserTenantRoleRequest =  // ChangeAdminUserTenantRoleRequest | 
try {
    val result : PatchAdminUsersChangeTenantRoleResponse = apiInstance.mobileChangeAdminUserTenantRole(changeAdminUserTenantRoleRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileChangeAdminUserTenantRole")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileChangeAdminUserTenantRole")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **changeAdminUserTenantRoleRequest** | [**ChangeAdminUserTenantRoleRequest**](ChangeAdminUserTenantRoleRequest.md)|  | |

### Return type

[**PatchAdminUsersChangeTenantRoleResponse**](PatchAdminUsersChangeTenantRoleResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileDeactivateAdminLicense"></a>
# **mobileDeactivateAdminLicense**
> PostAdminLicensesDeactivateResponse mobileDeactivateAdminLicense(adminLicenciaIdRequest)

Desactivar una licencia

Desactiva una licencia activa de una empresa, suspendiendo el acceso de sus usuarios hasta que se reactive o renueve.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminLicenciaIdRequest : AdminLicenciaIdRequest =  // AdminLicenciaIdRequest | 
try {
    val result : PostAdminLicensesDeactivateResponse = apiInstance.mobileDeactivateAdminLicense(adminLicenciaIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileDeactivateAdminLicense")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileDeactivateAdminLicense")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md)|  | |

### Return type

[**PostAdminLicensesDeactivateResponse**](PostAdminLicensesDeactivateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileDeactivateAdminTenant"></a>
# **mobileDeactivateAdminTenant**
> PostAdminTenantsDeactivateResponse mobileDeactivateAdminTenant(adminTenantIdRequest)

Desactivar una empresa

Desactiva una empresa bloqueando el acceso de todos sus miembros al desactivar sus membresías. No modifica las licencias.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminTenantIdRequest : AdminTenantIdRequest =  // AdminTenantIdRequest | 
try {
    val result : PostAdminTenantsDeactivateResponse = apiInstance.mobileDeactivateAdminTenant(adminTenantIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileDeactivateAdminTenant")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileDeactivateAdminTenant")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminTenantIdRequest** | [**AdminTenantIdRequest**](AdminTenantIdRequest.md)|  | |

### Return type

[**PostAdminTenantsDeactivateResponse**](PostAdminTenantsDeactivateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileDeactivateAdminTenantLicense"></a>
# **mobileDeactivateAdminTenantLicense**
> PostAdminTenantsLicenseDeactivateResponse mobileDeactivateAdminTenantLicense(adminLicenciaIdRequest)

Desactivar la licencia de una empresa

Desactiva una licencia específica de una empresa, suspendiendo el acceso asociado hasta que se reactive o renueve.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminLicenciaIdRequest : AdminLicenciaIdRequest =  // AdminLicenciaIdRequest | 
try {
    val result : PostAdminTenantsLicenseDeactivateResponse = apiInstance.mobileDeactivateAdminTenantLicense(adminLicenciaIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileDeactivateAdminTenantLicense")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileDeactivateAdminTenantLicense")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md)|  | |

### Return type

[**PostAdminTenantsLicenseDeactivateResponse**](PostAdminTenantsLicenseDeactivateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileDeactivateAdminUser"></a>
# **mobileDeactivateAdminUser**
> PostAdminUsersDeactivateResponse mobileDeactivateAdminUser(adminUserIdRequest)

Desactivar un usuario

Desactiva el acceso de un usuario y revoca de inmediato todas sus sesiones activas. No permite desactivar la propia cuenta ni al último administrador activo de la plataforma.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminUserIdRequest : AdminUserIdRequest =  // AdminUserIdRequest | 
try {
    val result : PostAdminUsersDeactivateResponse = apiInstance.mobileDeactivateAdminUser(adminUserIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileDeactivateAdminUser")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileDeactivateAdminUser")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | |

### Return type

[**PostAdminUsersDeactivateResponse**](PostAdminUsersDeactivateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileDeleteAdminLicense"></a>
# **mobileDeleteAdminLicense**
> PostAdminLicensesDeleteResponse mobileDeleteAdminLicense(adminLicenciaIdRequest)

Eliminar una licencia

Elimina permanentemente una licencia de una empresa. Es una operación irreversible: la empresa queda sin licencia hasta que se le asigne una nueva.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminLicenciaIdRequest : AdminLicenciaIdRequest =  // AdminLicenciaIdRequest | 
try {
    val result : PostAdminLicensesDeleteResponse = apiInstance.mobileDeleteAdminLicense(adminLicenciaIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileDeleteAdminLicense")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileDeleteAdminLicense")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md)|  | |

### Return type

[**PostAdminLicensesDeleteResponse**](PostAdminLicensesDeleteResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileDeleteAdminTenant"></a>
# **mobileDeleteAdminTenant**
> PostAdminTenantsDeleteResponse mobileDeleteAdminTenant(adminTenantIdRequest)

Eliminar una empresa

Elimina permanentemente una empresa y todos sus datos asociados. Es una operación irreversible.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminTenantIdRequest : AdminTenantIdRequest =  // AdminTenantIdRequest | 
try {
    val result : PostAdminTenantsDeleteResponse = apiInstance.mobileDeleteAdminTenant(adminTenantIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileDeleteAdminTenant")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileDeleteAdminTenant")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminTenantIdRequest** | [**AdminTenantIdRequest**](AdminTenantIdRequest.md)|  | |

### Return type

[**PostAdminTenantsDeleteResponse**](PostAdminTenantsDeleteResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileDeleteAdminUser"></a>
# **mobileDeleteAdminUser**
> PostAdminUsersDeleteResponse mobileDeleteAdminUser(adminUserIdRequest)

Eliminar un usuario

Elimina permanentemente un usuario de la plataforma. Bloquea la operación si es un gestor de ventas con registros asociados, si es la propia cuenta o si es el último administrador activo.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminUserIdRequest : AdminUserIdRequest =  // AdminUserIdRequest | 
try {
    val result : PostAdminUsersDeleteResponse = apiInstance.mobileDeleteAdminUser(adminUserIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileDeleteAdminUser")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileDeleteAdminUser")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | |

### Return type

[**PostAdminUsersDeleteResponse**](PostAdminUsersDeleteResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileGetAdminActivityLogs"></a>
# **mobileGetAdminActivityLogs**
> GetAdminActivityLogsResponse mobileGetAdminActivityLogs(userId, limit)

Obtener el registro de actividad de los usuarios

Devuelve las entradas del registro de actividad ordenadas por fecha descendente, con filtro opcional por usuario. Paridad con la pestaña de actividad del admin web.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val userId : kotlin.String = userId_example // kotlin.String | Identificador del usuario a filtrar.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de entradas a devolver.
try {
    val result : GetAdminActivityLogsResponse = apiInstance.mobileGetAdminActivityLogs(userId, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminActivityLogs")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminActivityLogs")
    e.printStackTrace()
}
```

### Parameters
| **userId** | **kotlin.String**| Identificador del usuario a filtrar. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de entradas a devolver. | [optional] |

### Return type

[**GetAdminActivityLogsResponse**](GetAdminActivityLogsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
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

<a id="mobileGetAdminSessions"></a>
# **mobileGetAdminSessions**
> GetAdminSessionsResponse mobileGetAdminSessions()

Listar las sesiones registradas

Lista las sesiones registradas en la plataforma ordenadas por fecha descendente, con los datos del usuario. Paridad con la pestaña de sesiones del admin web.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
try {
    val result : GetAdminSessionsResponse = apiInstance.mobileGetAdminSessions()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminSessions")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminSessions")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAdminSessionsResponse**](GetAdminSessionsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAdminTenantDetail"></a>
# **mobileGetAdminTenantDetail**
> GetAdminTenantDetailResponse mobileGetAdminTenantDetail(tenantId)

Obtener el detalle de una empresa

Devuelve la ficha completa de una empresa sin descargar la lista entera: datos fiscales, licencia vigente, miembros activos y conteos de usuarios, productos, almacenes y clientes.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val tenantId : kotlin.String = tenantId_example // kotlin.String | Identificador de la empresa.
try {
    val result : GetAdminTenantDetailResponse = apiInstance.mobileGetAdminTenantDetail(tenantId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminTenantDetail")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminTenantDetail")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tenantId** | **kotlin.String**| Identificador de la empresa. | |

### Return type

[**GetAdminTenantDetailResponse**](GetAdminTenantDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAdminTenantLicense"></a>
# **mobileGetAdminTenantLicense**
> GetAdminTenantLicenseResponse mobileGetAdminTenantLicense(tenantId)

Ver las licencias de una empresa

Devuelve el historial de licencias de una empresa ordenado por creación junto con la licencia vigente, si existe.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val tenantId : kotlin.String = tenantId_example // kotlin.String | Identificador de la empresa.
try {
    val result : GetAdminTenantLicenseResponse = apiInstance.mobileGetAdminTenantLicense(tenantId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminTenantLicense")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminTenantLicense")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tenantId** | **kotlin.String**| Identificador de la empresa. | |

### Return type

[**GetAdminTenantLicenseResponse**](GetAdminTenantLicenseResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAdminTenantUsers"></a>
# **mobileGetAdminTenantUsers**
> GetAdminTenantUsersResponse mobileGetAdminTenantUsers(tenantId)

Listar los usuarios de una empresa

Lista los usuarios pertenecientes a una empresa con su rol operativo y el estado de su membresía, sin descargar el listado global.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val tenantId : kotlin.String = tenantId_example // kotlin.String | Identificador de la empresa.
try {
    val result : GetAdminTenantUsersResponse = apiInstance.mobileGetAdminTenantUsers(tenantId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminTenantUsers")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminTenantUsers")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tenantId** | **kotlin.String**| Identificador de la empresa. | |

### Return type

[**GetAdminTenantUsersResponse**](GetAdminTenantUsersResponse.md)

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

<a id="mobileGetAdminUserDetail"></a>
# **mobileGetAdminUserDetail**
> GetAdminUserDetailResponse mobileGetAdminUserDetail(userId)

Obtener el detalle de un usuario

Devuelve la ficha completa de un usuario de la plataforma sin descargar la lista entera: datos personales, estado, verificación de email, membresías por empresa y conteo de sesiones activas.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val userId : kotlin.String = userId_example // kotlin.String | Identificador del usuario a consultar.
try {
    val result : GetAdminUserDetailResponse = apiInstance.mobileGetAdminUserDetail(userId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminUserDetail")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminUserDetail")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **userId** | **kotlin.String**| Identificador del usuario a consultar. | |

### Return type

[**GetAdminUserDetailResponse**](GetAdminUserDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAdminUserLoginHistory"></a>
# **mobileGetAdminUserLoginHistory**
> GetAdminUserLoginHistoryResponse mobileGetAdminUserLoginHistory(userId, limit)

Obtener el historial de sesiones de un usuario

Devuelve el historial de inicios de sesión de un usuario ordenado por fecha descendente. Paridad con el diálogo de historial del admin web.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val userId : kotlin.String = userId_example // kotlin.String | Identificador del usuario.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de entradas a devolver.
try {
    val result : GetAdminUserLoginHistoryResponse = apiInstance.mobileGetAdminUserLoginHistory(userId, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileGetAdminUserLoginHistory")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileGetAdminUserLoginHistory")
    e.printStackTrace()
}
```

### Parameters
| **userId** | **kotlin.String**| Identificador del usuario. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de entradas a devolver. | [optional] |

### Return type

[**GetAdminUserLoginHistoryResponse**](GetAdminUserLoginHistoryResponse.md)

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

<a id="mobileRemoveAdminTenantUser"></a>
# **mobileRemoveAdminTenantUser**
> PostAdminTenantsRemoveUserResponse mobileRemoveAdminTenantUser(adminRemoveTenantUserRequest)

Quitar un usuario de una empresa

Quita un usuario de una empresa desactivando su membresía, sin eliminar su cuenta de la plataforma. Es reversible reasignándolo.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminRemoveTenantUserRequest : AdminRemoveTenantUserRequest =  // AdminRemoveTenantUserRequest | 
try {
    val result : PostAdminTenantsRemoveUserResponse = apiInstance.mobileRemoveAdminTenantUser(adminRemoveTenantUserRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileRemoveAdminTenantUser")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileRemoveAdminTenantUser")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminRemoveTenantUserRequest** | [**AdminRemoveTenantUserRequest**](AdminRemoveTenantUserRequest.md)|  | |

### Return type

[**PostAdminTenantsRemoveUserResponse**](PostAdminTenantsRemoveUserResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileRenewAdminLicense"></a>
# **mobileRenewAdminLicense**
> PostAdminLicensesRenewResponse mobileRenewAdminLicense(renewAdminLicenseRequest)

Renovar una licencia

Renueva una licencia extendiendo su expiración según la duración del plan indicado (o el actual), sincronizando límites y reactivando a los usuarios de la empresa. No registra pagos; el registro de pagos se hace desde la web.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val renewAdminLicenseRequest : RenewAdminLicenseRequest =  // RenewAdminLicenseRequest | 
try {
    val result : PostAdminLicensesRenewResponse = apiInstance.mobileRenewAdminLicense(renewAdminLicenseRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileRenewAdminLicense")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileRenewAdminLicense")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **renewAdminLicenseRequest** | [**RenewAdminLicenseRequest**](RenewAdminLicenseRequest.md)|  | |

### Return type

[**PostAdminLicensesRenewResponse**](PostAdminLicensesRenewResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileResendAdminUserVerification"></a>
# **mobileResendAdminUserVerification**
> PostAdminUsersResendVerificationResponse mobileResendAdminUserVerification(adminUserIdRequest)

Reenviar el email de verificación

Genera un nuevo enlace de verificación y lo reenvía al correo del usuario. Falla si el correo ya fue verificado previamente.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminUserIdRequest : AdminUserIdRequest =  // AdminUserIdRequest | 
try {
    val result : PostAdminUsersResendVerificationResponse = apiInstance.mobileResendAdminUserVerification(adminUserIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileResendAdminUserVerification")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileResendAdminUserVerification")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | |

### Return type

[**PostAdminUsersResendVerificationResponse**](PostAdminUsersResendVerificationResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileResetAdminUserPassword"></a>
# **mobileResetAdminUserPassword**
> PostAdminUsersResetPasswordResponse mobileResetAdminUserPassword(adminUserIdRequest)

Enviar enlace de restablecimiento de contraseña

Genera un enlace temporal de restablecimiento de contraseña y lo envía al correo del usuario. El administrador nunca ve ni define la contraseña del usuario.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminUserIdRequest : AdminUserIdRequest =  // AdminUserIdRequest | 
try {
    val result : PostAdminUsersResetPasswordResponse = apiInstance.mobileResetAdminUserPassword(adminUserIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileResetAdminUserPassword")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileResetAdminUserPassword")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | |

### Return type

[**PostAdminUsersResetPasswordResponse**](PostAdminUsersResetPasswordResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileRevokeAdminSession"></a>
# **mobileRevokeAdminSession**
> PostAdminSessionsRevokeResponse mobileRevokeAdminSession(adminRevokeSessionRequest)

Revocar una sesión específica

Revoca una sesión puntual de un usuario, cerrando su acceso en ese dispositivo. A diferencia de la acción web equivalente, elimina por el identificador real de la sesión.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminRevokeSessionRequest : AdminRevokeSessionRequest =  // AdminRevokeSessionRequest | 
try {
    val result : PostAdminSessionsRevokeResponse = apiInstance.mobileRevokeAdminSession(adminRevokeSessionRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileRevokeAdminSession")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileRevokeAdminSession")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminRevokeSessionRequest** | [**AdminRevokeSessionRequest**](AdminRevokeSessionRequest.md)|  | |

### Return type

[**PostAdminSessionsRevokeResponse**](PostAdminSessionsRevokeResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileRevokeAdminUserSessions"></a>
# **mobileRevokeAdminUserSessions**
> PostAdminUsersRevokeSessionsResponse mobileRevokeAdminUserSessions(adminUserIdRequest)

Revocar las sesiones activas de un usuario

Invalida todas las sesiones activas del usuario, forzando un nuevo inicio de sesión en cada dispositivo donde estuviera conectado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminUserIdRequest : AdminUserIdRequest =  // AdminUserIdRequest | 
try {
    val result : PostAdminUsersRevokeSessionsResponse = apiInstance.mobileRevokeAdminUserSessions(adminUserIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileRevokeAdminUserSessions")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileRevokeAdminUserSessions")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | |

### Return type

[**PostAdminUsersRevokeSessionsResponse**](PostAdminUsersRevokeSessionsResponse.md)

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

<a id="mobileUpdateAdminTenant"></a>
# **mobileUpdateAdminTenant**
> PatchAdminTenantsUpdateResponse mobileUpdateAdminTenant(updateAdminTenantRequest)

Editar los datos de una empresa

Actualiza el nombre, los datos fiscales y la configuración de una empresa. Valida que el identificador público no esté en uso por otra empresa.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val updateAdminTenantRequest : UpdateAdminTenantRequest =  // UpdateAdminTenantRequest | 
try {
    val result : PatchAdminTenantsUpdateResponse = apiInstance.mobileUpdateAdminTenant(updateAdminTenantRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileUpdateAdminTenant")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileUpdateAdminTenant")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **updateAdminTenantRequest** | [**UpdateAdminTenantRequest**](UpdateAdminTenantRequest.md)|  | |

### Return type

[**PatchAdminTenantsUpdateResponse**](PatchAdminTenantsUpdateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileUpdateAdminTenantLicense"></a>
# **mobileUpdateAdminTenantLicense**
> PatchAdminTenantsLicenseUpdateResponse mobileUpdateAdminTenantLicense(updateAdminTenantLicenseRequest)

Actualizar la licencia de una empresa

Cambia el plan, los límites o el vencimiento de una licencia. Al cambiar de plan se sincronizan límites y precios del plan, salvo los límites indicados explícitamente.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val updateAdminTenantLicenseRequest : UpdateAdminTenantLicenseRequest =  // UpdateAdminTenantLicenseRequest | 
try {
    val result : PatchAdminTenantsLicenseUpdateResponse = apiInstance.mobileUpdateAdminTenantLicense(updateAdminTenantLicenseRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileUpdateAdminTenantLicense")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileUpdateAdminTenantLicense")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **updateAdminTenantLicenseRequest** | [**UpdateAdminTenantLicenseRequest**](UpdateAdminTenantLicenseRequest.md)|  | |

### Return type

[**PatchAdminTenantsLicenseUpdateResponse**](PatchAdminTenantsLicenseUpdateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileUpdateAdminUser"></a>
# **mobileUpdateAdminUser**
> PatchAdminUsersUpdateResponse mobileUpdateAdminUser(updateAdminUserRequest)

Editar nombre, email o rol de un usuario

Actualiza los datos básicos de un usuario: nombre, correo electrónico o rol de plataforma. Valida que el correo no esté en uso por otro usuario y protege al último administrador activo.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val updateAdminUserRequest : UpdateAdminUserRequest =  // UpdateAdminUserRequest | 
try {
    val result : PatchAdminUsersUpdateResponse = apiInstance.mobileUpdateAdminUser(updateAdminUserRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileUpdateAdminUser")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileUpdateAdminUser")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **updateAdminUserRequest** | [**UpdateAdminUserRequest**](UpdateAdminUserRequest.md)|  | |

### Return type

[**PatchAdminUsersUpdateResponse**](PatchAdminUsersUpdateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileVerifyAdminUserEmail"></a>
# **mobileVerifyAdminUserEmail**
> PostAdminUsersVerifyEmailResponse mobileVerifyAdminUserEmail(adminUserIdRequest)

Marcar el email como verificado

Marca manualmente el correo de un usuario como verificado, sin necesidad de que complete el flujo de verificación por email. Es idempotente si ya estaba verificado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AdminApi()
val adminUserIdRequest : AdminUserIdRequest =  // AdminUserIdRequest | 
try {
    val result : PostAdminUsersVerifyEmailResponse = apiInstance.mobileVerifyAdminUserEmail(adminUserIdRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AdminApi#mobileVerifyAdminUserEmail")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AdminApi#mobileVerifyAdminUserEmail")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md)|  | |

### Return type

[**PostAdminUsersVerifyEmailResponse**](PostAdminUsersVerifyEmailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

