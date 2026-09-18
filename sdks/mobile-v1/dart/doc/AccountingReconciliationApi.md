# tcp_mobile_v1_sdk.api.AccountingReconciliationApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingReconciliationExpenses**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationexpenses) | **GET** /accounting/reconciliation/expenses | Consultar conciliación de gastos
[**mobileGetAccountingReconciliationExpensesHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationexpenseshistory) | **GET** /accounting/reconciliation/expenses-history | Consultar historial de conciliaciones de gastos
[**mobileGetAccountingReconciliationExpensesNestedHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationexpensesnestedhistory) | **GET** /accounting/reconciliation/expenses/history | Consultar historial paginado de conciliaciones de gastos
[**mobileGetAccountingReconciliationSales**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationsales) | **GET** /accounting/reconciliation/sales | Consultar conciliación de ventas
[**mobileGetAccountingReconciliationSalesHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationsaleshistory) | **GET** /accounting/reconciliation/sales-history | Consultar historial de conciliaciones de ventas
[**mobileGetAccountingReconciliationSalesNestedHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationsalesnestedhistory) | **GET** /accounting/reconciliation/sales/history | Consultar historial paginado de conciliaciones de ventas
[**mobileGetAccountingReconciliationServices**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationservices) | **GET** /accounting/reconciliation/services | Consultar conciliación de servicios
[**mobileGetAccountingReconciliationServicesHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationserviceshistory) | **GET** /accounting/reconciliation/services-history | Consultar historial de conciliaciones de servicios
[**mobileGetAccountingReconciliationServicesNestedHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationservicesnestedhistory) | **GET** /accounting/reconciliation/services/history | Consultar historial paginado de conciliaciones de servicios
[**mobileGetAccountingReconciliationStats**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationstats) | **GET** /accounting/reconciliation/stats | Consultar panel de conciliaciones
[**mobilePostAccountingReconciliationExpenses**](AccountingReconciliationApi.md#mobilepostaccountingreconciliationexpenses) | **POST** /accounting/reconciliation/expenses | Registrar conciliación de gastos
[**mobilePostAccountingReconciliationSales**](AccountingReconciliationApi.md#mobilepostaccountingreconciliationsales) | **POST** /accounting/reconciliation/sales | Registrar conciliación de ventas
[**mobilePostAccountingReconciliationServices**](AccountingReconciliationApi.md#mobilepostaccountingreconciliationservices) | **POST** /accounting/reconciliation/services | Registrar conciliación de servicios


# **mobileGetAccountingReconciliationExpenses**
> GetAccountingReconciliationExpensesResponse mobileGetAccountingReconciliationExpenses(tipoGasto, fechaDesde, fechaHasta, page, limit)

Consultar conciliación de gastos

Lista gastos pendientes de conciliación bancaria. Permite precisar la consulta mediante tipoGasto, fecha inicial, fecha final, página, límite por página.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final tipoGasto = tipoGasto_example; // String | Valor de tipoGasto aceptado por el handler.
final fechaDesde = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaDesde aceptado por el handler.
final fechaHasta = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaHasta aceptado por el handler.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobileGetAccountingReconciliationExpenses(tipoGasto, fechaDesde, fechaHasta, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobileGetAccountingReconciliationExpenses: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tipoGasto** | **String**| Valor de tipoGasto aceptado por el handler. | [optional] 
 **fechaDesde** | **DateTime**| Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **DateTime**| Valor de fechaHasta aceptado por el handler. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingReconciliationExpensesResponse**](GetAccountingReconciliationExpensesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationExpensesHistory**
> GetAccountingReconciliationExpensesHistoryResponse mobileGetAccountingReconciliationExpensesHistory(tipoGasto, cuentaId, fechaDesde, fechaHasta, periodo, reconciliadoPor, page, limit)

Consultar historial de conciliaciones de gastos

Devuelve el historial completo de conciliaciones de gastos. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final tipoGasto = tipoGasto_example; // String | Valor de tipoGasto aceptado por el handler.
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.
final fechaDesde = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaDesde aceptado por el handler.
final fechaHasta = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaHasta aceptado por el handler.
final periodo = periodo_example; // String | Valor de periodo aceptado por el handler.
final reconciliadoPor = reconciliadoPor_example; // String | Valor de reconciliadoPor aceptado por el handler.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobileGetAccountingReconciliationExpensesHistory(tipoGasto, cuentaId, fechaDesde, fechaHasta, periodo, reconciliadoPor, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobileGetAccountingReconciliationExpensesHistory: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tipoGasto** | **String**| Valor de tipoGasto aceptado por el handler. | [optional] 
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 
 **fechaDesde** | **DateTime**| Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **DateTime**| Valor de fechaHasta aceptado por el handler. | [optional] 
 **periodo** | **String**| Valor de periodo aceptado por el handler. | [optional] 
 **reconciliadoPor** | **String**| Valor de reconciliadoPor aceptado por el handler. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingReconciliationExpensesHistoryResponse**](GetAccountingReconciliationExpensesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationExpensesNestedHistory**
> GetAccountingReconciliationExpensesHistoryResponse mobileGetAccountingReconciliationExpensesNestedHistory(tipoGasto, cuentaId, fechaDesde, fechaHasta, periodo, reconciliadoPor, page, limit)

Consultar historial paginado de conciliaciones de gastos

Devuelve conciliaciones de gastos con estadísticas y control de página. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final tipoGasto = tipoGasto_example; // String | Valor de tipoGasto aceptado por el handler.
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.
final fechaDesde = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaDesde aceptado por el handler.
final fechaHasta = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaHasta aceptado por el handler.
final periodo = periodo_example; // String | Valor de periodo aceptado por el handler.
final reconciliadoPor = reconciliadoPor_example; // String | Valor de reconciliadoPor aceptado por el handler.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobileGetAccountingReconciliationExpensesNestedHistory(tipoGasto, cuentaId, fechaDesde, fechaHasta, periodo, reconciliadoPor, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobileGetAccountingReconciliationExpensesNestedHistory: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tipoGasto** | **String**| Valor de tipoGasto aceptado por el handler. | [optional] 
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 
 **fechaDesde** | **DateTime**| Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **DateTime**| Valor de fechaHasta aceptado por el handler. | [optional] 
 **periodo** | **String**| Valor de periodo aceptado por el handler. | [optional] 
 **reconciliadoPor** | **String**| Valor de reconciliadoPor aceptado por el handler. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingReconciliationExpensesHistoryResponse**](GetAccountingReconciliationExpensesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationSales**
> GetAccountingReconciliationSalesResponse mobileGetAccountingReconciliationSales(fechaInicio, fechaFin, puntoDeVentaId, page, limit)

Consultar conciliación de ventas

Lista ventas que todavía no tienen conciliación bancaria. Permite precisar la consulta mediante fecha inicial, fecha final, punto de venta, página, límite por página.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final puntoDeVentaId = puntoDeVentaId_example; // String | Valor de puntoDeVentaId aceptado por el handler.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobileGetAccountingReconciliationSales(fechaInicio, fechaFin, puntoDeVentaId, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobileGetAccountingReconciliationSales: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **puntoDeVentaId** | **String**| Valor de puntoDeVentaId aceptado por el handler. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingReconciliationSalesResponse**](GetAccountingReconciliationSalesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationSalesHistory**
> GetAccountingReconciliationSalesHistoryResponse mobileGetAccountingReconciliationSalesHistory(fechaDesde, fechaInicio, fechaHasta, fechaFin, cuentaId)

Consultar historial de conciliaciones de ventas

Devuelve el historial completo de conciliaciones de ventas. Permite precisar la consulta mediante fecha inicial, fecha inicial, fecha final, fecha final, cuenta bancaria.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final fechaDesde = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaDesde aceptado por el handler.
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaHasta = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaHasta aceptado por el handler.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.

try {
    final result = api_instance.mobileGetAccountingReconciliationSalesHistory(fechaDesde, fechaInicio, fechaHasta, fechaFin, cuentaId);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobileGetAccountingReconciliationSalesHistory: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fechaDesde** | **DateTime**| Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaHasta** | **DateTime**| Valor de fechaHasta aceptado por el handler. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 

### Return type

[**GetAccountingReconciliationSalesHistoryResponse**](GetAccountingReconciliationSalesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationSalesNestedHistory**
> GetAccountingReconciliationSalesHistoryResponse mobileGetAccountingReconciliationSalesNestedHistory(fechaInicio, fechaFin, cuentaId)

Consultar historial paginado de conciliaciones de ventas

Devuelve conciliaciones de ventas con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.

try {
    final result = api_instance.mobileGetAccountingReconciliationSalesNestedHistory(fechaInicio, fechaFin, cuentaId);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobileGetAccountingReconciliationSalesNestedHistory: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 

### Return type

[**GetAccountingReconciliationSalesHistoryResponse**](GetAccountingReconciliationSalesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationServices**
> GetAccountingReconciliationServicesResponse mobileGetAccountingReconciliationServices(fechaDesde, fechaHasta, page, limit)

Consultar conciliación de servicios

Lista servicios vendidos pendientes de distribuir entre cuentas bancarias. Permite precisar la consulta mediante fecha inicial, fecha final, página, límite por página.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final fechaDesde = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaDesde aceptado por el handler.
final fechaHasta = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaHasta aceptado por el handler.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobileGetAccountingReconciliationServices(fechaDesde, fechaHasta, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobileGetAccountingReconciliationServices: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fechaDesde** | **DateTime**| Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **DateTime**| Valor de fechaHasta aceptado por el handler. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingReconciliationServicesResponse**](GetAccountingReconciliationServicesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationServicesHistory**
> GetAccountingReconciliationServicesHistoryResponse mobileGetAccountingReconciliationServicesHistory(fechaDesde, fechaHasta, cuentaId)

Consultar historial de conciliaciones de servicios

Devuelve el historial completo de conciliaciones de servicios. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final fechaDesde = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaDesde aceptado por el handler.
final fechaHasta = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaHasta aceptado por el handler.
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.

try {
    final result = api_instance.mobileGetAccountingReconciliationServicesHistory(fechaDesde, fechaHasta, cuentaId);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobileGetAccountingReconciliationServicesHistory: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fechaDesde** | **DateTime**| Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **DateTime**| Valor de fechaHasta aceptado por el handler. | [optional] 
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 

### Return type

[**GetAccountingReconciliationServicesHistoryResponse**](GetAccountingReconciliationServicesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationServicesNestedHistory**
> GetAccountingReconciliationServicesHistoryResponse mobileGetAccountingReconciliationServicesNestedHistory(fechaDesde, fechaHasta, cuentaId)

Consultar historial paginado de conciliaciones de servicios

Devuelve conciliaciones de servicios con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final fechaDesde = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaDesde aceptado por el handler.
final fechaHasta = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaHasta aceptado por el handler.
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.

try {
    final result = api_instance.mobileGetAccountingReconciliationServicesNestedHistory(fechaDesde, fechaHasta, cuentaId);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobileGetAccountingReconciliationServicesNestedHistory: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fechaDesde** | **DateTime**| Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **DateTime**| Valor de fechaHasta aceptado por el handler. | [optional] 
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 

### Return type

[**GetAccountingReconciliationServicesHistoryResponse**](GetAccountingReconciliationServicesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationStats**
> GetAccountingReconciliationStatsResponse mobileGetAccountingReconciliationStats()

Consultar panel de conciliaciones

Resume pendientes, conciliaciones completadas hoy, eficiencia y actividad reciente por módulo.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();

try {
    final result = api_instance.mobileGetAccountingReconciliationStats();
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobileGetAccountingReconciliationStats: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingReconciliationStatsResponse**](GetAccountingReconciliationStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingReconciliationExpenses**
> PostAccountingReconciliationExpensesResponse mobilePostAccountingReconciliationExpenses(expenseReconciliationRequest, tipoGasto, fechaDesde, fechaHasta, page, limit)

Registrar conciliación de gastos

Distribuye el importe de un gasto entre una o varias cuentas y registra su pago contable.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final expenseReconciliationRequest = ExpenseReconciliationRequest(); // ExpenseReconciliationRequest | 
final tipoGasto = tipoGasto_example; // String | Valor de tipoGasto aceptado por el handler.
final fechaDesde = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaDesde aceptado por el handler.
final fechaHasta = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaHasta aceptado por el handler.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobilePostAccountingReconciliationExpenses(expenseReconciliationRequest, tipoGasto, fechaDesde, fechaHasta, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobilePostAccountingReconciliationExpenses: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **expenseReconciliationRequest** | [**ExpenseReconciliationRequest**](ExpenseReconciliationRequest.md)|  | 
 **tipoGasto** | **String**| Valor de tipoGasto aceptado por el handler. | [optional] 
 **fechaDesde** | **DateTime**| Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **DateTime**| Valor de fechaHasta aceptado por el handler. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingReconciliationExpensesResponse**](PostAccountingReconciliationExpensesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingReconciliationSales**
> PostAccountingReconciliationSalesResponse mobilePostAccountingReconciliationSales(saleReconciliationRequest, fechaInicio, fechaFin, puntoDeVentaId, page, limit)

Registrar conciliación de ventas

Abona una venta en la cuenta y medio de pago indicados, respetando el importe conciliable.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final saleReconciliationRequest = SaleReconciliationRequest(); // SaleReconciliationRequest | 
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final puntoDeVentaId = puntoDeVentaId_example; // String | Valor de puntoDeVentaId aceptado por el handler.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobilePostAccountingReconciliationSales(saleReconciliationRequest, fechaInicio, fechaFin, puntoDeVentaId, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobilePostAccountingReconciliationSales: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **saleReconciliationRequest** | [**SaleReconciliationRequest**](SaleReconciliationRequest.md)|  | 
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **puntoDeVentaId** | **String**| Valor de puntoDeVentaId aceptado por el handler. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingReconciliationSalesResponse**](PostAccountingReconciliationSalesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingReconciliationServices**
> PostAccountingReconciliationServicesResponse mobilePostAccountingReconciliationServices(serviceReconciliationRequest, fechaDesde, fechaHasta, page, limit)

Registrar conciliación de servicios

Distribuye el total de un servicio entre las cuentas y medios de pago enviados.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReconciliationApi();
final serviceReconciliationRequest = ServiceReconciliationRequest(); // ServiceReconciliationRequest | 
final fechaDesde = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaDesde aceptado por el handler.
final fechaHasta = 2013-10-20T19:20:30+01:00; // DateTime | Valor de fechaHasta aceptado por el handler.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobilePostAccountingReconciliationServices(serviceReconciliationRequest, fechaDesde, fechaHasta, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReconciliationApi->mobilePostAccountingReconciliationServices: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **serviceReconciliationRequest** | [**ServiceReconciliationRequest**](ServiceReconciliationRequest.md)|  | 
 **fechaDesde** | **DateTime**| Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **DateTime**| Valor de fechaHasta aceptado por el handler. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingReconciliationServicesResponse**](PostAccountingReconciliationServicesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

