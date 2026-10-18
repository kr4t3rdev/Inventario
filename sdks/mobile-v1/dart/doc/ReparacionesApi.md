# tcp_mobile_v1_sdk.api.ReparacionesApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetReparacionesById**](ReparacionesApi.md#mobilegetreparacionesbyid) | **GET** /reparaciones/{id} | Detalle de orden de reparación
[**mobileListReparaciones**](ReparacionesApi.md#mobilelistreparaciones) | **GET** /reparaciones | Listar órdenes de reparación


# **mobileGetReparacionesById**
> GetReparacionesDetailResponse mobileGetReparacionesById(id)

Detalle de orden de reparación

Devuelve el detalle de una orden de reparación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ReparacionesApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetReparacionesById(id);
    print(result);
} catch (e) {
    print('Exception when calling ReparacionesApi->mobileGetReparacionesById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetReparacionesDetailResponse**](GetReparacionesDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListReparaciones**
> GetReparacionesListResponse mobileListReparaciones()

Listar órdenes de reparación

Devuelve el listado de órdenes de reparación del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ReparacionesApi();

try {
    final result = api_instance.mobileListReparaciones();
    print(result);
} catch (e) {
    print('Exception when calling ReparacionesApi->mobileListReparaciones: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetReparacionesListResponse**](GetReparacionesListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

