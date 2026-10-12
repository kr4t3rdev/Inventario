# tcp_mobile_v1_sdk.api.MermasApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetMermasById**](MermasApi.md#mobilegetmermasbyid) | **GET** /mermas/{id} | Detalle de merma
[**mobileListMermas**](MermasApi.md#mobilelistmermas) | **GET** /mermas | Listar mermas


# **mobileGetMermasById**
> GetMermasDetailResponse mobileGetMermasById(id)

Detalle de merma

Devuelve el detalle de una merma.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = MermasApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetMermasById(id);
    print(result);
} catch (e) {
    print('Exception when calling MermasApi->mobileGetMermasById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetMermasDetailResponse**](GetMermasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListMermas**
> GetMermasListResponse mobileListMermas()

Listar mermas

Devuelve el listado de mermas del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = MermasApi();

try {
    final result = api_instance.mobileListMermas();
    print(result);
} catch (e) {
    print('Exception when calling MermasApi->mobileListMermas: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetMermasListResponse**](GetMermasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

