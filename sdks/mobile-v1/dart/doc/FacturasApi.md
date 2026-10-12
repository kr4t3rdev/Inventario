# tcp_mobile_v1_sdk.api.FacturasApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetFacturasById**](FacturasApi.md#mobilegetfacturasbyid) | **GET** /facturas/{id} | Detalle de factura
[**mobileListFacturas**](FacturasApi.md#mobilelistfacturas) | **GET** /facturas | Listar facturas


# **mobileGetFacturasById**
> GetFacturasDetailResponse mobileGetFacturasById(id)

Detalle de factura

Devuelve el detalle de una factura.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = FacturasApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetFacturasById(id);
    print(result);
} catch (e) {
    print('Exception when calling FacturasApi->mobileGetFacturasById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetFacturasDetailResponse**](GetFacturasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListFacturas**
> GetFacturasListResponse mobileListFacturas()

Listar facturas

Devuelve el listado de facturas del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = FacturasApi();

try {
    final result = api_instance.mobileListFacturas();
    print(result);
} catch (e) {
    print('Exception when calling FacturasApi->mobileListFacturas: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetFacturasListResponse**](GetFacturasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

