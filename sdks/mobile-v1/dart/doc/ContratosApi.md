# tcp_mobile_v1_sdk.api.ContratosApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetContratosById**](ContratosApi.md#mobilegetcontratosbyid) | **GET** /contratos/{id} | Detalle de contrato
[**mobileListContratos**](ContratosApi.md#mobilelistcontratos) | **GET** /contratos | Listar contratos


# **mobileGetContratosById**
> GetContratosDetailResponse mobileGetContratosById(id)

Detalle de contrato

Devuelve el detalle de una contrato.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ContratosApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetContratosById(id);
    print(result);
} catch (e) {
    print('Exception when calling ContratosApi->mobileGetContratosById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetContratosDetailResponse**](GetContratosDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListContratos**
> GetContratosListResponse mobileListContratos()

Listar contratos

Devuelve el listado de contratos del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ContratosApi();

try {
    final result = api_instance.mobileListContratos();
    print(result);
} catch (e) {
    print('Exception when calling ContratosApi->mobileListContratos: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetContratosListResponse**](GetContratosListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

