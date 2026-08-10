# tcp_mobile_v1_sdk.api.DashboardApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetDashboardStats**](DashboardApi.md#mobilegetdashboardstats) | **GET** /dashboard/stats | Consultar indicadores del panel principal


# **mobileGetDashboardStats**
> GetDashboardStatsResponse mobileGetDashboardStats(ubicacionId, tipoUbicacion)

Consultar indicadores del panel principal

Resume ventas, ingresos y alertas de inventario para una ubicación operativa. Permite precisar la consulta mediante ubicación, tipo de ubicación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = DashboardApi();
final ubicacionId = ubicacionId_example; // String | Valor de ubicacionId aceptado por el handler.
final tipoUbicacion = tipoUbicacion_example; // String | Valor de tipoUbicacion aceptado por el handler.

try {
    final result = api_instance.mobileGetDashboardStats(ubicacionId, tipoUbicacion);
    print(result);
} catch (e) {
    print('Exception when calling DashboardApi->mobileGetDashboardStats: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String**| Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String**| Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**GetDashboardStatsResponse**](GetDashboardStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

