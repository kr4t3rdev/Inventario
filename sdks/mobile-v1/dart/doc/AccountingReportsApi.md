# tcp_mobile_v1_sdk.api.AccountingReportsApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingAdvancesReportsCustomers**](AccountingReportsApi.md#mobilegetaccountingadvancesreportscustomers) | **GET** /accounting/advances/reports/customers | Consultar anticipos de clientes
[**mobileGetAccountingAdvancesReportsProviders**](AccountingReportsApi.md#mobilegetaccountingadvancesreportsproviders) | **GET** /accounting/advances/reports/providers | Consultar anticipos a proveedores
[**mobileGetAccountingAdvancesReportsSummary**](AccountingReportsApi.md#mobilegetaccountingadvancesreportssummary) | **GET** /accounting/advances/reports/summary | Consultar resumen de anticipos
[**mobileGetAccountingReportsClientAccountAnalysis**](AccountingReportsApi.md#mobilegetaccountingreportsclientaccountanalysis) | **GET** /accounting/reports/client-account-analysis | Consultar análisis de cuenta de cliente
[**mobileGetAccountingReportsExchange**](AccountingReportsApi.md#mobilegetaccountingreportsexchange) | **GET** /accounting/reports/exchange | Consultar reporte de cambio de moneda
[**mobileGetAccountingReportsExchangeImpact**](AccountingReportsApi.md#mobilegetaccountingreportsexchangeimpact) | **GET** /accounting/reports/exchange-impact | Consultar impacto de variaciones cambiarias
[**mobileGetAccountingReportsMovements**](AccountingReportsApi.md#mobilegetaccountingreportsmovements) | **GET** /accounting/reports/movements | Consultar movimientos contables
[**mobileGetAccountingReportsOverdueInvoices**](AccountingReportsApi.md#mobilegetaccountingreportsoverdueinvoices) | **GET** /accounting/reports/overdue-invoices | Consultar facturas vencidas
[**mobileGetAccountingReportsSummary**](AccountingReportsApi.md#mobilegetaccountingreportssummary) | **GET** /accounting/reports/summary | Consultar resumen financiero
[**mobileGetAccountingReportsTransfers**](AccountingReportsApi.md#mobilegetaccountingreportstransfers) | **GET** /accounting/reports/transfers | Consultar reporte de transferencias


# **mobileGetAccountingAdvancesReportsCustomers**
> GetAccountingAdvancesReportsCustomersResponse mobileGetAccountingAdvancesReportsCustomers(clienteId, fechaInicio, fechaFin)

Consultar anticipos de clientes

Agrupa los anticipos recibidos de clientes para el período consultado. Permite precisar la consulta mediante cliente, fecha inicial, fecha final.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReportsApi();
final clienteId = clienteId_example; // String | Identificador del cliente.
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.

try {
    final result = api_instance.mobileGetAccountingAdvancesReportsCustomers(clienteId, fechaInicio, fechaFin);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReportsApi->mobileGetAccountingAdvancesReportsCustomers: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **clienteId** | **String**| Identificador del cliente. | [optional] 
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 

### Return type

[**GetAccountingAdvancesReportsCustomersResponse**](GetAccountingAdvancesReportsCustomersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAdvancesReportsProviders**
> GetAccountingAdvancesReportsProvidersResponse mobileGetAccountingAdvancesReportsProviders(proveedorId, fechaInicio, fechaFin)

Consultar anticipos a proveedores

Agrupa los anticipos entregados a proveedores para el período consultado. Permite precisar la consulta mediante proveedor, fecha inicial, fecha final.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReportsApi();
final proveedorId = proveedorId_example; // String | Identificador del proveedor.
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.

try {
    final result = api_instance.mobileGetAccountingAdvancesReportsProviders(proveedorId, fechaInicio, fechaFin);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReportsApi->mobileGetAccountingAdvancesReportsProviders: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **proveedorId** | **String**| Identificador del proveedor. | [optional] 
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 

### Return type

[**GetAccountingAdvancesReportsProvidersResponse**](GetAccountingAdvancesReportsProvidersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAdvancesReportsSummary**
> GetAccountingAdvancesReportsSummaryResponse mobileGetAccountingAdvancesReportsSummary(tipo, fechaInicio, fechaFin)

Consultar resumen de anticipos

Resume importes y estados de anticipos de pago y cobro. Permite precisar la consulta mediante tipo, fecha inicial, fecha final.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReportsApi();
final tipo = tipo_example; // String | Tipo de registro solicitado.
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.

try {
    final result = api_instance.mobileGetAccountingAdvancesReportsSummary(tipo, fechaInicio, fechaFin);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReportsApi->mobileGetAccountingAdvancesReportsSummary: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tipo** | **String**| Tipo de registro solicitado. | [optional] 
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 

### Return type

[**GetAccountingAdvancesReportsSummaryResponse**](GetAccountingAdvancesReportsSummaryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsClientAccountAnalysis**
> GetAccountingReportsClientAccountAnalysisResponse mobileGetAccountingReportsClientAccountAnalysis(clienteId)

Consultar análisis de cuenta de cliente

Analiza deuda, pagos, vencimientos y actividad de una cuenta de cliente. Permite precisar la consulta mediante cliente.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReportsApi();
final clienteId = clienteId_example; // String | Identificador del cliente.

try {
    final result = api_instance.mobileGetAccountingReportsClientAccountAnalysis(clienteId);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReportsApi->mobileGetAccountingReportsClientAccountAnalysis: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **clienteId** | **String**| Identificador del cliente. | [optional] 

### Return type

[**GetAccountingReportsClientAccountAnalysisResponse**](GetAccountingReportsClientAccountAnalysisResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsExchange**
> GetAccountingReportsExchangeResponse mobileGetAccountingReportsExchange(fechaInicio, fechaFin, monedaOrigen, monedaDestino, export_)

Consultar reporte de cambio de moneda

Reúne tasas y conversiones monetarias para evaluar operaciones de cambio. Permite precisar la consulta mediante fecha inicial, fecha final, monedaOrigen, monedaDestino, formato de exportación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReportsApi();
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final monedaOrigen = monedaOrigen_example; // String | Valor de monedaOrigen aceptado por el handler.
final monedaDestino = monedaDestino_example; // String | Valor de monedaDestino aceptado por el handler.
final export_ = export__example; // String | Valor de export aceptado por el handler.

try {
    final result = api_instance.mobileGetAccountingReportsExchange(fechaInicio, fechaFin, monedaOrigen, monedaDestino, export_);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReportsApi->mobileGetAccountingReportsExchange: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **monedaOrigen** | **String**| Valor de monedaOrigen aceptado por el handler. | [optional] 
 **monedaDestino** | **String**| Valor de monedaDestino aceptado por el handler. | [optional] 
 **export_** | **String**| Valor de export aceptado por el handler. | [optional] 

### Return type

[**GetAccountingReportsExchangeResponse**](GetAccountingReportsExchangeResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsExchangeImpact**
> GetAccountingReportsExchangeImpactResponse mobileGetAccountingReportsExchangeImpact(fechaInicio, fechaFin, monedaBase, tipoAnalisis)

Consultar impacto de variaciones cambiarias

Calcula el efecto de las tasas aplicadas sobre movimientos y saldos convertidos. Permite precisar la consulta mediante fecha inicial, fecha final, monedaBase, tipoAnalisis.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReportsApi();
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final monedaBase = monedaBase_example; // String | Valor de monedaBase aceptado por el handler.
final tipoAnalisis = tipoAnalisis_example; // String | Valor de tipoAnalisis aceptado por el handler.

try {
    final result = api_instance.mobileGetAccountingReportsExchangeImpact(fechaInicio, fechaFin, monedaBase, tipoAnalisis);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReportsApi->mobileGetAccountingReportsExchangeImpact: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **monedaBase** | **String**| Valor de monedaBase aceptado por el handler. | [optional] 
 **tipoAnalisis** | **String**| Valor de tipoAnalisis aceptado por el handler. | [optional] 

### Return type

[**GetAccountingReportsExchangeImpactResponse**](GetAccountingReportsExchangeImpactResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsMovements**
> GetAccountingReportsMovementsResponse mobileGetAccountingReportsMovements(busqueda, fechaInicio, fechaFin, cuentaId, tipoMovimiento, moneda, page, limit, formato)

Consultar movimientos contables

Lista entradas y salidas contables y puede devolver su exportación CSV. Permite precisar la consulta mediante texto libre, fecha inicial, fecha final, cuenta bancaria, tipo de movimiento, moneda, página, límite por página, formato de exportación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReportsApi();
final busqueda = busqueda_example; // String | Valor de busqueda aceptado por el handler.
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.
final tipoMovimiento = tipoMovimiento_example; // String | Valor de tipoMovimiento aceptado por el handler.
final moneda = moneda_example; // String | Código de moneda.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.
final formato = formato_example; // String | Valor de formato aceptado por el handler.

try {
    final result = api_instance.mobileGetAccountingReportsMovements(busqueda, fechaInicio, fechaFin, cuentaId, tipoMovimiento, moneda, page, limit, formato);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReportsApi->mobileGetAccountingReportsMovements: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **busqueda** | **String**| Valor de busqueda aceptado por el handler. | [optional] 
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 
 **tipoMovimiento** | **String**| Valor de tipoMovimiento aceptado por el handler. | [optional] 
 **moneda** | **String**| Código de moneda. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 
 **formato** | **String**| Valor de formato aceptado por el handler. | [optional] 

### Return type

[**GetAccountingReportsMovementsResponse**](GetAccountingReportsMovementsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsOverdueInvoices**
> GetAccountingReportsOverdueInvoicesResponse mobileGetAccountingReportsOverdueInvoices()

Consultar facturas vencidas

Identifica facturas cuyo vencimiento pasó y que aún conservan saldo pendiente.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReportsApi();

try {
    final result = api_instance.mobileGetAccountingReportsOverdueInvoices();
    print(result);
} catch (e) {
    print('Exception when calling AccountingReportsApi->mobileGetAccountingReportsOverdueInvoices: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingReportsOverdueInvoicesResponse**](GetAccountingReportsOverdueInvoicesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsSummary**
> GetAccountingReportsSummaryResponse mobileGetAccountingReportsSummary(fechaInicio, fechaFin, cuentaId, moneda, export_)

Consultar resumen financiero

Consolida saldos, ingresos, egresos y actividad contable del período. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria, moneda, formato de exportación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReportsApi();
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.
final moneda = moneda_example; // String | Código de moneda.
final export_ = export__example; // String | Valor de export aceptado por el handler.

try {
    final result = api_instance.mobileGetAccountingReportsSummary(fechaInicio, fechaFin, cuentaId, moneda, export_);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReportsApi->mobileGetAccountingReportsSummary: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 
 **moneda** | **String**| Código de moneda. | [optional] 
 **export_** | **String**| Valor de export aceptado por el handler. | [optional] 

### Return type

[**GetAccountingReportsSummaryResponse**](GetAccountingReportsSummaryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsTransfers**
> GetAccountingReportsTransfersResponse mobileGetAccountingReportsTransfers(fechaInicio, fechaFin, cuentaOrigenId, cuentaDestinoId, moneda, page, limit, realizadoPor, export_)

Consultar reporte de transferencias

Analiza transferencias por cuentas, monedas y responsable, con exportación opcional. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta de origen, cuenta de destino, moneda, página, límite por página, usuario responsable, formato de exportación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReportsApi();
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final cuentaOrigenId = cuentaOrigenId_example; // String | Valor de cuentaOrigenId aceptado por el handler.
final cuentaDestinoId = cuentaDestinoId_example; // String | Valor de cuentaDestinoId aceptado por el handler.
final moneda = moneda_example; // String | Código de moneda.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.
final realizadoPor = realizadoPor_example; // String | Valor de realizadoPor aceptado por el handler.
final export_ = export__example; // String | Valor de export aceptado por el handler.

try {
    final result = api_instance.mobileGetAccountingReportsTransfers(fechaInicio, fechaFin, cuentaOrigenId, cuentaDestinoId, moneda, page, limit, realizadoPor, export_);
    print(result);
} catch (e) {
    print('Exception when calling AccountingReportsApi->mobileGetAccountingReportsTransfers: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **cuentaOrigenId** | **String**| Valor de cuentaOrigenId aceptado por el handler. | [optional] 
 **cuentaDestinoId** | **String**| Valor de cuentaDestinoId aceptado por el handler. | [optional] 
 **moneda** | **String**| Código de moneda. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 
 **realizadoPor** | **String**| Valor de realizadoPor aceptado por el handler. | [optional] 
 **export_** | **String**| Valor de export aceptado por el handler. | [optional] 

### Return type

[**GetAccountingReportsTransfersResponse**](GetAccountingReportsTransfersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

