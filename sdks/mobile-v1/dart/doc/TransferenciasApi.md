# tcp_mobile_v1_sdk.api.TransferenciasApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetTransferenciasById**](TransferenciasApi.md#mobilegettransferenciasbyid) | **GET** /transferencias/{id} | Detalle de transferencia
[**mobileListTransferencias**](TransferenciasApi.md#mobilelisttransferencias) | **GET** /transferencias | Listar transferencias


# **mobileGetTransferenciasById**
> GetTransferenciasDetailResponse mobileGetTransferenciasById(id)

Detalle de transferencia

Devuelve el detalle de una transferencia.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = TransferenciasApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetTransferenciasById(id);
    print(result);
} catch (e) {
    print('Exception when calling TransferenciasApi->mobileGetTransferenciasById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetTransferenciasDetailResponse**](GetTransferenciasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListTransferencias**
> GetTransferenciasListResponse mobileListTransferencias()

Listar transferencias

Devuelve el listado de transferencias del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = TransferenciasApi();

try {
    final result = api_instance.mobileListTransferencias();
    print(result);
} catch (e) {
    print('Exception when calling TransferenciasApi->mobileListTransferencias: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetTransferenciasListResponse**](GetTransferenciasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

