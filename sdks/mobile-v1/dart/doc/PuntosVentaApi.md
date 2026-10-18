# tcp_mobile_v1_sdk.api.PuntosVentaApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetPuntoVentaById**](PuntosVentaApi.md#mobilegetpuntoventabyid) | **GET** /puntos-venta/{id} | Detalle de punto de venta
[**mobileListPuntosVenta**](PuntosVentaApi.md#mobilelistpuntosventa) | **GET** /puntos-venta | Listar puntos de venta


# **mobileGetPuntoVentaById**
> GetPuntosVentaDetailResponse mobileGetPuntoVentaById(id)

Detalle de punto de venta

Detalle de un punto de venta.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = PuntosVentaApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetPuntoVentaById(id);
    print(result);
} catch (e) {
    print('Exception when calling PuntosVentaApi->mobileGetPuntoVentaById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetPuntosVentaDetailResponse**](GetPuntosVentaDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListPuntosVenta**
> GetPuntosVentaListResponse mobileListPuntosVenta()

Listar puntos de venta

Puntos de venta del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = PuntosVentaApi();

try {
    final result = api_instance.mobileListPuntosVenta();
    print(result);
} catch (e) {
    print('Exception when calling PuntosVentaApi->mobileListPuntosVenta: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetPuntosVentaListResponse**](GetPuntosVentaListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

