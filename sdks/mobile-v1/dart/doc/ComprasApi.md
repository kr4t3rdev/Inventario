# tcp_mobile_v1_sdk.api.ComprasApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetComprasById**](ComprasApi.md#mobilegetcomprasbyid) | **GET** /compras/{id} | Detalle de compra
[**mobileListCompras**](ComprasApi.md#mobilelistcompras) | **GET** /compras | Listar compras


# **mobileGetComprasById**
> GetComprasDetailResponse mobileGetComprasById(id)

Detalle de compra

Devuelve el detalle de una compra.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ComprasApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetComprasById(id);
    print(result);
} catch (e) {
    print('Exception when calling ComprasApi->mobileGetComprasById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetComprasDetailResponse**](GetComprasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListCompras**
> GetComprasListResponse mobileListCompras()

Listar compras

Devuelve el listado de compras del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ComprasApi();

try {
    final result = api_instance.mobileListCompras();
    print(result);
} catch (e) {
    print('Exception when calling ComprasApi->mobileListCompras: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetComprasListResponse**](GetComprasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

