# tcp_mobile_v1_sdk.api.AccountingReceivablesAndPayablesApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingAccountsPayable**](AccountingReceivablesAndPayablesApi.md#mobilegetaccountingaccountspayable) | **GET** /accounting/accounts-payable | Consultar cuentas por pagar
[**mobileGetAccountingAccountsReceivable**](AccountingReceivablesAndPayablesApi.md#mobilegetaccountingaccountsreceivable) | **GET** /accounting/accounts-receivable | Consultar cuentas por cobrar
[**mobileGetAccountingAccountsReceivableMetrics**](AccountingReceivablesAndPayablesApi.md#mobilegetaccountingaccountsreceivablemetrics) | **GET** /accounting/accounts-receivable/metrics | Consultar métricas de cuentas por cobrar


# **mobileGetAccountingAccountsPayable**
> GetAccountingAccountsPayableResponse mobileGetAccountingAccountsPayable(search, estado, tipo, page, limit)

Consultar cuentas por pagar

Lista obligaciones con proveedores y muestra saldos, estado y métricas de pago. Permite precisar la consulta mediante texto de búsqueda, estado, tipo, página, límite por página.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReceivablesAndPayablesApi();
final search = search_example; // String | Texto de búsqueda aplicado por el servicio.
final estado = true; // bool | Estado usado para filtrar resultados.
final tipo = tipo_example; // String | Tipo de registro solicitado.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobileGetAccountingAccountsPayable(search, estado, tipo, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReceivablesAndPayablesApi->mobileGetAccountingAccountsPayable: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **search** | **String**| Texto de búsqueda aplicado por el servicio. | [optional] 
 **estado** | **bool**| Estado usado para filtrar resultados. | [optional] 
 **tipo** | **String**| Tipo de registro solicitado. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingAccountsPayableResponse**](GetAccountingAccountsPayableResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAccountsReceivable**
> GetAccountingAccountsReceivableResponse mobileGetAccountingAccountsReceivable(search, estado, clienteId, page, limit)

Consultar cuentas por cobrar

Lista obligaciones de clientes y sus saldos pendientes dentro del tenant. Permite precisar la consulta mediante texto de búsqueda, estado, cliente, página, límite por página.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReceivablesAndPayablesApi();
final search = search_example; // String | Texto de búsqueda aplicado por el servicio.
final estado = true; // bool | Estado usado para filtrar resultados.
final clienteId = clienteId_example; // String | Identificador del cliente.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobileGetAccountingAccountsReceivable(search, estado, clienteId, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReceivablesAndPayablesApi->mobileGetAccountingAccountsReceivable: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **search** | **String**| Texto de búsqueda aplicado por el servicio. | [optional] 
 **estado** | **bool**| Estado usado para filtrar resultados. | [optional] 
 **clienteId** | **String**| Identificador del cliente. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingAccountsReceivableResponse**](GetAccountingAccountsReceivableResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAccountsReceivableMetrics**
> GetAccountingAccountsReceivableMetricsResponse mobileGetAccountingAccountsReceivableMetrics()

Consultar métricas de cuentas por cobrar

Calcula los importes agregados y estados de las cuentas por cobrar.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReceivablesAndPayablesApi();

try {
    final result = api_instance.mobileGetAccountingAccountsReceivableMetrics();
    print(result);
} catch (e) {
    print('Exception when calling AccountingReceivablesAndPayablesApi->mobileGetAccountingAccountsReceivableMetrics: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingAccountsReceivableMetricsResponse**](GetAccountingAccountsReceivableMetricsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

