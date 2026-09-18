# tcp_mobile_v1_sdk.api.AccountingConfigurationApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileDeleteAccountingPaymentTypesById**](AccountingConfigurationApi.md#mobiledeleteaccountingpaymenttypesbyid) | **DELETE** /accounting/payment-types/{id} | Eliminar tipos de pago
[**mobileGetAccountingExchangeMonedas**](AccountingConfigurationApi.md#mobilegetaccountingexchangemonedas) | **GET** /accounting/exchange/monedas | Consultar monedas configuradas
[**mobileGetAccountingExchangeTasas**](AccountingConfigurationApi.md#mobilegetaccountingexchangetasas) | **GET** /accounting/exchange/tasas | Consultar tasas de cambio
[**mobileGetAccountingLogs**](AccountingConfigurationApi.md#mobilegetaccountinglogs) | **GET** /accounting/logs | Consultar eventos de auditoría contable
[**mobileGetAccountingPaymentTypes**](AccountingConfigurationApi.md#mobilegetaccountingpaymenttypes) | **GET** /accounting/payment-types | Consultar tipos de pago
[**mobileGetAccountingPaymentTypesAvailableAccounts**](AccountingConfigurationApi.md#mobilegetaccountingpaymenttypesavailableaccounts) | **GET** /accounting/payment-types/available-accounts | Consultar cuentas disponibles para tipos de pago
[**mobileGetAccountingPaymentTypesById**](AccountingConfigurationApi.md#mobilegetaccountingpaymenttypesbyid) | **GET** /accounting/payment-types/{id} | Consultar tipos de pago
[**mobilePutAccountingPaymentTypesById**](AccountingConfigurationApi.md#mobileputaccountingpaymenttypesbyid) | **PUT** /accounting/payment-types/{id} | Actualizar tipos de pago


# **mobileDeleteAccountingPaymentTypesById**
> DeleteAccountingPaymentTypesIdResponse mobileDeleteAccountingPaymentTypesById(id)

Eliminar tipos de pago

Elimina el medio de pago únicamente cuando no tiene conciliaciones asociadas.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingConfigurationApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileDeleteAccountingPaymentTypesById(id);
    print(result);
} catch (e) {
    print('Exception when calling AccountingConfigurationApi->mobileDeleteAccountingPaymentTypesById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 

### Return type

[**DeleteAccountingPaymentTypesIdResponse**](DeleteAccountingPaymentTypesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingExchangeMonedas**
> GetAccountingExchangeMonedasResponse mobileGetAccountingExchangeMonedas()

Consultar monedas configuradas

Devuelve el catálogo de monedas habilitadas para operaciones y reportes contables.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingConfigurationApi();

try {
    final result = api_instance.mobileGetAccountingExchangeMonedas();
    print(result);
} catch (e) {
    print('Exception when calling AccountingConfigurationApi->mobileGetAccountingExchangeMonedas: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingExchangeMonedasResponse**](GetAccountingExchangeMonedasResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingExchangeTasas**
> GetAccountingExchangeTasasResponse mobileGetAccountingExchangeTasas()

Consultar tasas de cambio

Devuelve las tasas de cambio vigentes e históricas utilizadas por contabilidad.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingConfigurationApi();

try {
    final result = api_instance.mobileGetAccountingExchangeTasas();
    print(result);
} catch (e) {
    print('Exception when calling AccountingConfigurationApi->mobileGetAccountingExchangeTasas: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingExchangeTasasResponse**](GetAccountingExchangeTasasResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingLogs**
> GetAccountingLogsResponse mobileGetAccountingLogs(entidad, limit, offset)

Consultar eventos de auditoría contable

Consulta la trazabilidad de acciones contables registrada por usuario y entidad. Permite precisar la consulta mediante entidad, límite por página, offset.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingConfigurationApi();
final entidad = entidad_example; // String | Valor de entidad aceptado por el handler.
final limit = 56; // int | Cantidad máxima de elementos por página.
final offset = offset_example; // String | Valor de offset aceptado por el handler.

try {
    final result = api_instance.mobileGetAccountingLogs(entidad, limit, offset);
    print(result);
} catch (e) {
    print('Exception when calling AccountingConfigurationApi->mobileGetAccountingLogs: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **entidad** | **String**| Valor de entidad aceptado por el handler. | [optional] 
 **limit** | **int**| Cantidad máxima de elementos por página. | [optional] 
 **offset** | **String**| Valor de offset aceptado por el handler. | [optional] 

### Return type

[**GetAccountingLogsResponse**](GetAccountingLogsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingPaymentTypes**
> GetAccountingPaymentTypesResponse mobileGetAccountingPaymentTypes(includeInactive, requiereCuenta)

Consultar tipos de pago

Lista los medios de pago configurados y su cuenta bancaria predeterminada. Permite precisar la consulta mediante includeInactive, requiereCuenta.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingConfigurationApi();
final includeInactive = true; // bool | Valor de includeInactive aceptado por el handler.
final requiereCuenta = requiereCuenta_example; // String | Valor de requiereCuenta aceptado por el handler.

try {
    final result = api_instance.mobileGetAccountingPaymentTypes(includeInactive, requiereCuenta);
    print(result);
} catch (e) {
    print('Exception when calling AccountingConfigurationApi->mobileGetAccountingPaymentTypes: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **includeInactive** | **bool**| Valor de includeInactive aceptado por el handler. | [optional] 
 **requiereCuenta** | **String**| Valor de requiereCuenta aceptado por el handler. | [optional] 

### Return type

[**GetAccountingPaymentTypesResponse**](GetAccountingPaymentTypesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingPaymentTypesAvailableAccounts**
> GetAccountingPaymentTypesAvailableAccountsResponse mobileGetAccountingPaymentTypesAvailableAccounts(moneda, tipoCuenta)

Consultar cuentas disponibles para tipos de pago

Lista cuentas activas que pueden asociarse como cuenta predeterminada de un medio de pago. Permite precisar la consulta mediante moneda, tipoCuenta.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingConfigurationApi();
final moneda = moneda_example; // String | Código de moneda.
final tipoCuenta = tipoCuenta_example; // String | Valor de tipoCuenta aceptado por el handler.

try {
    final result = api_instance.mobileGetAccountingPaymentTypesAvailableAccounts(moneda, tipoCuenta);
    print(result);
} catch (e) {
    print('Exception when calling AccountingConfigurationApi->mobileGetAccountingPaymentTypesAvailableAccounts: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **moneda** | **String**| Código de moneda. | [optional] 
 **tipoCuenta** | **String**| Valor de tipoCuenta aceptado por el handler. | [optional] 

### Return type

[**GetAccountingPaymentTypesAvailableAccountsResponse**](GetAccountingPaymentTypesAvailableAccountsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingPaymentTypesById**
> GetAccountingPaymentTypesIdResponse mobileGetAccountingPaymentTypesById(id)

Consultar tipos de pago

Devuelve el medio de pago identificado, sus conciliaciones asociadas y la cuenta predeterminada.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingConfigurationApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileGetAccountingPaymentTypesById(id);
    print(result);
} catch (e) {
    print('Exception when calling AccountingConfigurationApi->mobileGetAccountingPaymentTypesById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 

### Return type

[**GetAccountingPaymentTypesIdResponse**](GetAccountingPaymentTypesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutAccountingPaymentTypesById**
> PutAccountingPaymentTypesIdResponse mobilePutAccountingPaymentTypesById(id, paymentTypeUpdateRequest)

Actualizar tipos de pago

Actualiza nombre, descripción, requisito de cuenta, cuenta predeterminada o estado activo del medio de pago.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingConfigurationApi();
final id = id_example; // String | Identificador único del recurso.
final paymentTypeUpdateRequest = PaymentTypeUpdateRequest(); // PaymentTypeUpdateRequest | 

try {
    final result = api_instance.mobilePutAccountingPaymentTypesById(id, paymentTypeUpdateRequest);
    print(result);
} catch (e) {
    print('Exception when calling AccountingConfigurationApi->mobilePutAccountingPaymentTypesById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 
 **paymentTypeUpdateRequest** | [**PaymentTypeUpdateRequest**](PaymentTypeUpdateRequest.md)|  | 

### Return type

[**PutAccountingPaymentTypesIdResponse**](PutAccountingPaymentTypesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

