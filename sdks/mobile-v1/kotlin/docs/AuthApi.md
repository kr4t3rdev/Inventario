# AuthApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetAuthMe**](AuthApi.md#mobileGetAuthMe) | **GET** /auth/me | Consultar perfil autenticado |
| [**mobileGetAuthTenants**](AuthApi.md#mobileGetAuthTenants) | **GET** /auth/tenants | Listar tenants accesibles |
| [**mobilePostAuthLogin**](AuthApi.md#mobilePostAuthLogin) | **POST** /auth/login | Iniciar sesión móvil |
| [**mobilePostAuthLogout**](AuthApi.md#mobilePostAuthLogout) | **POST** /auth/logout | Cerrar sesión actual |
| [**mobilePostAuthRefresh**](AuthApi.md#mobilePostAuthRefresh) | **POST** /auth/refresh | Renovar tokens de sesión |
| [**mobilePostAuthRegister**](AuthApi.md#mobilePostAuthRegister) | **POST** /auth/register | Registrar cuenta móvil |
| [**mobilePostAuthTenants**](AuthApi.md#mobilePostAuthTenants) | **POST** /auth/tenants | Cambiar tenant activo |


<a id="mobileGetAuthMe"></a>
# **mobileGetAuthMe**
> AuthenticatedUser mobileGetAuthMe()

Consultar perfil autenticado

Devuelve la identidad, rol y contexto de tenant contenidos en la sesión Bearer vigente.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AuthApi()
try {
    val result : AuthenticatedUser = apiInstance.mobileGetAuthMe()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#mobileGetAuthMe")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#mobileGetAuthMe")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AuthenticatedUser**](AuthenticatedUser.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAuthTenants"></a>
# **mobileGetAuthTenants**
> TenantListResponse mobileGetAuthTenants()

Listar tenants accesibles

Devuelve los tenants activos a los que pertenece el usuario autenticado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AuthApi()
try {
    val result : TenantListResponse = apiInstance.mobileGetAuthTenants()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#mobileGetAuthTenants")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#mobileGetAuthTenants")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**TenantListResponse**](TenantListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePostAuthLogin"></a>
# **mobilePostAuthLogin**
> AuthSession mobilePostAuthLogin(loginRequest, xTenantId)

Iniciar sesión móvil

Valida las credenciales y entrega el usuario autenticado junto con los tokens de acceso y renovación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AuthApi()
val loginRequest : LoginRequest =  // LoginRequest | 
val xTenantId : kotlin.String = xTenantId_example // kotlin.String | Tenant que se desea activar al iniciar sesión; si se omite, el servicio resuelve el contexto disponible.
try {
    val result : AuthSession = apiInstance.mobilePostAuthLogin(loginRequest, xTenantId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#mobilePostAuthLogin")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#mobilePostAuthLogin")
    e.printStackTrace()
}
```

### Parameters
| **loginRequest** | [**LoginRequest**](LoginRequest.md)|  | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **xTenantId** | **kotlin.String**| Tenant que se desea activar al iniciar sesión; si se omite, el servicio resuelve el contexto disponible. | [optional] |

### Return type

[**AuthSession**](AuthSession.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAuthLogout"></a>
# **mobilePostAuthLogout**
> SuccessResponse mobilePostAuthLogout()

Cerrar sesión actual

Invalida la sesión autenticada para impedir el uso posterior de sus credenciales de renovación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AuthApi()
try {
    val result : SuccessResponse = apiInstance.mobilePostAuthLogout()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#mobilePostAuthLogout")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#mobilePostAuthLogout")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**SuccessResponse**](SuccessResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePostAuthRefresh"></a>
# **mobilePostAuthRefresh**
> TokenPair mobilePostAuthRefresh(refreshRequest)

Renovar tokens de sesión

Valida el token de renovación y emite un nuevo par de tokens para continuar la sesión.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AuthApi()
val refreshRequest : RefreshRequest =  // RefreshRequest | 
try {
    val result : TokenPair = apiInstance.mobilePostAuthRefresh(refreshRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#mobilePostAuthRefresh")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#mobilePostAuthRefresh")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **refreshRequest** | [**RefreshRequest**](RefreshRequest.md)|  | |

### Return type

[**TokenPair**](TokenPair.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAuthRegister"></a>
# **mobilePostAuthRegister**
> RegisterResponse mobilePostAuthRegister(registerRequest)

Registrar cuenta móvil

Crea un usuario inactivo pendiente de verificación de correo y envía el enlace de verificación. Espejo del registro web: no devuelve sesión; la cuenta debe completar onboarding y aprobación antes de iniciar sesión en el móvil.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AuthApi()
val registerRequest : RegisterRequest =  // RegisterRequest | 
try {
    val result : RegisterResponse = apiInstance.mobilePostAuthRegister(registerRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#mobilePostAuthRegister")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#mobilePostAuthRegister")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **registerRequest** | [**RegisterRequest**](RegisterRequest.md)|  | |

### Return type

[**RegisterResponse**](RegisterResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAuthTenants"></a>
# **mobilePostAuthTenants**
> SwitchTenantResponse mobilePostAuthTenants(switchTenantRequest)

Cambiar tenant activo

Cambia el contexto de tenant y entrega tokens nuevos asociados a la membresía seleccionada.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AuthApi()
val switchTenantRequest : SwitchTenantRequest =  // SwitchTenantRequest | 
try {
    val result : SwitchTenantResponse = apiInstance.mobilePostAuthTenants(switchTenantRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#mobilePostAuthTenants")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#mobilePostAuthTenants")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **switchTenantRequest** | [**SwitchTenantRequest**](SwitchTenantRequest.md)|  | |

### Return type

[**SwitchTenantResponse**](SwitchTenantResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

