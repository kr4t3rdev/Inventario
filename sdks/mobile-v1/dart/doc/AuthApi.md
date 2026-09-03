# tcp_mobile_v1_sdk.api.AuthApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAuthMe**](AuthApi.md#mobilegetauthme) | **GET** /auth/me | Consultar perfil autenticado
[**mobileGetAuthTenants**](AuthApi.md#mobilegetauthtenants) | **GET** /auth/tenants | Listar tenants accesibles
[**mobilePostAuthLogin**](AuthApi.md#mobilepostauthlogin) | **POST** /auth/login | Iniciar sesión móvil
[**mobilePostAuthLogout**](AuthApi.md#mobilepostauthlogout) | **POST** /auth/logout | Cerrar sesión actual
[**mobilePostAuthRefresh**](AuthApi.md#mobilepostauthrefresh) | **POST** /auth/refresh | Renovar tokens de sesión
[**mobilePostAuthRegister**](AuthApi.md#mobilepostauthregister) | **POST** /auth/register | Registrar cuenta móvil
[**mobilePostAuthTenants**](AuthApi.md#mobilepostauthtenants) | **POST** /auth/tenants | Cambiar tenant activo


# **mobileGetAuthMe**
> AuthenticatedUser mobileGetAuthMe()

Consultar perfil autenticado

Devuelve la identidad, rol y contexto de tenant contenidos en la sesión Bearer vigente.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AuthApi();

try {
    final result = api_instance.mobileGetAuthMe();
    print(result);
} catch (e) {
    print('Exception when calling AuthApi->mobileGetAuthMe: $e\n');
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
> TenantListResponse mobileGetAuthTenants()

Listar tenants accesibles

Devuelve los tenants activos a los que pertenece el usuario autenticado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AuthApi();

try {
    final result = api_instance.mobileGetAuthTenants();
    print(result);
} catch (e) {
    print('Exception when calling AuthApi->mobileGetAuthTenants: $e\n');
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
> AuthSession mobilePostAuthLogin(loginRequest, xTenantId)

Iniciar sesión móvil

Valida las credenciales y entrega el usuario autenticado junto con los tokens de acceso y renovación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';

final api_instance = AuthApi();
final loginRequest = LoginRequest(); // LoginRequest | 
final xTenantId = xTenantId_example; // String | Tenant que se desea activar al iniciar sesión; si se omite, el servicio resuelve el contexto disponible.

try {
    final result = api_instance.mobilePostAuthLogin(loginRequest, xTenantId);
    print(result);
} catch (e) {
    print('Exception when calling AuthApi->mobilePostAuthLogin: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **loginRequest** | [**LoginRequest**](LoginRequest.md)|  | 
 **xTenantId** | **String**| Tenant que se desea activar al iniciar sesión; si se omite, el servicio resuelve el contexto disponible. | [optional] 

### Return type

[**AuthSession**](AuthSession.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAuthLogout**
> SuccessResponse mobilePostAuthLogout()

Cerrar sesión actual

Invalida la sesión autenticada para impedir el uso posterior de sus credenciales de renovación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AuthApi();

try {
    final result = api_instance.mobilePostAuthLogout();
    print(result);
} catch (e) {
    print('Exception when calling AuthApi->mobilePostAuthLogout: $e\n');
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
> TokenPair mobilePostAuthRefresh(refreshRequest)

Renovar tokens de sesión

Valida el token de renovación y emite un nuevo par de tokens para continuar la sesión.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';

final api_instance = AuthApi();
final refreshRequest = RefreshRequest(); // RefreshRequest | 

try {
    final result = api_instance.mobilePostAuthRefresh(refreshRequest);
    print(result);
} catch (e) {
    print('Exception when calling AuthApi->mobilePostAuthRefresh: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refreshRequest** | [**RefreshRequest**](RefreshRequest.md)|  | 

### Return type

[**TokenPair**](TokenPair.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAuthRegister**
> RegisterResponse mobilePostAuthRegister(registerRequest)

Registrar cuenta móvil

Crea un usuario inactivo pendiente de verificación de correo y envía el enlace de verificación. Espejo del registro web: no devuelve sesión; la cuenta debe completar onboarding y aprobación antes de iniciar sesión en el móvil.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';

final api_instance = AuthApi();
final registerRequest = RegisterRequest(); // RegisterRequest | 

try {
    final result = api_instance.mobilePostAuthRegister(registerRequest);
    print(result);
} catch (e) {
    print('Exception when calling AuthApi->mobilePostAuthRegister: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **registerRequest** | [**RegisterRequest**](RegisterRequest.md)|  | 

### Return type

[**RegisterResponse**](RegisterResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAuthTenants**
> SwitchTenantResponse mobilePostAuthTenants(switchTenantRequest)

Cambiar tenant activo

Cambia el contexto de tenant y entrega tokens nuevos asociados a la membresía seleccionada.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AuthApi();
final switchTenantRequest = SwitchTenantRequest(); // SwitchTenantRequest | 

try {
    final result = api_instance.mobilePostAuthTenants(switchTenantRequest);
    print(result);
} catch (e) {
    print('Exception when calling AuthApi->mobilePostAuthTenants: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **switchTenantRequest** | [**SwitchTenantRequest**](SwitchTenantRequest.md)|  | 

### Return type

[**SwitchTenantResponse**](SwitchTenantResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

