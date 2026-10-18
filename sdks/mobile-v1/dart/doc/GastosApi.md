# tcp_mobile_v1_sdk.api.GastosApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetGastosById**](GastosApi.md#mobilegetgastosbyid) | **GET** /gastos/{id} | Detalle de gasto
[**mobileListGastos**](GastosApi.md#mobilelistgastos) | **GET** /gastos | Listar gastos


# **mobileGetGastosById**
> GetGastosDetailResponse mobileGetGastosById(id)

Detalle de gasto

Devuelve el detalle de una gasto.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = GastosApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetGastosById(id);
    print(result);
} catch (e) {
    print('Exception when calling GastosApi->mobileGetGastosById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetGastosDetailResponse**](GetGastosDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListGastos**
> GetGastosListResponse mobileListGastos()

Listar gastos

Devuelve el listado de gastos del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = GastosApi();

try {
    final result = api_instance.mobileListGastos();
    print(result);
} catch (e) {
    print('Exception when calling GastosApi->mobileListGastos: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetGastosListResponse**](GetGastosListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

