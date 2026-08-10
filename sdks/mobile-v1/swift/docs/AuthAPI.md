# AuthAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAuthMe**](AuthAPI.md#mobilegetauthme) | **GET** /auth/me | Consultar perfil autenticado
[**mobileGetAuthTenants**](AuthAPI.md#mobilegetauthtenants) | **GET** /auth/tenants | Listar tenants accesibles
[**mobilePostAuthLogin**](AuthAPI.md#mobilepostauthlogin) | **POST** /auth/login | Iniciar sesión móvil
[**mobilePostAuthLogout**](AuthAPI.md#mobilepostauthlogout) | **POST** /auth/logout | Cerrar sesión actual
[**mobilePostAuthRefresh**](AuthAPI.md#mobilepostauthrefresh) | **POST** /auth/refresh | Renovar tokens de sesión
[**mobilePostAuthTenants**](AuthAPI.md#mobilepostauthtenants) | **POST** /auth/tenants | Cambiar tenant activo


# **mobileGetAuthMe**
```swift
    open class func mobileGetAuthMe(completion: @escaping (_ data: AuthenticatedUser?, _ error: Error?) -> Void)
```

Consultar perfil autenticado

Devuelve la identidad, rol y contexto de tenant contenidos en la sesión Bearer vigente.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar perfil autenticado
AuthAPI.mobileGetAuthMe() { (response, error) in
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

[**AuthenticatedUser**](AuthenticatedUser.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAuthTenants**
```swift
    open class func mobileGetAuthTenants(completion: @escaping (_ data: TenantListResponse?, _ error: Error?) -> Void)
```

Listar tenants accesibles

Devuelve los tenants activos a los que pertenece el usuario autenticado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar tenants accesibles
AuthAPI.mobileGetAuthTenants() { (response, error) in
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

[**TenantListResponse**](TenantListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAuthLogin**
```swift
    open class func mobilePostAuthLogin(loginRequest: LoginRequest, xTenantId: String? = nil, completion: @escaping (_ data: AuthSession?, _ error: Error?) -> Void)
```

Iniciar sesión móvil

Valida las credenciales y entrega el usuario autenticado junto con los tokens de acceso y renovación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let loginRequest = LoginRequest(email: "email_example", password: "password_example") // LoginRequest | 
let xTenantId = "xTenantId_example" // String | Tenant que se desea activar al iniciar sesión; si se omite, el servicio resuelve el contexto disponible. (optional)

// Iniciar sesión móvil
AuthAPI.mobilePostAuthLogin(loginRequest: loginRequest, xTenantId: xTenantId) { (response, error) in
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
 **loginRequest** | [**LoginRequest**](LoginRequest.md) |  | 
 **xTenantId** | **String** | Tenant que se desea activar al iniciar sesión; si se omite, el servicio resuelve el contexto disponible. | [optional] 

### Return type

[**AuthSession**](AuthSession.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAuthLogout**
```swift
    open class func mobilePostAuthLogout(completion: @escaping (_ data: SuccessResponse?, _ error: Error?) -> Void)
```

Cerrar sesión actual

Invalida la sesión autenticada para impedir el uso posterior de sus credenciales de renovación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Cerrar sesión actual
AuthAPI.mobilePostAuthLogout() { (response, error) in
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

[**SuccessResponse**](SuccessResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAuthRefresh**
```swift
    open class func mobilePostAuthRefresh(refreshRequest: RefreshRequest, completion: @escaping (_ data: TokenPair?, _ error: Error?) -> Void)
```

Renovar tokens de sesión

Valida el token de renovación y emite un nuevo par de tokens para continuar la sesión.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let refreshRequest = RefreshRequest(refreshToken: "refreshToken_example") // RefreshRequest | 

// Renovar tokens de sesión
AuthAPI.mobilePostAuthRefresh(refreshRequest: refreshRequest) { (response, error) in
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
 **refreshRequest** | [**RefreshRequest**](RefreshRequest.md) |  | 

### Return type

[**TokenPair**](TokenPair.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAuthTenants**
```swift
    open class func mobilePostAuthTenants(switchTenantRequest: SwitchTenantRequest, completion: @escaping (_ data: SwitchTenantResponse?, _ error: Error?) -> Void)
```

Cambiar tenant activo

Cambia el contexto de tenant y entrega tokens nuevos asociados a la membresía seleccionada.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let switchTenantRequest = SwitchTenantRequest(tenantId: "tenantId_example") // SwitchTenantRequest | 

// Cambiar tenant activo
AuthAPI.mobilePostAuthTenants(switchTenantRequest: switchTenantRequest) { (response, error) in
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
 **switchTenantRequest** | [**SwitchTenantRequest**](SwitchTenantRequest.md) |  | 

### Return type

[**SwitchTenantResponse**](SwitchTenantResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

