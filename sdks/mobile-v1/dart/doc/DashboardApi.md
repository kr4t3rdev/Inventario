# tcp_mobile_v1_sdk.api.DashboardApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetDashboardDailyAverage**](DashboardApi.md#mobilegetdashboarddailyaverage) | **GET** /dashboard/daily-average | Consultar promedio diario de ingresos
[**mobileGetDashboardIncomeExpenses**](DashboardApi.md#mobilegetdashboardincomeexpenses) | **GET** /dashboard/income-expenses | Consultar ingresos vs gastos del panel
[**mobileGetDashboardInventoryValue**](DashboardApi.md#mobilegetdashboardinventoryvalue) | **GET** /dashboard/inventory-value | Consultar valor total del inventario
[**mobileGetDashboardLowStock**](DashboardApi.md#mobilegetdashboardlowstock) | **GET** /dashboard/low-stock | Consultar productos con stock bajo
[**mobileGetDashboardStats**](DashboardApi.md#mobilegetdashboardstats) | **GET** /dashboard/stats | Consultar indicadores del panel principal
[**mobileGetDashboardStockDistribution**](DashboardApi.md#mobilegetdashboardstockdistribution) | **GET** /dashboard/stock-distribution | Consultar distribución de stock
[**mobileGetDashboardTodaySales**](DashboardApi.md#mobilegetdashboardtodaysales) | **GET** /dashboard/today-sales | Consultar ventas de hoy
[**mobileGetDashboardTopProducts**](DashboardApi.md#mobilegetdashboardtopproducts) | **GET** /dashboard/top-products | Consultar productos más vendidos
[**mobileGetDashboardTransfers**](DashboardApi.md#mobilegetdashboardtransfers) | **GET** /dashboard/transfers | Consultar transferencias entre ubicaciones


# **mobileGetDashboardDailyAverage**
> DashboardValueResponse mobileGetDashboardDailyAverage(ubicacionId, tipoUbicacion)

Consultar promedio diario de ingresos

Promedio de ingresos diarios (30 días).

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
    final result = api_instance.mobileGetDashboardDailyAverage(ubicacionId, tipoUbicacion);
    print(result);
} catch (e) {
    print('Exception when calling DashboardApi->mobileGetDashboardDailyAverage: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String**| Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String**| Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardValueResponse**](DashboardValueResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardIncomeExpenses**
> DashboardIncomeExpenseResponse mobileGetDashboardIncomeExpenses(ubicacionId, tipoUbicacion)

Consultar ingresos vs gastos del panel

Ingresos y gastos totales más la serie mensual para la gráfica del panel.

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
    final result = api_instance.mobileGetDashboardIncomeExpenses(ubicacionId, tipoUbicacion);
    print(result);
} catch (e) {
    print('Exception when calling DashboardApi->mobileGetDashboardIncomeExpenses: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String**| Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String**| Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardIncomeExpenseResponse**](DashboardIncomeExpenseResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardInventoryValue**
> DashboardValueResponse mobileGetDashboardInventoryValue(ubicacionId, tipoUbicacion)

Consultar valor total del inventario

Valor total del inventario en stock.

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
    final result = api_instance.mobileGetDashboardInventoryValue(ubicacionId, tipoUbicacion);
    print(result);
} catch (e) {
    print('Exception when calling DashboardApi->mobileGetDashboardInventoryValue: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String**| Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String**| Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardValueResponse**](DashboardValueResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardLowStock**
> DashboardLowStockResponse mobileGetDashboardLowStock(ubicacionId, tipoUbicacion)

Consultar productos con stock bajo

Productos con stock bajo o crítico (top 5).

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
    final result = api_instance.mobileGetDashboardLowStock(ubicacionId, tipoUbicacion);
    print(result);
} catch (e) {
    print('Exception when calling DashboardApi->mobileGetDashboardLowStock: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String**| Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String**| Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardLowStockResponse**](DashboardLowStockResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

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

# **mobileGetDashboardStockDistribution**
> DashboardStockDistributionResponse mobileGetDashboardStockDistribution(ubicacionId, tipoUbicacion)

Consultar distribución de stock

Distribución de stock por categoría.

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
    final result = api_instance.mobileGetDashboardStockDistribution(ubicacionId, tipoUbicacion);
    print(result);
} catch (e) {
    print('Exception when calling DashboardApi->mobileGetDashboardStockDistribution: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String**| Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String**| Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardStockDistributionResponse**](DashboardStockDistributionResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardTodaySales**
> DashboardValueResponse mobileGetDashboardTodaySales(ubicacionId, tipoUbicacion)

Consultar ventas de hoy

Ingresos por ventas del día actual.

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
    final result = api_instance.mobileGetDashboardTodaySales(ubicacionId, tipoUbicacion);
    print(result);
} catch (e) {
    print('Exception when calling DashboardApi->mobileGetDashboardTodaySales: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String**| Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String**| Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardValueResponse**](DashboardValueResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardTopProducts**
> DashboardTopProductsResponse mobileGetDashboardTopProducts(ubicacionId, tipoUbicacion)

Consultar productos más vendidos

Top 10 de productos más vendidos del período.

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
    final result = api_instance.mobileGetDashboardTopProducts(ubicacionId, tipoUbicacion);
    print(result);
} catch (e) {
    print('Exception when calling DashboardApi->mobileGetDashboardTopProducts: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String**| Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String**| Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardTopProductsResponse**](DashboardTopProductsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardTransfers**
> DashboardTransfersResponse mobileGetDashboardTransfers(ubicacionId, tipoUbicacion)

Consultar transferencias entre ubicaciones

Conteo de transferencias entre almacenes y puntos de venta.

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
    final result = api_instance.mobileGetDashboardTransfers(ubicacionId, tipoUbicacion);
    print(result);
} catch (e) {
    print('Exception when calling DashboardApi->mobileGetDashboardTransfers: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String**| Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String**| Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardTransfersResponse**](DashboardTransfersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

