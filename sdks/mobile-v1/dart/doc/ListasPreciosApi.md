# tcp_mobile_v1_sdk.api.ListasPreciosApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetListaPrecioById**](ListasPreciosApi.md#mobilegetlistapreciobyid) | **GET** /listas-precios/{id} | Detalle de lista de precios
[**mobileListListasPrecios**](ListasPreciosApi.md#mobilelistlistasprecios) | **GET** /listas-precios | Listar listas de precios


# **mobileGetListaPrecioById**
> GetListasPreciosDetailResponse mobileGetListaPrecioById(id)

Detalle de lista de precios

Lista con sus precios por producto.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ListasPreciosApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetListaPrecioById(id);
    print(result);
} catch (e) {
    print('Exception when calling ListasPreciosApi->mobileGetListaPrecioById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetListasPreciosDetailResponse**](GetListasPreciosDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListListasPrecios**
> GetListasPreciosListResponse mobileListListasPrecios()

Listar listas de precios

Listas de precios del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ListasPreciosApi();

try {
    final result = api_instance.mobileListListasPrecios();
    print(result);
} catch (e) {
    print('Exception when calling ListasPreciosApi->mobileListListasPrecios: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetListasPreciosListResponse**](GetListasPreciosListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

