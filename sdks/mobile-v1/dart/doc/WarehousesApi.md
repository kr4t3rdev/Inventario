# tcp_mobile_v1_sdk.api.WarehousesApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileDeleteWarehousesById**](WarehousesApi.md#mobiledeletewarehousesbyid) | **DELETE** /warehouses/{id} | Eliminar almacén
[**mobileGetWarehouses**](WarehousesApi.md#mobilegetwarehouses) | **GET** /warehouses | Listar almacenes
[**mobileGetWarehousesById**](WarehousesApi.md#mobilegetwarehousesbyid) | **GET** /warehouses/{id} | Consultar almacén
[**mobilePostWarehousesCreate**](WarehousesApi.md#mobilepostwarehousescreate) | **POST** /warehouses/create | Crear almacén
[**mobilePutWarehousesById**](WarehousesApi.md#mobileputwarehousesbyid) | **PUT** /warehouses/{id} | Editar almacén


# **mobileDeleteWarehousesById**
> AlmacenDeleteResponse mobileDeleteWarehousesById(id)

Eliminar almacén

Elimina un almacén del tenant activo y devuelve la confirmación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = WarehousesApi();
final id = id_example; // String | Identificador del almacén.

try {
    final result = api_instance.mobileDeleteWarehousesById(id);
    print(result);
} catch (e) {
    print('Exception when calling WarehousesApi->mobileDeleteWarehousesById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador del almacén. | 

### Return type

[**AlmacenDeleteResponse**](AlmacenDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetWarehouses**
> AlmacenListResponse mobileGetWarehouses()

Listar almacenes

Devuelve los almacenes del tenant activo ordenados por nombre ascendente.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = WarehousesApi();

try {
    final result = api_instance.mobileGetWarehouses();
    print(result);
} catch (e) {
    print('Exception when calling WarehousesApi->mobileGetWarehouses: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AlmacenListResponse**](AlmacenListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetWarehousesById**
> Almacen mobileGetWarehousesById(id)

Consultar almacén

Devuelve el detalle de un almacén del tenant activo.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = WarehousesApi();
final id = id_example; // String | Identificador del almacén.

try {
    final result = api_instance.mobileGetWarehousesById(id);
    print(result);
} catch (e) {
    print('Exception when calling WarehousesApi->mobileGetWarehousesById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador del almacén. | 

### Return type

[**Almacen**](Almacen.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostWarehousesCreate**
> Almacen mobilePostWarehousesCreate(almacenCreateRequest)

Crear almacén

Crea un almacén en el tenant activo y devuelve el registro creado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = WarehousesApi();
final almacenCreateRequest = AlmacenCreateRequest(); // AlmacenCreateRequest | 

try {
    final result = api_instance.mobilePostWarehousesCreate(almacenCreateRequest);
    print(result);
} catch (e) {
    print('Exception when calling WarehousesApi->mobilePostWarehousesCreate: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **almacenCreateRequest** | [**AlmacenCreateRequest**](AlmacenCreateRequest.md)|  | 

### Return type

[**Almacen**](Almacen.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutWarehousesById**
> Almacen mobilePutWarehousesById(id, almacenUpdateRequest)

Editar almacén

Actualiza los datos de un almacén del tenant activo y devuelve el registro actualizado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = WarehousesApi();
final id = id_example; // String | Identificador del almacén.
final almacenUpdateRequest = AlmacenUpdateRequest(); // AlmacenUpdateRequest | 

try {
    final result = api_instance.mobilePutWarehousesById(id, almacenUpdateRequest);
    print(result);
} catch (e) {
    print('Exception when calling WarehousesApi->mobilePutWarehousesById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador del almacén. | 
 **almacenUpdateRequest** | [**AlmacenUpdateRequest**](AlmacenUpdateRequest.md)|  | 

### Return type

[**Almacen**](Almacen.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

