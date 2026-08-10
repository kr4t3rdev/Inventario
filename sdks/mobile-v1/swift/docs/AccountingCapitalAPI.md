# AccountingCapitalAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingCapitalInjections**](AccountingCapitalAPI.md#mobilegetaccountingcapitalinjections) | **GET** /accounting/capital-injections | Consultar inyecciones de capital
[**mobilePostAccountingCapitalInjections**](AccountingCapitalAPI.md#mobilepostaccountingcapitalinjections) | **POST** /accounting/capital-injections | Registrar inyecciones de capital
[**mobilePostAccountingCapitalInjectionsByIdPayments**](AccountingCapitalAPI.md#mobilepostaccountingcapitalinjectionsbyidpayments) | **POST** /accounting/capital-injections/{id}/payments | Registrar pago de inyecciones de capital


# **mobileGetAccountingCapitalInjections**
```swift
    open class func mobileGetAccountingCapitalInjections(tipo: String? = nil, completion: @escaping (_ data: GetAccountingCapitalInjectionsResponse?, _ error: Error?) -> Void)
```

Consultar inyecciones de capital

Lista aportes de capital registrados para el tenant. Permite precisar la consulta mediante tipo.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let tipo = "tipo_example" // String | Tipo de registro solicitado. (optional)

// Consultar inyecciones de capital
AccountingCapitalAPI.mobileGetAccountingCapitalInjections(tipo: tipo) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tipo** | **String** | Tipo de registro solicitado. | [optional] 

### Return type

[**GetAccountingCapitalInjectionsResponse**](GetAccountingCapitalInjectionsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCapitalInjections**
```swift
    open class func mobilePostAccountingCapitalInjections(capitalInjectionCreateRequest: CapitalInjectionCreateRequest, tipo: String? = nil, completion: @escaping (_ data: PostAccountingCapitalInjectionsResponse?, _ error: Error?) -> Void)
```

Registrar inyecciones de capital

Registra un aporte de capital y lo vincula con la cuenta bancaria indicada cuando corresponde.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let capitalInjectionCreateRequest = CapitalInjectionCreateRequest(monto: 123, moneda: "moneda_example", tipo: "tipo_example", descripcion: "descripcion_example", cuentaBancariaId: "cuentaBancariaId_example") // CapitalInjectionCreateRequest | 
let tipo = "tipo_example" // String | Tipo de registro solicitado. (optional)

// Registrar inyecciones de capital
AccountingCapitalAPI.mobilePostAccountingCapitalInjections(capitalInjectionCreateRequest: capitalInjectionCreateRequest, tipo: tipo) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **capitalInjectionCreateRequest** | [**CapitalInjectionCreateRequest**](CapitalInjectionCreateRequest.md) |  | 
 **tipo** | **String** | Tipo de registro solicitado. | [optional] 

### Return type

[**PostAccountingCapitalInjectionsResponse**](PostAccountingCapitalInjectionsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCapitalInjectionsByIdPayments**
```swift
    open class func mobilePostAccountingCapitalInjectionsByIdPayments(id: String, capitalPaymentRequest: CapitalPaymentRequest, completion: @escaping (_ data: PostAccountingCapitalInjectionsIdPaymentsResponse?, _ error: Error?) -> Void)
```

Registrar pago de inyecciones de capital

Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let capitalPaymentRequest = CapitalPaymentRequest(monto: 123, cuentaBancariaId: "cuentaBancariaId_example", tipoPagoId: "tipoPagoId_example", observaciones: "observaciones_example") // CapitalPaymentRequest | 

// Registrar pago de inyecciones de capital
AccountingCapitalAPI.mobilePostAccountingCapitalInjectionsByIdPayments(id: id, capitalPaymentRequest: capitalPaymentRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String** | Identificador único del recurso. | 
 **capitalPaymentRequest** | [**CapitalPaymentRequest**](CapitalPaymentRequest.md) |  | 

### Return type

[**PostAccountingCapitalInjectionsIdPaymentsResponse**](PostAccountingCapitalInjectionsIdPaymentsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

