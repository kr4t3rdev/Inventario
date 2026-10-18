# tcp_mobile_v1_sdk.api.EmpleadosApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetEmpleadosById**](EmpleadosApi.md#mobilegetempleadosbyid) | **GET** /empleados/{id} | Detalle de empleado
[**mobileListEmpleados**](EmpleadosApi.md#mobilelistempleados) | **GET** /empleados | Listar empleados


# **mobileGetEmpleadosById**
> GetEmpleadosDetailResponse mobileGetEmpleadosById(id)

Detalle de empleado

Devuelve el detalle de una empleado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = EmpleadosApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileGetEmpleadosById(id);
    print(result);
} catch (e) {
    print('Exception when calling EmpleadosApi->mobileGetEmpleadosById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**GetEmpleadosDetailResponse**](GetEmpleadosDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListEmpleados**
> GetEmpleadosListResponse mobileListEmpleados()

Listar empleados

Devuelve el listado de empleados del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = EmpleadosApi();

try {
    final result = api_instance.mobileListEmpleados();
    print(result);
} catch (e) {
    print('Exception when calling EmpleadosApi->mobileListEmpleados: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetEmpleadosListResponse**](GetEmpleadosListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

