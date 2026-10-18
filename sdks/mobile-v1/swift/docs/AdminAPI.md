# AdminAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileActivateAdminLicense**](AdminAPI.md#mobileactivateadminlicense) | **POST** /admin/licenses/activate | Activar una licencia
[**mobileActivateAdminTenant**](AdminAPI.md#mobileactivateadmintenant) | **POST** /admin/tenants/activate | Activar una empresa
[**mobileActivateAdminUser**](AdminAPI.md#mobileactivateadminuser) | **POST** /admin/users/activate | Activar un usuario
[**mobileApproveAdminMembership**](AdminAPI.md#mobileapproveadminmembership) | **POST** /admin/memberships/approve | Aprobar solicitud de membresía
[**mobileAssignAdminTenantLicense**](AdminAPI.md#mobileassignadmintenantlicense) | **POST** /admin/tenants/license/assign | Asignar una licencia a una empresa
[**mobileAssignAdminUserTenant**](AdminAPI.md#mobileassignadminusertenant) | **POST** /admin/users/assign-tenant | Asignar o cambiar la empresa de un usuario
[**mobileChangeAdminUserTenantRole**](AdminAPI.md#mobilechangeadminusertenantrole) | **PATCH** /admin/users/change-tenant-role | Cambiar el rol de un usuario dentro de una empresa
[**mobileDeactivateAdminLicense**](AdminAPI.md#mobiledeactivateadminlicense) | **POST** /admin/licenses/deactivate | Desactivar una licencia
[**mobileDeactivateAdminTenant**](AdminAPI.md#mobiledeactivateadmintenant) | **POST** /admin/tenants/deactivate | Desactivar una empresa
[**mobileDeactivateAdminTenantLicense**](AdminAPI.md#mobiledeactivateadmintenantlicense) | **POST** /admin/tenants/license/deactivate | Desactivar la licencia de una empresa
[**mobileDeactivateAdminUser**](AdminAPI.md#mobiledeactivateadminuser) | **POST** /admin/users/deactivate | Desactivar un usuario
[**mobileDeleteAdminLicense**](AdminAPI.md#mobiledeleteadminlicense) | **POST** /admin/licenses/delete | Eliminar una licencia
[**mobileDeleteAdminTenant**](AdminAPI.md#mobiledeleteadmintenant) | **POST** /admin/tenants/delete | Eliminar una empresa
[**mobileDeleteAdminUser**](AdminAPI.md#mobiledeleteadminuser) | **POST** /admin/users/delete | Eliminar un usuario
[**mobileGetAdminActivityLogs**](AdminAPI.md#mobilegetadminactivitylogs) | **GET** /admin/activity-logs | Obtener el registro de actividad de los usuarios
[**mobileGetAdminHealth**](AdminAPI.md#mobilegetadminhealth) | **GET** /admin/health | Consultar salud del sistema
[**mobileGetAdminLicenseStats**](AdminAPI.md#mobilegetadminlicensestats) | **GET** /admin/licenses/stats | Consultar métricas de licencias
[**mobileGetAdminLicenses**](AdminAPI.md#mobilegetadminlicenses) | **GET** /admin/licenses | Listar licencias con filtros
[**mobileGetAdminPendingMemberships**](AdminAPI.md#mobilegetadminpendingmemberships) | **GET** /admin/memberships/pending | Listar solicitudes de membresía pendientes
[**mobileGetAdminSessions**](AdminAPI.md#mobilegetadminsessions) | **GET** /admin/sessions | Listar las sesiones registradas
[**mobileGetAdminTenantDetail**](AdminAPI.md#mobilegetadmintenantdetail) | **GET** /admin/tenants/detail | Obtener el detalle de una empresa
[**mobileGetAdminTenantLicense**](AdminAPI.md#mobilegetadmintenantlicense) | **GET** /admin/tenants/license | Ver las licencias de una empresa
[**mobileGetAdminTenantUsers**](AdminAPI.md#mobilegetadmintenantusers) | **GET** /admin/tenants/users | Listar los usuarios de una empresa
[**mobileGetAdminTenants**](AdminAPI.md#mobilegetadmintenants) | **GET** /admin/tenants | Listar empresas de la plataforma
[**mobileGetAdminUserDetail**](AdminAPI.md#mobilegetadminuserdetail) | **GET** /admin/users/detail | Obtener el detalle de un usuario
[**mobileGetAdminUserLoginHistory**](AdminAPI.md#mobilegetadminuserloginhistory) | **GET** /admin/users/login-history | Obtener el historial de sesiones de un usuario
[**mobileGetAdminUsers**](AdminAPI.md#mobilegetadminusers) | **GET** /admin/users | Listar usuarios de la plataforma
[**mobileLockAdminUser**](AdminAPI.md#mobilelockadminuser) | **POST** /admin/users/lock | Bloquear usuario por 24 horas
[**mobileRejectAdminMembership**](AdminAPI.md#mobilerejectadminmembership) | **POST** /admin/memberships/reject | Rechazar solicitud de membresía
[**mobileRemoveAdminTenantUser**](AdminAPI.md#mobileremoveadmintenantuser) | **POST** /admin/tenants/remove-user | Quitar un usuario de una empresa
[**mobileRenewAdminLicense**](AdminAPI.md#mobilerenewadminlicense) | **POST** /admin/licenses/renew | Renovar una licencia
[**mobileResendAdminUserVerification**](AdminAPI.md#mobileresendadminuserverification) | **POST** /admin/users/resend-verification | Reenviar el email de verificación
[**mobileResetAdminUserPassword**](AdminAPI.md#mobileresetadminuserpassword) | **POST** /admin/users/reset-password | Enviar enlace de restablecimiento de contraseña
[**mobileRevokeAdminSession**](AdminAPI.md#mobilerevokeadminsession) | **POST** /admin/sessions/revoke | Revocar una sesión específica
[**mobileRevokeAdminUserSessions**](AdminAPI.md#mobilerevokeadminusersessions) | **POST** /admin/users/revoke-sessions | Revocar las sesiones activas de un usuario
[**mobileUnlockAdminUser**](AdminAPI.md#mobileunlockadminuser) | **POST** /admin/users/unlock | Desbloquear usuario
[**mobileUpdateAdminTenant**](AdminAPI.md#mobileupdateadmintenant) | **PATCH** /admin/tenants/update | Editar los datos de una empresa
[**mobileUpdateAdminTenantLicense**](AdminAPI.md#mobileupdateadmintenantlicense) | **PATCH** /admin/tenants/license/update | Actualizar la licencia de una empresa
[**mobileUpdateAdminUser**](AdminAPI.md#mobileupdateadminuser) | **PATCH** /admin/users/update | Editar nombre, email o rol de un usuario
[**mobileVerifyAdminUserEmail**](AdminAPI.md#mobileverifyadminuseremail) | **POST** /admin/users/verify-email | Marcar el email como verificado


# **mobileActivateAdminLicense**
```swift
    open class func mobileActivateAdminLicense(adminLicenciaIdRequest: AdminLicenciaIdRequest, completion: @escaping (_ data: PostAdminLicensesActivateResponse?, _ error: Error?) -> Void)
```

Activar una licencia

Activa una licencia desactivada de una empresa, restituyendo el acceso a sus usuarios dentro del período de vigencia.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminLicenciaIdRequest = AdminLicenciaIdRequest(tenantLicenseId: "tenantLicenseId_example") // AdminLicenciaIdRequest | 

// Activar una licencia
AdminAPI.mobileActivateAdminLicense(adminLicenciaIdRequest: adminLicenciaIdRequest) { (response, error) in
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
 **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md) |  | 

### Return type

[**PostAdminLicensesActivateResponse**](PostAdminLicensesActivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileActivateAdminTenant**
```swift
    open class func mobileActivateAdminTenant(adminTenantIdRequest: AdminTenantIdRequest, completion: @escaping (_ data: PostAdminTenantsActivateResponse?, _ error: Error?) -> Void)
```

Activar una empresa

Activa una empresa reactivando todas sus membresías, restituyendo el acceso de sus miembros. No modifica las licencias.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminTenantIdRequest = AdminTenantIdRequest(tenantId: "tenantId_example") // AdminTenantIdRequest | 

// Activar una empresa
AdminAPI.mobileActivateAdminTenant(adminTenantIdRequest: adminTenantIdRequest) { (response, error) in
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
 **adminTenantIdRequest** | [**AdminTenantIdRequest**](AdminTenantIdRequest.md) |  | 

### Return type

[**PostAdminTenantsActivateResponse**](PostAdminTenantsActivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileActivateAdminUser**
```swift
    open class func mobileActivateAdminUser(adminUserIdRequest: AdminUserIdRequest, completion: @escaping (_ data: PostAdminUsersActivateResponse?, _ error: Error?) -> Void)
```

Activar un usuario

Reactiva el acceso de un usuario desactivado, limpiando además cualquier bloqueo temporal y los intentos fallidos de inicio de sesión acumulados.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminUserIdRequest = AdminUserIdRequest(userId: "userId_example") // AdminUserIdRequest | 

// Activar un usuario
AdminAPI.mobileActivateAdminUser(adminUserIdRequest: adminUserIdRequest) { (response, error) in
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
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md) |  | 

### Return type

[**PostAdminUsersActivateResponse**](PostAdminUsersActivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

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

# **mobileAssignAdminTenantLicense**
```swift
    open class func mobileAssignAdminTenantLicense(assignAdminTenantLicenseRequest: AssignAdminTenantLicenseRequest, completion: @escaping (_ data: PostAdminTenantsLicenseAssignResponse?, _ error: Error?) -> Void)
```

Asignar una licencia a una empresa

Crea una licencia nueva para la empresa con el plan indicado, desactivando las licencias vigentes anteriores para evitar ambigüedad. Calcula inicio y vencimiento desde la duración del plan.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let assignAdminTenantLicenseRequest = AssignAdminTenantLicenseRequest(tenantId: "tenantId_example", planId: "planId_example", durationDays: 123, inicio: Date(), expiracion: Date(), activa: false) // AssignAdminTenantLicenseRequest | 

// Asignar una licencia a una empresa
AdminAPI.mobileAssignAdminTenantLicense(assignAdminTenantLicenseRequest: assignAdminTenantLicenseRequest) { (response, error) in
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
 **assignAdminTenantLicenseRequest** | [**AssignAdminTenantLicenseRequest**](AssignAdminTenantLicenseRequest.md) |  | 

### Return type

[**PostAdminTenantsLicenseAssignResponse**](PostAdminTenantsLicenseAssignResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileAssignAdminUserTenant**
```swift
    open class func mobileAssignAdminUserTenant(assignAdminUserTenantRequest: AssignAdminUserTenantRequest, completion: @escaping (_ data: PostAdminUsersAssignTenantResponse?, _ error: Error?) -> Void)
```

Asignar o cambiar la empresa de un usuario

Crea o actualiza la membresía de un usuario en una empresa con el rol operativo indicado. Puede desactivar las demás membresías para efectuar un cambio de empresa.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let assignAdminUserTenantRequest = AssignAdminUserTenantRequest(userId: "userId_example", tenantId: "tenantId_example", tenantRole: "tenantRole_example", deactivateOthers: false) // AssignAdminUserTenantRequest | 

// Asignar o cambiar la empresa de un usuario
AdminAPI.mobileAssignAdminUserTenant(assignAdminUserTenantRequest: assignAdminUserTenantRequest) { (response, error) in
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
 **assignAdminUserTenantRequest** | [**AssignAdminUserTenantRequest**](AssignAdminUserTenantRequest.md) |  | 

### Return type

[**PostAdminUsersAssignTenantResponse**](PostAdminUsersAssignTenantResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileChangeAdminUserTenantRole**
```swift
    open class func mobileChangeAdminUserTenantRole(changeAdminUserTenantRoleRequest: ChangeAdminUserTenantRoleRequest, completion: @escaping (_ data: PatchAdminUsersChangeTenantRoleResponse?, _ error: Error?) -> Void)
```

Cambiar el rol de un usuario dentro de una empresa

Actualiza el rol operativo (manager, economico o dependiente) de la membresía existente de un usuario en una empresa.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let changeAdminUserTenantRoleRequest = ChangeAdminUserTenantRoleRequest(userId: "userId_example", tenantId: "tenantId_example", tenantRole: "tenantRole_example") // ChangeAdminUserTenantRoleRequest | 

// Cambiar el rol de un usuario dentro de una empresa
AdminAPI.mobileChangeAdminUserTenantRole(changeAdminUserTenantRoleRequest: changeAdminUserTenantRoleRequest) { (response, error) in
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
 **changeAdminUserTenantRoleRequest** | [**ChangeAdminUserTenantRoleRequest**](ChangeAdminUserTenantRoleRequest.md) |  | 

### Return type

[**PatchAdminUsersChangeTenantRoleResponse**](PatchAdminUsersChangeTenantRoleResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeactivateAdminLicense**
```swift
    open class func mobileDeactivateAdminLicense(adminLicenciaIdRequest: AdminLicenciaIdRequest, completion: @escaping (_ data: PostAdminLicensesDeactivateResponse?, _ error: Error?) -> Void)
```

Desactivar una licencia

Desactiva una licencia activa de una empresa, suspendiendo el acceso de sus usuarios hasta que se reactive o renueve.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminLicenciaIdRequest = AdminLicenciaIdRequest(tenantLicenseId: "tenantLicenseId_example") // AdminLicenciaIdRequest | 

// Desactivar una licencia
AdminAPI.mobileDeactivateAdminLicense(adminLicenciaIdRequest: adminLicenciaIdRequest) { (response, error) in
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
 **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md) |  | 

### Return type

[**PostAdminLicensesDeactivateResponse**](PostAdminLicensesDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeactivateAdminTenant**
```swift
    open class func mobileDeactivateAdminTenant(adminTenantIdRequest: AdminTenantIdRequest, completion: @escaping (_ data: PostAdminTenantsDeactivateResponse?, _ error: Error?) -> Void)
```

Desactivar una empresa

Desactiva una empresa bloqueando el acceso de todos sus miembros al desactivar sus membresías. No modifica las licencias.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminTenantIdRequest = AdminTenantIdRequest(tenantId: "tenantId_example") // AdminTenantIdRequest | 

// Desactivar una empresa
AdminAPI.mobileDeactivateAdminTenant(adminTenantIdRequest: adminTenantIdRequest) { (response, error) in
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
 **adminTenantIdRequest** | [**AdminTenantIdRequest**](AdminTenantIdRequest.md) |  | 

### Return type

[**PostAdminTenantsDeactivateResponse**](PostAdminTenantsDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeactivateAdminTenantLicense**
```swift
    open class func mobileDeactivateAdminTenantLicense(adminLicenciaIdRequest: AdminLicenciaIdRequest, completion: @escaping (_ data: PostAdminTenantsLicenseDeactivateResponse?, _ error: Error?) -> Void)
```

Desactivar la licencia de una empresa

Desactiva una licencia específica de una empresa, suspendiendo el acceso asociado hasta que se reactive o renueve.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminLicenciaIdRequest = AdminLicenciaIdRequest(tenantLicenseId: "tenantLicenseId_example") // AdminLicenciaIdRequest | 

// Desactivar la licencia de una empresa
AdminAPI.mobileDeactivateAdminTenantLicense(adminLicenciaIdRequest: adminLicenciaIdRequest) { (response, error) in
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
 **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md) |  | 

### Return type

[**PostAdminTenantsLicenseDeactivateResponse**](PostAdminTenantsLicenseDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeactivateAdminUser**
```swift
    open class func mobileDeactivateAdminUser(adminUserIdRequest: AdminUserIdRequest, completion: @escaping (_ data: PostAdminUsersDeactivateResponse?, _ error: Error?) -> Void)
```

Desactivar un usuario

Desactiva el acceso de un usuario y revoca de inmediato todas sus sesiones activas. No permite desactivar la propia cuenta ni al último administrador activo de la plataforma.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminUserIdRequest = AdminUserIdRequest(userId: "userId_example") // AdminUserIdRequest | 

// Desactivar un usuario
AdminAPI.mobileDeactivateAdminUser(adminUserIdRequest: adminUserIdRequest) { (response, error) in
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
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md) |  | 

### Return type

[**PostAdminUsersDeactivateResponse**](PostAdminUsersDeactivateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeleteAdminLicense**
```swift
    open class func mobileDeleteAdminLicense(adminLicenciaIdRequest: AdminLicenciaIdRequest, completion: @escaping (_ data: PostAdminLicensesDeleteResponse?, _ error: Error?) -> Void)
```

Eliminar una licencia

Elimina permanentemente una licencia de una empresa. Es una operación irreversible: la empresa queda sin licencia hasta que se le asigne una nueva.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminLicenciaIdRequest = AdminLicenciaIdRequest(tenantLicenseId: "tenantLicenseId_example") // AdminLicenciaIdRequest | 

// Eliminar una licencia
AdminAPI.mobileDeleteAdminLicense(adminLicenciaIdRequest: adminLicenciaIdRequest) { (response, error) in
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
 **adminLicenciaIdRequest** | [**AdminLicenciaIdRequest**](AdminLicenciaIdRequest.md) |  | 

### Return type

[**PostAdminLicensesDeleteResponse**](PostAdminLicensesDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeleteAdminTenant**
```swift
    open class func mobileDeleteAdminTenant(adminTenantIdRequest: AdminTenantIdRequest, completion: @escaping (_ data: PostAdminTenantsDeleteResponse?, _ error: Error?) -> Void)
```

Eliminar una empresa

Elimina permanentemente una empresa y todos sus datos asociados. Es una operación irreversible.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminTenantIdRequest = AdminTenantIdRequest(tenantId: "tenantId_example") // AdminTenantIdRequest | 

// Eliminar una empresa
AdminAPI.mobileDeleteAdminTenant(adminTenantIdRequest: adminTenantIdRequest) { (response, error) in
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
 **adminTenantIdRequest** | [**AdminTenantIdRequest**](AdminTenantIdRequest.md) |  | 

### Return type

[**PostAdminTenantsDeleteResponse**](PostAdminTenantsDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeleteAdminUser**
```swift
    open class func mobileDeleteAdminUser(adminUserIdRequest: AdminUserIdRequest, completion: @escaping (_ data: PostAdminUsersDeleteResponse?, _ error: Error?) -> Void)
```

Eliminar un usuario

Elimina permanentemente un usuario de la plataforma. Bloquea la operación si es un gestor de ventas con registros asociados, si es la propia cuenta o si es el último administrador activo.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminUserIdRequest = AdminUserIdRequest(userId: "userId_example") // AdminUserIdRequest | 

// Eliminar un usuario
AdminAPI.mobileDeleteAdminUser(adminUserIdRequest: adminUserIdRequest) { (response, error) in
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
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md) |  | 

### Return type

[**PostAdminUsersDeleteResponse**](PostAdminUsersDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminActivityLogs**
```swift
    open class func mobileGetAdminActivityLogs(userId: String? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAdminActivityLogsResponse?, _ error: Error?) -> Void)
```

Obtener el registro de actividad de los usuarios

Devuelve las entradas del registro de actividad ordenadas por fecha descendente, con filtro opcional por usuario. Paridad con la pestaña de actividad del admin web.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let userId = "userId_example" // String | Identificador del usuario a filtrar. (optional)
let limit = 987 // Int | Cantidad máxima de entradas a devolver. (optional)

// Obtener el registro de actividad de los usuarios
AdminAPI.mobileGetAdminActivityLogs(userId: userId, limit: limit) { (response, error) in
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
 **userId** | **String** | Identificador del usuario a filtrar. | [optional] 
 **limit** | **Int** | Cantidad máxima de entradas a devolver. | [optional] 

### Return type

[**GetAdminActivityLogsResponse**](GetAdminActivityLogsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
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

# **mobileGetAdminSessions**
```swift
    open class func mobileGetAdminSessions(completion: @escaping (_ data: GetAdminSessionsResponse?, _ error: Error?) -> Void)
```

Listar las sesiones registradas

Lista las sesiones registradas en la plataforma ordenadas por fecha descendente, con los datos del usuario. Paridad con la pestaña de sesiones del admin web.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar las sesiones registradas
AdminAPI.mobileGetAdminSessions() { (response, error) in
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

[**GetAdminSessionsResponse**](GetAdminSessionsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminTenantDetail**
```swift
    open class func mobileGetAdminTenantDetail(tenantId: String, completion: @escaping (_ data: GetAdminTenantDetailResponse?, _ error: Error?) -> Void)
```

Obtener el detalle de una empresa

Devuelve la ficha completa de una empresa sin descargar la lista entera: datos fiscales, licencia vigente, miembros activos y conteos de usuarios, productos, almacenes y clientes.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let tenantId = "tenantId_example" // String | Identificador de la empresa.

// Obtener el detalle de una empresa
AdminAPI.mobileGetAdminTenantDetail(tenantId: tenantId) { (response, error) in
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
 **tenantId** | **String** | Identificador de la empresa. | 

### Return type

[**GetAdminTenantDetailResponse**](GetAdminTenantDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminTenantLicense**
```swift
    open class func mobileGetAdminTenantLicense(tenantId: String, completion: @escaping (_ data: GetAdminTenantLicenseResponse?, _ error: Error?) -> Void)
```

Ver las licencias de una empresa

Devuelve el historial de licencias de una empresa ordenado por creación junto con la licencia vigente, si existe.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let tenantId = "tenantId_example" // String | Identificador de la empresa.

// Ver las licencias de una empresa
AdminAPI.mobileGetAdminTenantLicense(tenantId: tenantId) { (response, error) in
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
 **tenantId** | **String** | Identificador de la empresa. | 

### Return type

[**GetAdminTenantLicenseResponse**](GetAdminTenantLicenseResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminTenantUsers**
```swift
    open class func mobileGetAdminTenantUsers(tenantId: String, completion: @escaping (_ data: GetAdminTenantUsersResponse?, _ error: Error?) -> Void)
```

Listar los usuarios de una empresa

Lista los usuarios pertenecientes a una empresa con su rol operativo y el estado de su membresía, sin descargar el listado global.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let tenantId = "tenantId_example" // String | Identificador de la empresa.

// Listar los usuarios de una empresa
AdminAPI.mobileGetAdminTenantUsers(tenantId: tenantId) { (response, error) in
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
 **tenantId** | **String** | Identificador de la empresa. | 

### Return type

[**GetAdminTenantUsersResponse**](GetAdminTenantUsersResponse.md)

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

# **mobileGetAdminUserDetail**
```swift
    open class func mobileGetAdminUserDetail(userId: String, completion: @escaping (_ data: GetAdminUserDetailResponse?, _ error: Error?) -> Void)
```

Obtener el detalle de un usuario

Devuelve la ficha completa de un usuario de la plataforma sin descargar la lista entera: datos personales, estado, verificación de email, membresías por empresa y conteo de sesiones activas.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let userId = "userId_example" // String | Identificador del usuario a consultar.

// Obtener el detalle de un usuario
AdminAPI.mobileGetAdminUserDetail(userId: userId) { (response, error) in
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
 **userId** | **String** | Identificador del usuario a consultar. | 

### Return type

[**GetAdminUserDetailResponse**](GetAdminUserDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAdminUserLoginHistory**
```swift
    open class func mobileGetAdminUserLoginHistory(userId: String, limit: Int? = nil, completion: @escaping (_ data: GetAdminUserLoginHistoryResponse?, _ error: Error?) -> Void)
```

Obtener el historial de sesiones de un usuario

Devuelve el historial de inicios de sesión de un usuario ordenado por fecha descendente. Paridad con el diálogo de historial del admin web.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let userId = "userId_example" // String | Identificador del usuario.
let limit = 987 // Int | Cantidad máxima de entradas a devolver. (optional)

// Obtener el historial de sesiones de un usuario
AdminAPI.mobileGetAdminUserLoginHistory(userId: userId, limit: limit) { (response, error) in
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
 **userId** | **String** | Identificador del usuario. | 
 **limit** | **Int** | Cantidad máxima de entradas a devolver. | [optional] 

### Return type

[**GetAdminUserLoginHistoryResponse**](GetAdminUserLoginHistoryResponse.md)

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

# **mobileRemoveAdminTenantUser**
```swift
    open class func mobileRemoveAdminTenantUser(adminRemoveTenantUserRequest: AdminRemoveTenantUserRequest, completion: @escaping (_ data: PostAdminTenantsRemoveUserResponse?, _ error: Error?) -> Void)
```

Quitar un usuario de una empresa

Quita un usuario de una empresa desactivando su membresía, sin eliminar su cuenta de la plataforma. Es reversible reasignándolo.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminRemoveTenantUserRequest = AdminRemoveTenantUserRequest(tenantId: "tenantId_example", userId: "userId_example") // AdminRemoveTenantUserRequest | 

// Quitar un usuario de una empresa
AdminAPI.mobileRemoveAdminTenantUser(adminRemoveTenantUserRequest: adminRemoveTenantUserRequest) { (response, error) in
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
 **adminRemoveTenantUserRequest** | [**AdminRemoveTenantUserRequest**](AdminRemoveTenantUserRequest.md) |  | 

### Return type

[**PostAdminTenantsRemoveUserResponse**](PostAdminTenantsRemoveUserResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileRenewAdminLicense**
```swift
    open class func mobileRenewAdminLicense(renewAdminLicenseRequest: RenewAdminLicenseRequest, completion: @escaping (_ data: PostAdminLicensesRenewResponse?, _ error: Error?) -> Void)
```

Renovar una licencia

Renueva una licencia extendiendo su expiración según la duración del plan indicado (o el actual), sincronizando límites y reactivando a los usuarios de la empresa. No registra pagos; el registro de pagos se hace desde la web.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let renewAdminLicenseRequest = RenewAdminLicenseRequest(tenantLicenseId: "tenantLicenseId_example", planId: "planId_example", durationDays: 123) // RenewAdminLicenseRequest | 

// Renovar una licencia
AdminAPI.mobileRenewAdminLicense(renewAdminLicenseRequest: renewAdminLicenseRequest) { (response, error) in
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
 **renewAdminLicenseRequest** | [**RenewAdminLicenseRequest**](RenewAdminLicenseRequest.md) |  | 

### Return type

[**PostAdminLicensesRenewResponse**](PostAdminLicensesRenewResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileResendAdminUserVerification**
```swift
    open class func mobileResendAdminUserVerification(adminUserIdRequest: AdminUserIdRequest, completion: @escaping (_ data: PostAdminUsersResendVerificationResponse?, _ error: Error?) -> Void)
```

Reenviar el email de verificación

Genera un nuevo enlace de verificación y lo reenvía al correo del usuario. Falla si el correo ya fue verificado previamente.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminUserIdRequest = AdminUserIdRequest(userId: "userId_example") // AdminUserIdRequest | 

// Reenviar el email de verificación
AdminAPI.mobileResendAdminUserVerification(adminUserIdRequest: adminUserIdRequest) { (response, error) in
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
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md) |  | 

### Return type

[**PostAdminUsersResendVerificationResponse**](PostAdminUsersResendVerificationResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileResetAdminUserPassword**
```swift
    open class func mobileResetAdminUserPassword(adminUserIdRequest: AdminUserIdRequest, completion: @escaping (_ data: PostAdminUsersResetPasswordResponse?, _ error: Error?) -> Void)
```

Enviar enlace de restablecimiento de contraseña

Genera un enlace temporal de restablecimiento de contraseña y lo envía al correo del usuario. El administrador nunca ve ni define la contraseña del usuario.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminUserIdRequest = AdminUserIdRequest(userId: "userId_example") // AdminUserIdRequest | 

// Enviar enlace de restablecimiento de contraseña
AdminAPI.mobileResetAdminUserPassword(adminUserIdRequest: adminUserIdRequest) { (response, error) in
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
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md) |  | 

### Return type

[**PostAdminUsersResetPasswordResponse**](PostAdminUsersResetPasswordResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileRevokeAdminSession**
```swift
    open class func mobileRevokeAdminSession(adminRevokeSessionRequest: AdminRevokeSessionRequest, completion: @escaping (_ data: PostAdminSessionsRevokeResponse?, _ error: Error?) -> Void)
```

Revocar una sesión específica

Revoca una sesión puntual de un usuario, cerrando su acceso en ese dispositivo. A diferencia de la acción web equivalente, elimina por el identificador real de la sesión.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminRevokeSessionRequest = AdminRevokeSessionRequest(sessionId: "sessionId_example") // AdminRevokeSessionRequest | 

// Revocar una sesión específica
AdminAPI.mobileRevokeAdminSession(adminRevokeSessionRequest: adminRevokeSessionRequest) { (response, error) in
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
 **adminRevokeSessionRequest** | [**AdminRevokeSessionRequest**](AdminRevokeSessionRequest.md) |  | 

### Return type

[**PostAdminSessionsRevokeResponse**](PostAdminSessionsRevokeResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileRevokeAdminUserSessions**
```swift
    open class func mobileRevokeAdminUserSessions(adminUserIdRequest: AdminUserIdRequest, completion: @escaping (_ data: PostAdminUsersRevokeSessionsResponse?, _ error: Error?) -> Void)
```

Revocar las sesiones activas de un usuario

Invalida todas las sesiones activas del usuario, forzando un nuevo inicio de sesión en cada dispositivo donde estuviera conectado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminUserIdRequest = AdminUserIdRequest(userId: "userId_example") // AdminUserIdRequest | 

// Revocar las sesiones activas de un usuario
AdminAPI.mobileRevokeAdminUserSessions(adminUserIdRequest: adminUserIdRequest) { (response, error) in
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
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md) |  | 

### Return type

[**PostAdminUsersRevokeSessionsResponse**](PostAdminUsersRevokeSessionsResponse.md)

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

# **mobileUpdateAdminTenant**
```swift
    open class func mobileUpdateAdminTenant(updateAdminTenantRequest: UpdateAdminTenantRequest, completion: @escaping (_ data: PatchAdminTenantsUpdateResponse?, _ error: Error?) -> Void)
```

Editar los datos de una empresa

Actualiza el nombre, los datos fiscales y la configuración de una empresa. Valida que el identificador público no esté en uso por otra empresa.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let updateAdminTenantRequest = UpdateAdminTenantRequest(tenantId: "tenantId_example", nombre: "nombre_example", slug: "slug_example", regimenFiscal: "regimenFiscal_example", taxId: "taxId_example", razonSocial: "razonSocial_example", codigoPostalFiscal: "codigoPostalFiscal_example", fiscalActivado: false, contabilidadTimezone: "contabilidadTimezone_example") // UpdateAdminTenantRequest | 

// Editar los datos de una empresa
AdminAPI.mobileUpdateAdminTenant(updateAdminTenantRequest: updateAdminTenantRequest) { (response, error) in
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
 **updateAdminTenantRequest** | [**UpdateAdminTenantRequest**](UpdateAdminTenantRequest.md) |  | 

### Return type

[**PatchAdminTenantsUpdateResponse**](PatchAdminTenantsUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileUpdateAdminTenantLicense**
```swift
    open class func mobileUpdateAdminTenantLicense(updateAdminTenantLicenseRequest: UpdateAdminTenantLicenseRequest, completion: @escaping (_ data: PatchAdminTenantsLicenseUpdateResponse?, _ error: Error?) -> Void)
```

Actualizar la licencia de una empresa

Cambia el plan, los límites o el vencimiento de una licencia. Al cambiar de plan se sincronizan límites y precios del plan, salvo los límites indicados explícitamente.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let updateAdminTenantLicenseRequest = UpdateAdminTenantLicenseRequest(tenantLicenseId: "tenantLicenseId_example", planId: "planId_example", expiracion: Date(), activa: false, isAdminTest: false, maxUsuarios: 123, maxAlmacenes: 123, maxProductos: 123, maxClientes: 123) // UpdateAdminTenantLicenseRequest | 

// Actualizar la licencia de una empresa
AdminAPI.mobileUpdateAdminTenantLicense(updateAdminTenantLicenseRequest: updateAdminTenantLicenseRequest) { (response, error) in
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
 **updateAdminTenantLicenseRequest** | [**UpdateAdminTenantLicenseRequest**](UpdateAdminTenantLicenseRequest.md) |  | 

### Return type

[**PatchAdminTenantsLicenseUpdateResponse**](PatchAdminTenantsLicenseUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileUpdateAdminUser**
```swift
    open class func mobileUpdateAdminUser(updateAdminUserRequest: UpdateAdminUserRequest, completion: @escaping (_ data: PatchAdminUsersUpdateResponse?, _ error: Error?) -> Void)
```

Editar nombre, email o rol de un usuario

Actualiza los datos básicos de un usuario: nombre, correo electrónico o rol de plataforma. Valida que el correo no esté en uso por otro usuario y protege al último administrador activo.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let updateAdminUserRequest = UpdateAdminUserRequest(userId: "userId_example", name: "name_example", email: "email_example", role: "role_example") // UpdateAdminUserRequest | 

// Editar nombre, email o rol de un usuario
AdminAPI.mobileUpdateAdminUser(updateAdminUserRequest: updateAdminUserRequest) { (response, error) in
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
 **updateAdminUserRequest** | [**UpdateAdminUserRequest**](UpdateAdminUserRequest.md) |  | 

### Return type

[**PatchAdminUsersUpdateResponse**](PatchAdminUsersUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileVerifyAdminUserEmail**
```swift
    open class func mobileVerifyAdminUserEmail(adminUserIdRequest: AdminUserIdRequest, completion: @escaping (_ data: PostAdminUsersVerifyEmailResponse?, _ error: Error?) -> Void)
```

Marcar el email como verificado

Marca manualmente el correo de un usuario como verificado, sin necesidad de que complete el flujo de verificación por email. Es idempotente si ya estaba verificado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let adminUserIdRequest = AdminUserIdRequest(userId: "userId_example") // AdminUserIdRequest | 

// Marcar el email como verificado
AdminAPI.mobileVerifyAdminUserEmail(adminUserIdRequest: adminUserIdRequest) { (response, error) in
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
 **adminUserIdRequest** | [**AdminUserIdRequest**](AdminUserIdRequest.md) |  | 

### Return type

[**PostAdminUsersVerifyEmailResponse**](PostAdminUsersVerifyEmailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

