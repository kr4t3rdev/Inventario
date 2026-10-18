# tcp_mobile_v1_sdk.api.CategoriasApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetCategoriaById**](CategoriasApi.md#mobilegetcategoriabyid) | **GET** /categorias/{id} | Detalle de categoría
[**mobileListCategorias**](CategoriasApi.md#mobilelistcategorias) | **GET** /categorias | Listar categorías


# **mobileGetCategoriaById**
> GetCategoriasDetailResponse mobileGetCategoriaById(id)

Detalle de categoría

Detalle de una categoría.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = CategoriasApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetCategoriaById(id);
    print(result);
} catch (e) {
    print('Exception when calling CategoriasApi->mobileGetCategoriaById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetCategoriasDetailResponse**](GetCategoriasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListCategorias**
> GetCategoriasListResponse mobileListCategorias()

Listar categorías

Devuelve las categorías del tenant autenticado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = CategoriasApi();

try {
    final result = api_instance.mobileListCategorias();
    print(result);
} catch (e) {
    print('Exception when calling CategoriasApi->mobileListCategorias: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetCategoriasListResponse**](GetCategoriasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

