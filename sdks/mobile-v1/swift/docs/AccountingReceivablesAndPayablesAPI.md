# AccountingReceivablesAndPayablesAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingAccountsPayable**](AccountingReceivablesAndPayablesAPI.md#mobilegetaccountingaccountspayable) | **GET** /accounting/accounts-payable | Consultar cuentas por pagar
[**mobileGetAccountingAccountsReceivable**](AccountingReceivablesAndPayablesAPI.md#mobilegetaccountingaccountsreceivable) | **GET** /accounting/accounts-receivable | Consultar cuentas por cobrar
[**mobileGetAccountingAccountsReceivableMetrics**](AccountingReceivablesAndPayablesAPI.md#mobilegetaccountingaccountsreceivablemetrics) | **GET** /accounting/accounts-receivable/metrics | Consultar métricas de cuentas por cobrar


# **mobileGetAccountingAccountsPayable**
```swift
    open class func mobileGetAccountingAccountsPayable(search: String? = nil, estado: Bool? = nil, tipo: String? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAccountingAccountsPayableResponse?, _ error: Error?) -> Void)
```

Consultar cuentas por pagar

Lista obligaciones con proveedores y muestra saldos, estado y métricas de pago. Permite precisar la consulta mediante texto de búsqueda, estado, tipo, página, límite por página.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let search = "search_example" // String | Texto de búsqueda aplicado por el servicio. (optional)
let estado = true // Bool | Estado usado para filtrar resultados. (optional)
let tipo = "tipo_example" // String | Tipo de registro solicitado. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Consultar cuentas por pagar
AccountingReceivablesAndPayablesAPI.mobileGetAccountingAccountsPayable(search: search, estado: estado, tipo: tipo, page: page, limit: limit) { (response, error) in
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
 **search** | **String** | Texto de búsqueda aplicado por el servicio. | [optional] 
 **estado** | **Bool** | Estado usado para filtrar resultados. | [optional] 
 **tipo** | **String** | Tipo de registro solicitado. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingAccountsPayableResponse**](GetAccountingAccountsPayableResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAccountsReceivable**
```swift
    open class func mobileGetAccountingAccountsReceivable(search: String? = nil, estado: Bool? = nil, clienteId: String? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAccountingAccountsReceivableResponse?, _ error: Error?) -> Void)
```

Consultar cuentas por cobrar

Lista obligaciones de clientes y sus saldos pendientes dentro del tenant. Permite precisar la consulta mediante texto de búsqueda, estado, cliente, página, límite por página.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let search = "search_example" // String | Texto de búsqueda aplicado por el servicio. (optional)
let estado = true // Bool | Estado usado para filtrar resultados. (optional)
let clienteId = "clienteId_example" // String | Identificador del cliente. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Consultar cuentas por cobrar
AccountingReceivablesAndPayablesAPI.mobileGetAccountingAccountsReceivable(search: search, estado: estado, clienteId: clienteId, page: page, limit: limit) { (response, error) in
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
 **search** | **String** | Texto de búsqueda aplicado por el servicio. | [optional] 
 **estado** | **Bool** | Estado usado para filtrar resultados. | [optional] 
 **clienteId** | **String** | Identificador del cliente. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingAccountsReceivableResponse**](GetAccountingAccountsReceivableResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAccountsReceivableMetrics**
```swift
    open class func mobileGetAccountingAccountsReceivableMetrics(completion: @escaping (_ data: GetAccountingAccountsReceivableMetricsResponse?, _ error: Error?) -> Void)
```

Consultar métricas de cuentas por cobrar

Calcula los importes agregados y estados de las cuentas por cobrar.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar métricas de cuentas por cobrar
AccountingReceivablesAndPayablesAPI.mobileGetAccountingAccountsReceivableMetrics() { (response, error) in
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

[**GetAccountingAccountsReceivableMetricsResponse**](GetAccountingAccountsReceivableMetricsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

