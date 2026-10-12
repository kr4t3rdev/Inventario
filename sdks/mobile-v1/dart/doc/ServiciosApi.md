# tcp_mobile_v1_sdk.api.ServiciosApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetServiciosById**](ServiciosApi.md#mobilegetserviciosbyid) | **GET** /servicios/{id} | Detalle de servicio
[**mobileListServicios**](ServiciosApi.md#mobilelistservicios) | **GET** /servicios | Listar servicios


# **mobileGetServiciosById**
> GetServiciosDetailResponse mobileGetServiciosById(id)

Detalle de servicio

Devuelve el detalle de una servicio.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ServiciosApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetServiciosById(id);
    print(result);
} catch (e) {
    print('Exception when calling ServiciosApi->mobileGetServiciosById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetServiciosDetailResponse**](GetServiciosDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListServicios**
> GetServiciosListResponse mobileListServicios()

Listar servicios

Devuelve el listado de servicios del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ServiciosApi();

try {
    final result = api_instance.mobileListServicios();
    print(result);
} catch (e) {
    print('Exception when calling ServiciosApi->mobileListServicios: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetServiciosListResponse**](GetServiciosListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

