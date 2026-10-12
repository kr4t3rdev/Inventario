# tcp_mobile_v1_sdk.api.ProduccinApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetProduccionById**](ProduccinApi.md#mobilegetproduccionbyid) | **GET** /produccion/{id} | Detalle de orden de producción
[**mobileListProduccion**](ProduccinApi.md#mobilelistproduccion) | **GET** /produccion | Listar órdenes de producción


# **mobileGetProduccionById**
> GetProduccionDetailResponse mobileGetProduccionById(id)

Detalle de orden de producción

Devuelve el detalle de una orden de producción.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProduccinApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetProduccionById(id);
    print(result);
} catch (e) {
    print('Exception when calling ProduccinApi->mobileGetProduccionById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetProduccionDetailResponse**](GetProduccionDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListProduccion**
> GetProduccionListResponse mobileListProduccion()

Listar órdenes de producción

Devuelve el listado de órdenes de producción del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProduccinApi();

try {
    final result = api_instance.mobileListProduccion();
    print(result);
} catch (e) {
    print('Exception when calling ProduccinApi->mobileListProduccion: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetProduccionListResponse**](GetProduccionListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

