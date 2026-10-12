# tcp_mobile_v1_sdk.api.OfertasApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetOfertasById**](OfertasApi.md#mobilegetofertasbyid) | **GET** /ofertas/{id} | Detalle de oferta
[**mobileListOfertas**](OfertasApi.md#mobilelistofertas) | **GET** /ofertas | Listar ofertas


# **mobileGetOfertasById**
> GetOfertasDetailResponse mobileGetOfertasById(id)

Detalle de oferta

Devuelve el detalle de una oferta.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = OfertasApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetOfertasById(id);
    print(result);
} catch (e) {
    print('Exception when calling OfertasApi->mobileGetOfertasById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetOfertasDetailResponse**](GetOfertasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListOfertas**
> GetOfertasListResponse mobileListOfertas()

Listar ofertas

Devuelve el listado de ofertas del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = OfertasApi();

try {
    final result = api_instance.mobileListOfertas();
    print(result);
} catch (e) {
    print('Exception when calling OfertasApi->mobileListOfertas: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetOfertasListResponse**](GetOfertasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

