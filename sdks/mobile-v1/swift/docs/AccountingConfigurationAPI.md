# AccountingConfigurationAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileDeleteAccountingPaymentTypesById**](AccountingConfigurationAPI.md#mobiledeleteaccountingpaymenttypesbyid) | **DELETE** /accounting/payment-types/{id} | Eliminar tipos de pago
[**mobileGetAccountingExchangeMonedas**](AccountingConfigurationAPI.md#mobilegetaccountingexchangemonedas) | **GET** /accounting/exchange/monedas | Consultar monedas configuradas
[**mobileGetAccountingExchangeTasas**](AccountingConfigurationAPI.md#mobilegetaccountingexchangetasas) | **GET** /accounting/exchange/tasas | Consultar tasas de cambio
[**mobileGetAccountingLogs**](AccountingConfigurationAPI.md#mobilegetaccountinglogs) | **GET** /accounting/logs | Consultar eventos de auditoría contable
[**mobileGetAccountingPaymentTypes**](AccountingConfigurationAPI.md#mobilegetaccountingpaymenttypes) | **GET** /accounting/payment-types | Consultar tipos de pago
[**mobileGetAccountingPaymentTypesAvailableAccounts**](AccountingConfigurationAPI.md#mobilegetaccountingpaymenttypesavailableaccounts) | **GET** /accounting/payment-types/available-accounts | Consultar cuentas disponibles para tipos de pago
[**mobileGetAccountingPaymentTypesById**](AccountingConfigurationAPI.md#mobilegetaccountingpaymenttypesbyid) | **GET** /accounting/payment-types/{id} | Consultar tipos de pago
[**mobilePutAccountingPaymentTypesById**](AccountingConfigurationAPI.md#mobileputaccountingpaymenttypesbyid) | **PUT** /accounting/payment-types/{id} | Actualizar tipos de pago


# **mobileDeleteAccountingPaymentTypesById**
```swift
    open class func mobileDeleteAccountingPaymentTypesById(id: String, completion: @escaping (_ data: DeleteAccountingPaymentTypesIdResponse?, _ error: Error?) -> Void)
```

Eliminar tipos de pago

Elimina el medio de pago únicamente cuando no tiene conciliaciones asociadas.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Eliminar tipos de pago
AccountingConfigurationAPI.mobileDeleteAccountingPaymentTypesById(id: id) { (response, error) in
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

### Return type

[**DeleteAccountingPaymentTypesIdResponse**](DeleteAccountingPaymentTypesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingExchangeMonedas**
```swift
    open class func mobileGetAccountingExchangeMonedas(completion: @escaping (_ data: GetAccountingExchangeMonedasResponse?, _ error: Error?) -> Void)
```

Consultar monedas configuradas

Devuelve el catálogo de monedas habilitadas para operaciones y reportes contables.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar monedas configuradas
AccountingConfigurationAPI.mobileGetAccountingExchangeMonedas() { (response, error) in
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
```swift
    open class func mobileGetAccountingExchangeTasas(completion: @escaping (_ data: GetAccountingExchangeTasasResponse?, _ error: Error?) -> Void)
```

Consultar tasas de cambio

Devuelve las tasas de cambio vigentes e históricas utilizadas por contabilidad.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar tasas de cambio
AccountingConfigurationAPI.mobileGetAccountingExchangeTasas() { (response, error) in
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
```swift
    open class func mobileGetAccountingLogs(entidad: String? = nil, limit: Int? = nil, offset: String? = nil, completion: @escaping (_ data: GetAccountingLogsResponse?, _ error: Error?) -> Void)
```

Consultar eventos de auditoría contable

Consulta la trazabilidad de acciones contables registrada por usuario y entidad. Permite precisar la consulta mediante entidad, límite por página, offset.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let entidad = "entidad_example" // String | Valor de entidad aceptado por el handler. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)
let offset = "offset_example" // String | Valor de offset aceptado por el handler. (optional)

// Consultar eventos de auditoría contable
AccountingConfigurationAPI.mobileGetAccountingLogs(entidad: entidad, limit: limit, offset: offset) { (response, error) in
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
 **entidad** | **String** | Valor de entidad aceptado por el handler. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 
 **offset** | **String** | Valor de offset aceptado por el handler. | [optional] 

### Return type

[**GetAccountingLogsResponse**](GetAccountingLogsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingPaymentTypes**
```swift
    open class func mobileGetAccountingPaymentTypes(includeInactive: Bool? = nil, requiereCuenta: String? = nil, completion: @escaping (_ data: GetAccountingPaymentTypesResponse?, _ error: Error?) -> Void)
```

Consultar tipos de pago

Lista los medios de pago configurados y su cuenta bancaria predeterminada. Permite precisar la consulta mediante includeInactive, requiereCuenta.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let includeInactive = true // Bool | Valor de includeInactive aceptado por el handler. (optional)
let requiereCuenta = "requiereCuenta_example" // String | Valor de requiereCuenta aceptado por el handler. (optional)

// Consultar tipos de pago
AccountingConfigurationAPI.mobileGetAccountingPaymentTypes(includeInactive: includeInactive, requiereCuenta: requiereCuenta) { (response, error) in
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
 **includeInactive** | **Bool** | Valor de includeInactive aceptado por el handler. | [optional] 
 **requiereCuenta** | **String** | Valor de requiereCuenta aceptado por el handler. | [optional] 

### Return type

[**GetAccountingPaymentTypesResponse**](GetAccountingPaymentTypesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingPaymentTypesAvailableAccounts**
```swift
    open class func mobileGetAccountingPaymentTypesAvailableAccounts(moneda: String? = nil, tipoCuenta: String? = nil, completion: @escaping (_ data: GetAccountingPaymentTypesAvailableAccountsResponse?, _ error: Error?) -> Void)
```

Consultar cuentas disponibles para tipos de pago

Lista cuentas activas que pueden asociarse como cuenta predeterminada de un medio de pago. Permite precisar la consulta mediante moneda, tipoCuenta.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let moneda = "moneda_example" // String | Código de moneda. (optional)
let tipoCuenta = "tipoCuenta_example" // String | Valor de tipoCuenta aceptado por el handler. (optional)

// Consultar cuentas disponibles para tipos de pago
AccountingConfigurationAPI.mobileGetAccountingPaymentTypesAvailableAccounts(moneda: moneda, tipoCuenta: tipoCuenta) { (response, error) in
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
 **moneda** | **String** | Código de moneda. | [optional] 
 **tipoCuenta** | **String** | Valor de tipoCuenta aceptado por el handler. | [optional] 

### Return type

[**GetAccountingPaymentTypesAvailableAccountsResponse**](GetAccountingPaymentTypesAvailableAccountsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingPaymentTypesById**
```swift
    open class func mobileGetAccountingPaymentTypesById(id: String, completion: @escaping (_ data: GetAccountingPaymentTypesIdResponse?, _ error: Error?) -> Void)
```

Consultar tipos de pago

Devuelve el medio de pago identificado, sus conciliaciones asociadas y la cuenta predeterminada.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Consultar tipos de pago
AccountingConfigurationAPI.mobileGetAccountingPaymentTypesById(id: id) { (response, error) in
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

### Return type

[**GetAccountingPaymentTypesIdResponse**](GetAccountingPaymentTypesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutAccountingPaymentTypesById**
```swift
    open class func mobilePutAccountingPaymentTypesById(id: String, paymentTypeUpdateRequest: PaymentTypeUpdateRequest, completion: @escaping (_ data: PutAccountingPaymentTypesIdResponse?, _ error: Error?) -> Void)
```

Actualizar tipos de pago

Actualiza nombre, descripción, requisito de cuenta, cuenta predeterminada o estado activo del medio de pago.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let paymentTypeUpdateRequest = PaymentTypeUpdateRequest(nombre: "nombre_example", descripcion: "descripcion_example", requiereCuenta: false, cuentaDefecto: "cuentaDefecto_example", isActive: false) // PaymentTypeUpdateRequest | 

// Actualizar tipos de pago
AccountingConfigurationAPI.mobilePutAccountingPaymentTypesById(id: id, paymentTypeUpdateRequest: paymentTypeUpdateRequest) { (response, error) in
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
 **paymentTypeUpdateRequest** | [**PaymentTypeUpdateRequest**](PaymentTypeUpdateRequest.md) |  | 

### Return type

[**PutAccountingPaymentTypesIdResponse**](PutAccountingPaymentTypesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

