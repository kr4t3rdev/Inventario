# tcp_mobile_v1_sdk.api.AccountingCashFinancingApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingCashDebts**](AccountingCashFinancingApi.md#mobilegetaccountingcashdebts) | **GET** /accounting/cash-debts | Consultar deudas de efectivo
[**mobileGetAccountingCashDebtsById**](AccountingCashFinancingApi.md#mobilegetaccountingcashdebtsbyid) | **GET** /accounting/cash-debts/{id} | Consultar deudas de efectivo
[**mobileGetAccountingCashDebtsStats**](AccountingCashFinancingApi.md#mobilegetaccountingcashdebtsstats) | **GET** /accounting/cash-debts/stats | Consultar indicadores de deudas de efectivo
[**mobileGetAccountingCashLoans**](AccountingCashFinancingApi.md#mobilegetaccountingcashloans) | **GET** /accounting/cash-loans | Consultar préstamos de efectivo
[**mobileGetAccountingCashLoansById**](AccountingCashFinancingApi.md#mobilegetaccountingcashloansbyid) | **GET** /accounting/cash-loans/{id} | Consultar préstamos de efectivo
[**mobileGetAccountingCashLoansByIdComprobante**](AccountingCashFinancingApi.md#mobilegetaccountingcashloansbyidcomprobante) | **GET** /accounting/cash-loans/{id}/comprobante | Descargar comprobante de préstamos de efectivo
[**mobileGetAccountingCashLoansByIdNestedHistory**](AccountingCashFinancingApi.md#mobilegetaccountingcashloansbyidnestedhistory) | **GET** /accounting/cash-loans/{id}/history | Consultar historial de préstamos de efectivo
[**mobileGetAccountingCashLoansStats**](AccountingCashFinancingApi.md#mobilegetaccountingcashloansstats) | **GET** /accounting/cash-loans/stats | Consultar indicadores de préstamos de efectivo
[**mobilePostAccountingCashDebts**](AccountingCashFinancingApi.md#mobilepostaccountingcashdebts) | **POST** /accounting/cash-debts | Registrar deudas de efectivo
[**mobilePostAccountingCashDebtsByIdPayments**](AccountingCashFinancingApi.md#mobilepostaccountingcashdebtsbyidpayments) | **POST** /accounting/cash-debts/{id}/payments | Registrar pago de deudas de efectivo
[**mobilePostAccountingCashLoans**](AccountingCashFinancingApi.md#mobilepostaccountingcashloans) | **POST** /accounting/cash-loans | Registrar préstamos de efectivo
[**mobilePostAccountingCashLoansByIdPayments**](AccountingCashFinancingApi.md#mobilepostaccountingcashloansbyidpayments) | **POST** /accounting/cash-loans/{id}/payments | Registrar pago de préstamos de efectivo
[**mobilePutAccountingCashDebtsById**](AccountingCashFinancingApi.md#mobileputaccountingcashdebtsbyid) | **PUT** /accounting/cash-debts/{id} | Actualizar deudas de efectivo
[**mobilePutAccountingCashLoansById**](AccountingCashFinancingApi.md#mobileputaccountingcashloansbyid) | **PUT** /accounting/cash-loans/{id} | Actualizar préstamos de efectivo


# **mobileGetAccountingCashDebts**
> GetAccountingCashDebtsResponse mobileGetAccountingCashDebts(estado, proveedorId, moneda, page, limit)

Consultar deudas de efectivo

Lista deudas de efectivo con proveedores, sus vencimientos y saldos. Permite precisar la consulta mediante estado, proveedor, moneda, página, límite por página.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final estado = true; // bool | Estado usado para filtrar resultados.
final proveedorId = proveedorId_example; // String | Identificador del proveedor.
final moneda = moneda_example; // String | Código de moneda.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobileGetAccountingCashDebts(estado, proveedorId, moneda, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobileGetAccountingCashDebts: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **estado** | **bool**| Estado usado para filtrar resultados. | [optional] 
 **proveedorId** | **String**| Identificador del proveedor. | [optional] 
 **moneda** | **String**| Código de moneda. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingCashDebtsResponse**](GetAccountingCashDebtsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashDebtsById**
> GetAccountingCashDebtsIdResponse mobileGetAccountingCashDebtsById(id)

Consultar deudas de efectivo

Devuelve la deuda identificada con proveedor, cuenta por pagar y pagos relacionados.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileGetAccountingCashDebtsById(id);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobileGetAccountingCashDebtsById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 

### Return type

[**GetAccountingCashDebtsIdResponse**](GetAccountingCashDebtsIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashDebtsStats**
> GetAccountingCashDebtsStatsResponse mobileGetAccountingCashDebtsStats()

Consultar indicadores de deudas de efectivo

Calcula cantidad, capital y saldo pendiente de las deudas de efectivo.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();

try {
    final result = api_instance.mobileGetAccountingCashDebtsStats();
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobileGetAccountingCashDebtsStats: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingCashDebtsStatsResponse**](GetAccountingCashDebtsStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashLoans**
> GetAccountingCashLoansResponse mobileGetAccountingCashLoans(estado, clienteId, moneda, page, limit)

Consultar préstamos de efectivo

Lista préstamos de efectivo otorgados a clientes, con vencimientos y saldos. Permite precisar la consulta mediante estado, cliente, moneda, página, límite por página.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final estado = true; // bool | Estado usado para filtrar resultados.
final clienteId = clienteId_example; // String | Identificador del cliente.
final moneda = moneda_example; // String | Código de moneda.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobileGetAccountingCashLoans(estado, clienteId, moneda, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobileGetAccountingCashLoans: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **estado** | **bool**| Estado usado para filtrar resultados. | [optional] 
 **clienteId** | **String**| Identificador del cliente. | [optional] 
 **moneda** | **String**| Código de moneda. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingCashLoansResponse**](GetAccountingCashLoansResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashLoansById**
> GetAccountingCashLoansIdResponse mobileGetAccountingCashLoansById(id)

Consultar préstamos de efectivo

Devuelve el préstamo identificado con cliente, cuenta por cobrar y pagos relacionados.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileGetAccountingCashLoansById(id);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobileGetAccountingCashLoansById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 

### Return type

[**GetAccountingCashLoansIdResponse**](GetAccountingCashLoansIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashLoansByIdComprobante**
> MultipartFile mobileGetAccountingCashLoansByIdComprobante(id)

Descargar comprobante de préstamos de efectivo

Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileGetAccountingCashLoansByIdComprobante(id);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobileGetAccountingCashLoansByIdComprobante: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 

### Return type

[**MultipartFile**](MultipartFile.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/pdf, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashLoansByIdNestedHistory**
> GetAccountingCashLoansIdHistoryResponse mobileGetAccountingCashLoansByIdNestedHistory(id)

Consultar historial de préstamos de efectivo

Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileGetAccountingCashLoansByIdNestedHistory(id);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobileGetAccountingCashLoansByIdNestedHistory: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 

### Return type

[**GetAccountingCashLoansIdHistoryResponse**](GetAccountingCashLoansIdHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashLoansStats**
> GetAccountingCashLoansStatsResponse mobileGetAccountingCashLoansStats()

Consultar indicadores de préstamos de efectivo

Calcula cantidad, capital y saldo pendiente de los préstamos de efectivo.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();

try {
    final result = api_instance.mobileGetAccountingCashLoansStats();
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobileGetAccountingCashLoansStats: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingCashLoansStatsResponse**](GetAccountingCashLoansStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCashDebts**
> PostAccountingCashDebtsResponse mobilePostAccountingCashDebts(cashDebtCreateRequest, estado, proveedorId, moneda, page, limit)

Registrar deudas de efectivo

Registra financiamiento recibido de un proveedor, incrementa la cuenta bancaria y crea la cuenta por pagar.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final cashDebtCreateRequest = CashDebtCreateRequest(); // CashDebtCreateRequest | 
final estado = true; // bool | Estado usado para filtrar resultados.
final proveedorId = proveedorId_example; // String | Identificador del proveedor.
final moneda = moneda_example; // String | Código de moneda.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobilePostAccountingCashDebts(cashDebtCreateRequest, estado, proveedorId, moneda, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobilePostAccountingCashDebts: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cashDebtCreateRequest** | [**CashDebtCreateRequest**](CashDebtCreateRequest.md)|  | 
 **estado** | **bool**| Estado usado para filtrar resultados. | [optional] 
 **proveedorId** | **String**| Identificador del proveedor. | [optional] 
 **moneda** | **String**| Código de moneda. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingCashDebtsResponse**](PostAccountingCashDebtsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCashDebtsByIdPayments**
> PostAccountingCashDebtsIdPaymentsResponse mobilePostAccountingCashDebtsByIdPayments(id, cashPaymentRequest)

Registrar pago de deudas de efectivo

Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final id = id_example; // String | Identificador único del recurso.
final cashPaymentRequest = CashPaymentRequest(); // CashPaymentRequest | 

try {
    final result = api_instance.mobilePostAccountingCashDebtsByIdPayments(id, cashPaymentRequest);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobilePostAccountingCashDebtsByIdPayments: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 
 **cashPaymentRequest** | [**CashPaymentRequest**](CashPaymentRequest.md)|  | 

### Return type

[**PostAccountingCashDebtsIdPaymentsResponse**](PostAccountingCashDebtsIdPaymentsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCashLoans**
> PostAccountingCashLoansResponse mobilePostAccountingCashLoans(cashLoanCreateRequest, estado, clienteId, moneda, page, limit)

Registrar préstamos de efectivo

Registra un préstamo a un cliente, descuenta fondos de la cuenta bancaria y crea la cuenta por cobrar.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final cashLoanCreateRequest = CashLoanCreateRequest(); // CashLoanCreateRequest | 
final estado = true; // bool | Estado usado para filtrar resultados.
final clienteId = clienteId_example; // String | Identificador del cliente.
final moneda = moneda_example; // String | Código de moneda.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobilePostAccountingCashLoans(cashLoanCreateRequest, estado, clienteId, moneda, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobilePostAccountingCashLoans: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cashLoanCreateRequest** | [**CashLoanCreateRequest**](CashLoanCreateRequest.md)|  | 
 **estado** | **bool**| Estado usado para filtrar resultados. | [optional] 
 **clienteId** | **String**| Identificador del cliente. | [optional] 
 **moneda** | **String**| Código de moneda. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingCashLoansResponse**](PostAccountingCashLoansResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCashLoansByIdPayments**
> PostAccountingCashLoansIdPaymentsResponse mobilePostAccountingCashLoansByIdPayments(id, cashPaymentRequest)

Registrar pago de préstamos de efectivo

Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final id = id_example; // String | Identificador único del recurso.
final cashPaymentRequest = CashPaymentRequest(); // CashPaymentRequest | 

try {
    final result = api_instance.mobilePostAccountingCashLoansByIdPayments(id, cashPaymentRequest);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobilePostAccountingCashLoansByIdPayments: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 
 **cashPaymentRequest** | [**CashPaymentRequest**](CashPaymentRequest.md)|  | 

### Return type

[**PostAccountingCashLoansIdPaymentsResponse**](PostAccountingCashLoansIdPaymentsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutAccountingCashDebtsById**
> PutAccountingCashDebtsIdResponse mobilePutAccountingCashDebtsById(id, cashOperationUpdateRequest)

Actualizar deudas de efectivo

Actualiza vencimiento, tasa de interés u observaciones de la deuda identificada.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final id = id_example; // String | Identificador único del recurso.
final cashOperationUpdateRequest = CashOperationUpdateRequest(); // CashOperationUpdateRequest | 

try {
    final result = api_instance.mobilePutAccountingCashDebtsById(id, cashOperationUpdateRequest);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobilePutAccountingCashDebtsById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 
 **cashOperationUpdateRequest** | [**CashOperationUpdateRequest**](CashOperationUpdateRequest.md)|  | 

### Return type

[**PutAccountingCashDebtsIdResponse**](PutAccountingCashDebtsIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutAccountingCashLoansById**
> PutAccountingCashLoansIdResponse mobilePutAccountingCashLoansById(id, cashOperationUpdateRequest)

Actualizar préstamos de efectivo

Actualiza vencimiento, tasa de interés u observaciones del préstamo identificado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCashFinancingApi();
final id = id_example; // String | Identificador único del recurso.
final cashOperationUpdateRequest = CashOperationUpdateRequest(); // CashOperationUpdateRequest | 

try {
    final result = api_instance.mobilePutAccountingCashLoansById(id, cashOperationUpdateRequest);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCashFinancingApi->mobilePutAccountingCashLoansById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 
 **cashOperationUpdateRequest** | [**CashOperationUpdateRequest**](CashOperationUpdateRequest.md)|  | 

### Return type

[**PutAccountingCashLoansIdResponse**](PutAccountingCashLoansIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

