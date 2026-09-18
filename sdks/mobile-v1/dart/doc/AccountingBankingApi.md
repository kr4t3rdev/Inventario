# tcp_mobile_v1_sdk.api.AccountingBankingApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingBankAccounts**](AccountingBankingApi.md#mobilegetaccountingbankaccounts) | **GET** /accounting/bank-accounts | Consultar cuentas bancarias
[**mobileGetAccountingBankAccountsById**](AccountingBankingApi.md#mobilegetaccountingbankaccountsbyid) | **GET** /accounting/bank-accounts/{id} | Consultar cuentas bancaria
[**mobileGetAccountingBankAccountsByIdNestedHistory**](AccountingBankingApi.md#mobilegetaccountingbankaccountsbyidnestedhistory) | **GET** /accounting/bank-accounts/{id}/history | Consultar historial de cuentas bancarias
[**mobileGetAccountingBankAdjustments**](AccountingBankingApi.md#mobilegetaccountingbankadjustments) | **GET** /accounting/bank-adjustments | Consultar ajustes bancarios
[**mobileGetAccountingBankTransfers**](AccountingBankingApi.md#mobilegetaccountingbanktransfers) | **GET** /accounting/bank-transfers | Consultar transferencias bancarias
[**mobileGetAccountingBankTransfersById**](AccountingBankingApi.md#mobilegetaccountingbanktransfersbyid) | **GET** /accounting/bank-transfers/{id} | Consultar transferencias bancaria
[**mobileGetAccountingBankTransfersByIdComprobante**](AccountingBankingApi.md#mobilegetaccountingbanktransfersbyidcomprobante) | **GET** /accounting/bank-transfers/{id}/comprobante | Descargar comprobante de transferencias bancarias
[**mobilePostAccountingBankAdjustments**](AccountingBankingApi.md#mobilepostaccountingbankadjustments) | **POST** /accounting/bank-adjustments | Registrar ajustes bancarios
[**mobilePostAccountingBankTransfers**](AccountingBankingApi.md#mobilepostaccountingbanktransfers) | **POST** /accounting/bank-transfers | Registrar transferencias bancarias
[**mobilePostAccountingBankTransfersValidate**](AccountingBankingApi.md#mobilepostaccountingbanktransfersvalidate) | **POST** /accounting/bank-transfers/validate | Validar transferencia bancaria


# **mobileGetAccountingBankAccounts**
> GetAccountingBankAccountsResponse mobileGetAccountingBankAccounts()

Consultar cuentas bancarias

Lista las cuentas bancarias activas disponibles para operaciones contables.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingBankingApi();

try {
    final result = api_instance.mobileGetAccountingBankAccounts();
    print(result);
} catch (e) {
    print('Exception when calling AccountingBankingApi->mobileGetAccountingBankAccounts: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingBankAccountsResponse**](GetAccountingBankAccountsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankAccountsById**
> GetAccountingBankAccountsIdResponse mobileGetAccountingBankAccountsById(id)

Consultar cuentas bancaria

Devuelve datos, saldo y moneda de la cuenta bancaria identificada.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingBankingApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileGetAccountingBankAccountsById(id);
    print(result);
} catch (e) {
    print('Exception when calling AccountingBankingApi->mobileGetAccountingBankAccountsById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 

### Return type

[**GetAccountingBankAccountsIdResponse**](GetAccountingBankAccountsIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankAccountsByIdNestedHistory**
> GetAccountingBankAccountsIdHistoryResponse mobileGetAccountingBankAccountsByIdNestedHistory(id, fechaInicio, fechaFin, tipoMovimiento, page, limit)

Consultar historial de cuentas bancarias

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

final api_instance = AccountingBankingApi();
final id = id_example; // String | Identificador único del recurso.
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final tipoMovimiento = tipoMovimiento_example; // String | Valor de tipoMovimiento aceptado por el handler.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobileGetAccountingBankAccountsByIdNestedHistory(id, fechaInicio, fechaFin, tipoMovimiento, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingBankingApi->mobileGetAccountingBankAccountsByIdNestedHistory: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **tipoMovimiento** | **String**| Valor de tipoMovimiento aceptado por el handler. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingBankAccountsIdHistoryResponse**](GetAccountingBankAccountsIdHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankAdjustments**
> GetAccountingBankAdjustmentsResponse mobileGetAccountingBankAdjustments(cuentaId, tipo, fechaInicio, fechaFin, page, limit)

Consultar ajustes bancarios

Lista ingresos y egresos manuales registrados sobre cuentas bancarias. Permite precisar la consulta mediante cuenta bancaria, tipo, fecha inicial, fecha final, página, límite por página.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingBankingApi();
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.
final tipo = tipo_example; // String | Tipo de registro solicitado.
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobileGetAccountingBankAdjustments(cuentaId, tipo, fechaInicio, fechaFin, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingBankingApi->mobileGetAccountingBankAdjustments: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 
 **tipo** | **String**| Tipo de registro solicitado. | [optional] 
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingBankAdjustmentsResponse**](GetAccountingBankAdjustmentsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankTransfers**
> GetAccountingBankTransfersResponse mobileGetAccountingBankTransfers(fechaInicio, fechaFin, cuentaId)

Consultar transferencias bancarias

Lista transferencias entre cuentas con importes de origen, destino y tasa aplicada. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingBankingApi();
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.

try {
    final result = api_instance.mobileGetAccountingBankTransfers(fechaInicio, fechaFin, cuentaId);
    print(result);
} catch (e) {
    print('Exception when calling AccountingBankingApi->mobileGetAccountingBankTransfers: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 

### Return type

[**GetAccountingBankTransfersResponse**](GetAccountingBankTransfersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankTransfersById**
> GetAccountingBankTransfersIdResponse mobileGetAccountingBankTransfersById(id)

Consultar transferencias bancaria

Devuelve importes, cuentas, moneda, tasa y comprobante de la transferencia identificada.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingBankingApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileGetAccountingBankTransfersById(id);
    print(result);
} catch (e) {
    print('Exception when calling AccountingBankingApi->mobileGetAccountingBankTransfersById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 

### Return type

[**GetAccountingBankTransfersIdResponse**](GetAccountingBankTransfersIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankTransfersByIdComprobante**
> MultipartFile mobileGetAccountingBankTransfersByIdComprobante(id)

Descargar comprobante de transferencias bancarias

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

final api_instance = AccountingBankingApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileGetAccountingBankTransfersByIdComprobante(id);
    print(result);
} catch (e) {
    print('Exception when calling AccountingBankingApi->mobileGetAccountingBankTransfersByIdComprobante: $e\n');
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

# **mobilePostAccountingBankAdjustments**
> PostAccountingBankAdjustmentsResponse mobilePostAccountingBankAdjustments(bankAdjustmentRequest, cuentaId, tipo, fechaInicio, fechaFin, page, limit)

Registrar ajustes bancarios

Registra un ingreso o egreso manual y actualiza el saldo de la cuenta bancaria seleccionada.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingBankingApi();
final bankAdjustmentRequest = BankAdjustmentRequest(); // BankAdjustmentRequest | 
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.
final tipo = tipo_example; // String | Tipo de registro solicitado.
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final page = 56; // int | Página solicitada, comenzando en 1.
final limit = 56; // int | Cantidad máxima de elementos por página.

try {
    final result = api_instance.mobilePostAccountingBankAdjustments(bankAdjustmentRequest, cuentaId, tipo, fechaInicio, fechaFin, page, limit);
    print(result);
} catch (e) {
    print('Exception when calling AccountingBankingApi->mobilePostAccountingBankAdjustments: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bankAdjustmentRequest** | [**BankAdjustmentRequest**](BankAdjustmentRequest.md)|  | 
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 
 **tipo** | **String**| Tipo de registro solicitado. | [optional] 
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **page** | **int**| Página solicitada, comenzando en 1. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingBankAdjustmentsResponse**](PostAccountingBankAdjustmentsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingBankTransfers**
> PostAccountingBankTransfersResponse mobilePostAccountingBankTransfers(bankTransferCreateRequest, fechaInicio, fechaFin, cuentaId)

Registrar transferencias bancarias

Transfiere fondos entre dos cuentas, aplicando conversión cuando las monedas son diferentes.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingBankingApi();
final bankTransferCreateRequest = BankTransferCreateRequest(); // BankTransferCreateRequest | 
final fechaInicio = 2013-10-20T19:20:30+01:00; // DateTime | Inicio inclusivo del período consultado.
final fechaFin = 2013-10-20T19:20:30+01:00; // DateTime | Fin inclusivo del período consultado.
final cuentaId = cuentaId_example; // String | Identificador de la cuenta bancaria.

try {
    final result = api_instance.mobilePostAccountingBankTransfers(bankTransferCreateRequest, fechaInicio, fechaFin, cuentaId);
    print(result);
} catch (e) {
    print('Exception when calling AccountingBankingApi->mobilePostAccountingBankTransfers: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bankTransferCreateRequest** | [**BankTransferCreateRequest**](BankTransferCreateRequest.md)|  | 
 **fechaInicio** | **DateTime**| Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **DateTime**| Fin inclusivo del período consultado. | [optional] 
 **cuentaId** | **String**| Identificador de la cuenta bancaria. | [optional] 

### Return type

[**PostAccountingBankTransfersResponse**](PostAccountingBankTransfersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingBankTransfersValidate**
> PostAccountingBankTransfersValidateResponse mobilePostAccountingBankTransfersValidate(bankTransferValidationRequest)

Validar transferencia bancaria

Comprueba cuentas, monedas, saldo e importes antes de registrar una transferencia.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingBankingApi();
final bankTransferValidationRequest = BankTransferValidationRequest(); // BankTransferValidationRequest | 

try {
    final result = api_instance.mobilePostAccountingBankTransfersValidate(bankTransferValidationRequest);
    print(result);
} catch (e) {
    print('Exception when calling AccountingBankingApi->mobilePostAccountingBankTransfersValidate: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bankTransferValidationRequest** | [**BankTransferValidationRequest**](BankTransferValidationRequest.md)|  | 

### Return type

[**PostAccountingBankTransfersValidateResponse**](PostAccountingBankTransfersValidateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

