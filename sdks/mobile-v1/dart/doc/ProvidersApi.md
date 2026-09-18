# tcp_mobile_v1_sdk.api.ProvidersApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileDeleteProvidersById**](ProvidersApi.md#mobiledeleteprovidersbyid) | **DELETE** /providers/{id} | Eliminar proveedor
[**mobileGetProviders**](ProvidersApi.md#mobilegetproviders) | **GET** /providers | Listar proveedores
[**mobileGetProvidersById**](ProvidersApi.md#mobilegetprovidersbyid) | **GET** /providers/{id} | Consultar proveedor
[**mobilePostProvidersCreate**](ProvidersApi.md#mobilepostproviderscreate) | **POST** /providers/create | Crear proveedor
[**mobilePutProvidersById**](ProvidersApi.md#mobileputprovidersbyid) | **PUT** /providers/{id} | Editar proveedor


# **mobileDeleteProvidersById**
> ProveedorDeleteResponse mobileDeleteProvidersById(id)

Eliminar proveedor

Elimina un proveedor del tenant activo y devuelve la confirmación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();
final id = id_example; // String | Identificador del proveedor.

try {
    final result = api_instance.mobileDeleteProvidersById(id);
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->mobileDeleteProvidersById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador del proveedor. | 

### Return type

[**ProveedorDeleteResponse**](ProveedorDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetProviders**
> ProveedorListResponse mobileGetProviders()

Listar proveedores

Devuelve los proveedores del tenant activo ordenados por creación descendente.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();

try {
    final result = api_instance.mobileGetProviders();
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->mobileGetProviders: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**ProveedorListResponse**](ProveedorListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetProvidersById**
> Proveedor mobileGetProvidersById(id)

Consultar proveedor

Devuelve el detalle de un proveedor del tenant activo.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();
final id = id_example; // String | Identificador del proveedor.

try {
    final result = api_instance.mobileGetProvidersById(id);
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->mobileGetProvidersById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador del proveedor. | 

### Return type

[**Proveedor**](Proveedor.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostProvidersCreate**
> Proveedor mobilePostProvidersCreate(proveedorCreateRequest)

Crear proveedor

Crea un proveedor en el tenant activo y devuelve el registro creado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();
final proveedorCreateRequest = ProveedorCreateRequest(); // ProveedorCreateRequest | 

try {
    final result = api_instance.mobilePostProvidersCreate(proveedorCreateRequest);
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->mobilePostProvidersCreate: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **proveedorCreateRequest** | [**ProveedorCreateRequest**](ProveedorCreateRequest.md)|  | 

### Return type

[**Proveedor**](Proveedor.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutProvidersById**
> Proveedor mobilePutProvidersById(id, proveedorUpdateRequest)

Editar proveedor

Actualiza los datos de un proveedor del tenant activo y devuelve el registro actualizado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();
final id = id_example; // String | Identificador del proveedor.
final proveedorUpdateRequest = ProveedorUpdateRequest(); // ProveedorUpdateRequest | 

try {
    final result = api_instance.mobilePutProvidersById(id, proveedorUpdateRequest);
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->mobilePutProvidersById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador del proveedor. | 
 **proveedorUpdateRequest** | [**ProveedorUpdateRequest**](ProveedorUpdateRequest.md)|  | 

### Return type

[**Proveedor**](Proveedor.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

