# AccountingCashFinancingAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingCashDebts**](AccountingCashFinancingAPI.md#mobilegetaccountingcashdebts) | **GET** /accounting/cash-debts | Consultar deudas de efectivo
[**mobileGetAccountingCashDebtsById**](AccountingCashFinancingAPI.md#mobilegetaccountingcashdebtsbyid) | **GET** /accounting/cash-debts/{id} | Consultar deudas de efectivo
[**mobileGetAccountingCashDebtsStats**](AccountingCashFinancingAPI.md#mobilegetaccountingcashdebtsstats) | **GET** /accounting/cash-debts/stats | Consultar indicadores de deudas de efectivo
[**mobileGetAccountingCashLoans**](AccountingCashFinancingAPI.md#mobilegetaccountingcashloans) | **GET** /accounting/cash-loans | Consultar préstamos de efectivo
[**mobileGetAccountingCashLoansById**](AccountingCashFinancingAPI.md#mobilegetaccountingcashloansbyid) | **GET** /accounting/cash-loans/{id} | Consultar préstamos de efectivo
[**mobileGetAccountingCashLoansByIdComprobante**](AccountingCashFinancingAPI.md#mobilegetaccountingcashloansbyidcomprobante) | **GET** /accounting/cash-loans/{id}/comprobante | Descargar comprobante de préstamos de efectivo
[**mobileGetAccountingCashLoansByIdNestedHistory**](AccountingCashFinancingAPI.md#mobilegetaccountingcashloansbyidnestedhistory) | **GET** /accounting/cash-loans/{id}/history | Consultar historial de préstamos de efectivo
[**mobileGetAccountingCashLoansStats**](AccountingCashFinancingAPI.md#mobilegetaccountingcashloansstats) | **GET** /accounting/cash-loans/stats | Consultar indicadores de préstamos de efectivo
[**mobilePostAccountingCashDebts**](AccountingCashFinancingAPI.md#mobilepostaccountingcashdebts) | **POST** /accounting/cash-debts | Registrar deudas de efectivo
[**mobilePostAccountingCashDebtsByIdPayments**](AccountingCashFinancingAPI.md#mobilepostaccountingcashdebtsbyidpayments) | **POST** /accounting/cash-debts/{id}/payments | Registrar pago de deudas de efectivo
[**mobilePostAccountingCashLoans**](AccountingCashFinancingAPI.md#mobilepostaccountingcashloans) | **POST** /accounting/cash-loans | Registrar préstamos de efectivo
[**mobilePostAccountingCashLoansByIdPayments**](AccountingCashFinancingAPI.md#mobilepostaccountingcashloansbyidpayments) | **POST** /accounting/cash-loans/{id}/payments | Registrar pago de préstamos de efectivo
[**mobilePutAccountingCashDebtsById**](AccountingCashFinancingAPI.md#mobileputaccountingcashdebtsbyid) | **PUT** /accounting/cash-debts/{id} | Actualizar deudas de efectivo
[**mobilePutAccountingCashLoansById**](AccountingCashFinancingAPI.md#mobileputaccountingcashloansbyid) | **PUT** /accounting/cash-loans/{id} | Actualizar préstamos de efectivo


# **mobileGetAccountingCashDebts**
```swift
    open class func mobileGetAccountingCashDebts(estado: Bool? = nil, proveedorId: String? = nil, moneda: String? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAccountingCashDebtsResponse?, _ error: Error?) -> Void)
```

Consultar deudas de efectivo

Lista deudas de efectivo con proveedores, sus vencimientos y saldos. Permite precisar la consulta mediante estado, proveedor, moneda, página, límite por página.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let estado = true // Bool | Estado usado para filtrar resultados. (optional)
let proveedorId = "proveedorId_example" // String | Identificador del proveedor. (optional)
let moneda = "moneda_example" // String | Código de moneda. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Consultar deudas de efectivo
AccountingCashFinancingAPI.mobileGetAccountingCashDebts(estado: estado, proveedorId: proveedorId, moneda: moneda, page: page, limit: limit) { (response, error) in
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
 **estado** | **Bool** | Estado usado para filtrar resultados. | [optional] 
 **proveedorId** | **String** | Identificador del proveedor. | [optional] 
 **moneda** | **String** | Código de moneda. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingCashDebtsResponse**](GetAccountingCashDebtsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashDebtsById**
```swift
    open class func mobileGetAccountingCashDebtsById(id: String, completion: @escaping (_ data: GetAccountingCashDebtsIdResponse?, _ error: Error?) -> Void)
```

Consultar deudas de efectivo

Devuelve la deuda identificada con proveedor, cuenta por pagar y pagos relacionados.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Consultar deudas de efectivo
AccountingCashFinancingAPI.mobileGetAccountingCashDebtsById(id: id) { (response, error) in
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

[**GetAccountingCashDebtsIdResponse**](GetAccountingCashDebtsIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashDebtsStats**
```swift
    open class func mobileGetAccountingCashDebtsStats(completion: @escaping (_ data: GetAccountingCashDebtsStatsResponse?, _ error: Error?) -> Void)
```

Consultar indicadores de deudas de efectivo

Calcula cantidad, capital y saldo pendiente de las deudas de efectivo.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar indicadores de deudas de efectivo
AccountingCashFinancingAPI.mobileGetAccountingCashDebtsStats() { (response, error) in
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

[**GetAccountingCashDebtsStatsResponse**](GetAccountingCashDebtsStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashLoans**
```swift
    open class func mobileGetAccountingCashLoans(estado: Bool? = nil, clienteId: String? = nil, moneda: String? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAccountingCashLoansResponse?, _ error: Error?) -> Void)
```

Consultar préstamos de efectivo

Lista préstamos de efectivo otorgados a clientes, con vencimientos y saldos. Permite precisar la consulta mediante estado, cliente, moneda, página, límite por página.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let estado = true // Bool | Estado usado para filtrar resultados. (optional)
let clienteId = "clienteId_example" // String | Identificador del cliente. (optional)
let moneda = "moneda_example" // String | Código de moneda. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Consultar préstamos de efectivo
AccountingCashFinancingAPI.mobileGetAccountingCashLoans(estado: estado, clienteId: clienteId, moneda: moneda, page: page, limit: limit) { (response, error) in
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
 **estado** | **Bool** | Estado usado para filtrar resultados. | [optional] 
 **clienteId** | **String** | Identificador del cliente. | [optional] 
 **moneda** | **String** | Código de moneda. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingCashLoansResponse**](GetAccountingCashLoansResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashLoansById**
```swift
    open class func mobileGetAccountingCashLoansById(id: String, completion: @escaping (_ data: GetAccountingCashLoansIdResponse?, _ error: Error?) -> Void)
```

Consultar préstamos de efectivo

Devuelve el préstamo identificado con cliente, cuenta por cobrar y pagos relacionados.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Consultar préstamos de efectivo
AccountingCashFinancingAPI.mobileGetAccountingCashLoansById(id: id) { (response, error) in
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

[**GetAccountingCashLoansIdResponse**](GetAccountingCashLoansIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashLoansByIdComprobante**
```swift
    open class func mobileGetAccountingCashLoansByIdComprobante(id: String, completion: @escaping (_ data: URL?, _ error: Error?) -> Void)
```

Descargar comprobante de préstamos de efectivo

Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Descargar comprobante de préstamos de efectivo
AccountingCashFinancingAPI.mobileGetAccountingCashLoansByIdComprobante(id: id) { (response, error) in
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

**URL**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/pdf, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashLoansByIdNestedHistory**
```swift
    open class func mobileGetAccountingCashLoansByIdNestedHistory(id: String, completion: @escaping (_ data: GetAccountingCashLoansIdHistoryResponse?, _ error: Error?) -> Void)
```

Consultar historial de préstamos de efectivo

Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Consultar historial de préstamos de efectivo
AccountingCashFinancingAPI.mobileGetAccountingCashLoansByIdNestedHistory(id: id) { (response, error) in
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

[**GetAccountingCashLoansIdHistoryResponse**](GetAccountingCashLoansIdHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingCashLoansStats**
```swift
    open class func mobileGetAccountingCashLoansStats(completion: @escaping (_ data: GetAccountingCashLoansStatsResponse?, _ error: Error?) -> Void)
```

Consultar indicadores de préstamos de efectivo

Calcula cantidad, capital y saldo pendiente de los préstamos de efectivo.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar indicadores de préstamos de efectivo
AccountingCashFinancingAPI.mobileGetAccountingCashLoansStats() { (response, error) in
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

[**GetAccountingCashLoansStatsResponse**](GetAccountingCashLoansStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCashDebts**
```swift
    open class func mobilePostAccountingCashDebts(cashDebtCreateRequest: CashDebtCreateRequest, estado: Bool? = nil, proveedorId: String? = nil, moneda: String? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: PostAccountingCashDebtsResponse?, _ error: Error?) -> Void)
```

Registrar deudas de efectivo

Registra financiamiento recibido de un proveedor, incrementa la cuenta bancaria y crea la cuenta por pagar.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let cashDebtCreateRequest = CashDebtCreateRequest(proveedorId: "proveedorId_example", montoCapital: 123, moneda: "moneda_example", tasaInteres: 123, fechaVencimiento: Date(), observaciones: "observaciones_example", comprobanteUrl: "comprobanteUrl_example", cuentaBancariaId: "cuentaBancariaId_example") // CashDebtCreateRequest | 
let estado = true // Bool | Estado usado para filtrar resultados. (optional)
let proveedorId = "proveedorId_example" // String | Identificador del proveedor. (optional)
let moneda = "moneda_example" // String | Código de moneda. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Registrar deudas de efectivo
AccountingCashFinancingAPI.mobilePostAccountingCashDebts(cashDebtCreateRequest: cashDebtCreateRequest, estado: estado, proveedorId: proveedorId, moneda: moneda, page: page, limit: limit) { (response, error) in
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
 **cashDebtCreateRequest** | [**CashDebtCreateRequest**](CashDebtCreateRequest.md) |  | 
 **estado** | **Bool** | Estado usado para filtrar resultados. | [optional] 
 **proveedorId** | **String** | Identificador del proveedor. | [optional] 
 **moneda** | **String** | Código de moneda. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingCashDebtsResponse**](PostAccountingCashDebtsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCashDebtsByIdPayments**
```swift
    open class func mobilePostAccountingCashDebtsByIdPayments(id: String, cashPaymentRequest: CashPaymentRequest, completion: @escaping (_ data: PostAccountingCashDebtsIdPaymentsResponse?, _ error: Error?) -> Void)
```

Registrar pago de deudas de efectivo

Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let cashPaymentRequest = CashPaymentRequest(monto: 123, cuentaId: "cuentaId_example", tipoPagoId: "tipoPagoId_example", moneda: "moneda_example", tasaCambio: 123, observaciones: "observaciones_example") // CashPaymentRequest | 

// Registrar pago de deudas de efectivo
AccountingCashFinancingAPI.mobilePostAccountingCashDebtsByIdPayments(id: id, cashPaymentRequest: cashPaymentRequest) { (response, error) in
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
 **cashPaymentRequest** | [**CashPaymentRequest**](CashPaymentRequest.md) |  | 

### Return type

[**PostAccountingCashDebtsIdPaymentsResponse**](PostAccountingCashDebtsIdPaymentsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCashLoans**
```swift
    open class func mobilePostAccountingCashLoans(cashLoanCreateRequest: CashLoanCreateRequest, estado: Bool? = nil, clienteId: String? = nil, moneda: String? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: PostAccountingCashLoansResponse?, _ error: Error?) -> Void)
```

Registrar préstamos de efectivo

Registra un préstamo a un cliente, descuenta fondos de la cuenta bancaria y crea la cuenta por cobrar.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let cashLoanCreateRequest = CashLoanCreateRequest(clienteId: "clienteId_example", montoCapital: 123, moneda: "moneda_example", tasaInteres: 123, tasaCambioAlCrear: 123, fechaVencimiento: Date(), observaciones: "observaciones_example", cuentaBancariaId: "cuentaBancariaId_example") // CashLoanCreateRequest | 
let estado = true // Bool | Estado usado para filtrar resultados. (optional)
let clienteId = "clienteId_example" // String | Identificador del cliente. (optional)
let moneda = "moneda_example" // String | Código de moneda. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Registrar préstamos de efectivo
AccountingCashFinancingAPI.mobilePostAccountingCashLoans(cashLoanCreateRequest: cashLoanCreateRequest, estado: estado, clienteId: clienteId, moneda: moneda, page: page, limit: limit) { (response, error) in
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
 **cashLoanCreateRequest** | [**CashLoanCreateRequest**](CashLoanCreateRequest.md) |  | 
 **estado** | **Bool** | Estado usado para filtrar resultados. | [optional] 
 **clienteId** | **String** | Identificador del cliente. | [optional] 
 **moneda** | **String** | Código de moneda. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingCashLoansResponse**](PostAccountingCashLoansResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingCashLoansByIdPayments**
```swift
    open class func mobilePostAccountingCashLoansByIdPayments(id: String, cashPaymentRequest: CashPaymentRequest, completion: @escaping (_ data: PostAccountingCashLoansIdPaymentsResponse?, _ error: Error?) -> Void)
```

Registrar pago de préstamos de efectivo

Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let cashPaymentRequest = CashPaymentRequest(monto: 123, cuentaId: "cuentaId_example", tipoPagoId: "tipoPagoId_example", moneda: "moneda_example", tasaCambio: 123, observaciones: "observaciones_example") // CashPaymentRequest | 

// Registrar pago de préstamos de efectivo
AccountingCashFinancingAPI.mobilePostAccountingCashLoansByIdPayments(id: id, cashPaymentRequest: cashPaymentRequest) { (response, error) in
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
 **cashPaymentRequest** | [**CashPaymentRequest**](CashPaymentRequest.md) |  | 

### Return type

[**PostAccountingCashLoansIdPaymentsResponse**](PostAccountingCashLoansIdPaymentsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutAccountingCashDebtsById**
```swift
    open class func mobilePutAccountingCashDebtsById(id: String, cashOperationUpdateRequest: CashOperationUpdateRequest, completion: @escaping (_ data: PutAccountingCashDebtsIdResponse?, _ error: Error?) -> Void)
```

Actualizar deudas de efectivo

Actualiza vencimiento, tasa de interés u observaciones de la deuda identificada.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let cashOperationUpdateRequest = CashOperationUpdateRequest(fechaVencimiento: Date(), tasaInteres: 123, observaciones: "observaciones_example") // CashOperationUpdateRequest | 

// Actualizar deudas de efectivo
AccountingCashFinancingAPI.mobilePutAccountingCashDebtsById(id: id, cashOperationUpdateRequest: cashOperationUpdateRequest) { (response, error) in
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
 **cashOperationUpdateRequest** | [**CashOperationUpdateRequest**](CashOperationUpdateRequest.md) |  | 

### Return type

[**PutAccountingCashDebtsIdResponse**](PutAccountingCashDebtsIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutAccountingCashLoansById**
```swift
    open class func mobilePutAccountingCashLoansById(id: String, cashOperationUpdateRequest: CashOperationUpdateRequest, completion: @escaping (_ data: PutAccountingCashLoansIdResponse?, _ error: Error?) -> Void)
```

Actualizar préstamos de efectivo

Actualiza vencimiento, tasa de interés u observaciones del préstamo identificado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let cashOperationUpdateRequest = CashOperationUpdateRequest(fechaVencimiento: Date(), tasaInteres: 123, observaciones: "observaciones_example") // CashOperationUpdateRequest | 

// Actualizar préstamos de efectivo
AccountingCashFinancingAPI.mobilePutAccountingCashLoansById(id: id, cashOperationUpdateRequest: cashOperationUpdateRequest) { (response, error) in
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
 **cashOperationUpdateRequest** | [**CashOperationUpdateRequest**](CashOperationUpdateRequest.md) |  | 

### Return type

[**PutAccountingCashLoansIdResponse**](PutAccountingCashLoansIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

