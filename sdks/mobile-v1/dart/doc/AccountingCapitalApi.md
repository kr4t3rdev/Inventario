# tcp_mobile_v1_sdk.api.AccountingCapitalApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingCapitalInjections**](AccountingCapitalApi.md#mobilegetaccountingcapitalinjections) | **GET** /accounting/capital-injections | Consultar inyecciones de capital
[**mobilePostAccountingCapitalInjections**](AccountingCapitalApi.md#mobilepostaccountingcapitalinjections) | **POST** /accounting/capital-injections | Registrar inyecciones de capital
[**mobilePostAccountingCapitalInjectionsByIdPayments**](AccountingCapitalApi.md#mobilepostaccountingcapitalinjectionsbyidpayments) | **POST** /accounting/capital-injections/{id}/payments | Registrar pago de inyecciones de capital


# **mobileGetAccountingCapitalInjections**
> GetAccountingCapitalInjectionsResponse mobileGetAccountingCapitalInjections(tipo)

Consultar inyecciones de capital

Lista aportes de capital registrados para el tenant. Permite precisar la consulta mediante tipo.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCapitalApi();
final tipo = tipo_example; // String | Tipo de registro solicitado.

try {
    final result = api_instance.mobileGetAccountingCapitalInjections(tipo);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCapitalApi->mobileGetAccountingCapitalInjections: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tipo** | **String**| Tipo de registro solicitado. | [optional] 

### Return type

[**GetAccountingCapitalInjectionsResponse**](GetAccountingCapitalInjectionsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCapitalInjections**
> PostAccountingCapitalInjectionsResponse mobilePostAccountingCapitalInjections(capitalInjectionCreateRequest, tipo)

Registrar inyecciones de capital

Registra un aporte de capital y lo vincula con la cuenta bancaria indicada cuando corresponde.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingCapitalApi();
final capitalInjectionCreateRequest = CapitalInjectionCreateRequest(); // CapitalInjectionCreateRequest | 
final tipo = tipo_example; // String | Tipo de registro solicitado.

try {
    final result = api_instance.mobilePostAccountingCapitalInjections(capitalInjectionCreateRequest, tipo);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCapitalApi->mobilePostAccountingCapitalInjections: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **capitalInjectionCreateRequest** | [**CapitalInjectionCreateRequest**](CapitalInjectionCreateRequest.md)|  | 
 **tipo** | **String**| Tipo de registro solicitado. | [optional] 

### Return type

[**PostAccountingCapitalInjectionsResponse**](PostAccountingCapitalInjectionsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCapitalInjectionsByIdPayments**
> PostAccountingCapitalInjectionsIdPaymentsResponse mobilePostAccountingCapitalInjectionsByIdPayments(id, capitalPaymentRequest)

Registrar pago de inyecciones de capital

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

final api_instance = AccountingCapitalApi();
final id = id_example; // String | Identificador único del recurso.
final capitalPaymentRequest = CapitalPaymentRequest(); // CapitalPaymentRequest | 

try {
    final result = api_instance.mobilePostAccountingCapitalInjectionsByIdPayments(id, capitalPaymentRequest);
    print(result);
} catch (e) {
    print('Exception when calling AccountingCapitalApi->mobilePostAccountingCapitalInjectionsByIdPayments: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 
 **capitalPaymentRequest** | [**CapitalPaymentRequest**](CapitalPaymentRequest.md)|  | 

### Return type

[**PostAccountingCapitalInjectionsIdPaymentsResponse**](PostAccountingCapitalInjectionsIdPaymentsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

