# tcp_mobile_v1_sdk.api.ClientsApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileDeleteClientsById**](ClientsApi.md#mobiledeleteclientsbyid) | **DELETE** /clients/{id} | Eliminar cliente
[**mobileGetClients**](ClientsApi.md#mobilegetclients) | **GET** /clients | Listar clientes
[**mobileGetClientsById**](ClientsApi.md#mobilegetclientsbyid) | **GET** /clients/{id} | Consultar cliente
[**mobilePostClientsCreate**](ClientsApi.md#mobilepostclientscreate) | **POST** /clients/create | Crear cliente
[**mobilePutClientsById**](ClientsApi.md#mobileputclientsbyid) | **PUT** /clients/{id} | Editar cliente


# **mobileDeleteClientsById**
> ClienteDeleteResponse mobileDeleteClientsById(id)

Eliminar cliente

Elimina un cliente del tenant activo y devuelve la confirmación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ClientsApi();
final id = id_example; // String | Identificador del cliente.

try {
    final result = api_instance.mobileDeleteClientsById(id);
    print(result);
} catch (e) {
    print('Exception when calling ClientsApi->mobileDeleteClientsById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador del cliente. | 

### Return type

[**ClienteDeleteResponse**](ClienteDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetClients**
> ClienteListResponse mobileGetClients()

Listar clientes

Devuelve los clientes del tenant activo ordenados por creación descendente.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ClientsApi();

try {
    final result = api_instance.mobileGetClients();
    print(result);
} catch (e) {
    print('Exception when calling ClientsApi->mobileGetClients: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**ClienteListResponse**](ClienteListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetClientsById**
> Cliente mobileGetClientsById(id)

Consultar cliente

Devuelve el detalle de un cliente del tenant activo.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ClientsApi();
final id = id_example; // String | Identificador del cliente.

try {
    final result = api_instance.mobileGetClientsById(id);
    print(result);
} catch (e) {
    print('Exception when calling ClientsApi->mobileGetClientsById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador del cliente. | 

### Return type

[**Cliente**](Cliente.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostClientsCreate**
> Cliente mobilePostClientsCreate(clienteCreateRequest)

Crear cliente

Crea un cliente en el tenant activo y devuelve el registro creado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ClientsApi();
final clienteCreateRequest = ClienteCreateRequest(); // ClienteCreateRequest | 

try {
    final result = api_instance.mobilePostClientsCreate(clienteCreateRequest);
    print(result);
} catch (e) {
    print('Exception when calling ClientsApi->mobilePostClientsCreate: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **clienteCreateRequest** | [**ClienteCreateRequest**](ClienteCreateRequest.md)|  | 

### Return type

[**Cliente**](Cliente.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutClientsById**
> Cliente mobilePutClientsById(id, clienteUpdateRequest)

Editar cliente

Actualiza los datos de un cliente del tenant activo y devuelve el registro actualizado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ClientsApi();
final id = id_example; // String | Identificador del cliente.
final clienteUpdateRequest = ClienteUpdateRequest(); // ClienteUpdateRequest | 

try {
    final result = api_instance.mobilePutClientsById(id, clienteUpdateRequest);
    print(result);
} catch (e) {
    print('Exception when calling ClientsApi->mobilePutClientsById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador del cliente. | 
 **clienteUpdateRequest** | [**ClienteUpdateRequest**](ClienteUpdateRequest.md)|  | 

### Return type

[**Cliente**](Cliente.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

