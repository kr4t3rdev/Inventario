# AccountingBankingAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingBankAccounts**](AccountingBankingAPI.md#mobilegetaccountingbankaccounts) | **GET** /accounting/bank-accounts | Consultar cuentas bancarias
[**mobileGetAccountingBankAccountsById**](AccountingBankingAPI.md#mobilegetaccountingbankaccountsbyid) | **GET** /accounting/bank-accounts/{id} | Consultar cuentas bancaria
[**mobileGetAccountingBankAccountsByIdNestedHistory**](AccountingBankingAPI.md#mobilegetaccountingbankaccountsbyidnestedhistory) | **GET** /accounting/bank-accounts/{id}/history | Consultar historial de cuentas bancarias
[**mobileGetAccountingBankAdjustments**](AccountingBankingAPI.md#mobilegetaccountingbankadjustments) | **GET** /accounting/bank-adjustments | Consultar ajustes bancarios
[**mobileGetAccountingBankTransfers**](AccountingBankingAPI.md#mobilegetaccountingbanktransfers) | **GET** /accounting/bank-transfers | Consultar transferencias bancarias
[**mobileGetAccountingBankTransfersById**](AccountingBankingAPI.md#mobilegetaccountingbanktransfersbyid) | **GET** /accounting/bank-transfers/{id} | Consultar transferencias bancaria
[**mobileGetAccountingBankTransfersByIdComprobante**](AccountingBankingAPI.md#mobilegetaccountingbanktransfersbyidcomprobante) | **GET** /accounting/bank-transfers/{id}/comprobante | Descargar comprobante de transferencias bancarias
[**mobilePostAccountingBankAdjustments**](AccountingBankingAPI.md#mobilepostaccountingbankadjustments) | **POST** /accounting/bank-adjustments | Registrar ajustes bancarios
[**mobilePostAccountingBankTransfers**](AccountingBankingAPI.md#mobilepostaccountingbanktransfers) | **POST** /accounting/bank-transfers | Registrar transferencias bancarias
[**mobilePostAccountingBankTransfersValidate**](AccountingBankingAPI.md#mobilepostaccountingbanktransfersvalidate) | **POST** /accounting/bank-transfers/validate | Validar transferencia bancaria


# **mobileGetAccountingBankAccounts**
```swift
    open class func mobileGetAccountingBankAccounts(completion: @escaping (_ data: GetAccountingBankAccountsResponse?, _ error: Error?) -> Void)
```

Consultar cuentas bancarias

Lista las cuentas bancarias activas disponibles para operaciones contables.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar cuentas bancarias
AccountingBankingAPI.mobileGetAccountingBankAccounts() { (response, error) in
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

[**GetAccountingBankAccountsResponse**](GetAccountingBankAccountsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankAccountsById**
```swift
    open class func mobileGetAccountingBankAccountsById(id: String, completion: @escaping (_ data: GetAccountingBankAccountsIdResponse?, _ error: Error?) -> Void)
```

Consultar cuentas bancaria

Devuelve datos, saldo y moneda de la cuenta bancaria identificada.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Consultar cuentas bancaria
AccountingBankingAPI.mobileGetAccountingBankAccountsById(id: id) { (response, error) in
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

[**GetAccountingBankAccountsIdResponse**](GetAccountingBankAccountsIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankAccountsByIdNestedHistory**
```swift
    open class func mobileGetAccountingBankAccountsByIdNestedHistory(id: String, fechaInicio: Date? = nil, fechaFin: Date? = nil, tipoMovimiento: String? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAccountingBankAccountsIdHistoryResponse?, _ error: Error?) -> Void)
```

Consultar historial de cuentas bancarias

Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let tipoMovimiento = "tipoMovimiento_example" // String | Valor de tipoMovimiento aceptado por el handler. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Consultar historial de cuentas bancarias
AccountingBankingAPI.mobileGetAccountingBankAccountsByIdNestedHistory(id: id, fechaInicio: fechaInicio, fechaFin: fechaFin, tipoMovimiento: tipoMovimiento, page: page, limit: limit) { (response, error) in
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
 **fechaInicio** | **Date** | Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **Date** | Fin inclusivo del período consultado. | [optional] 
 **tipoMovimiento** | **String** | Valor de tipoMovimiento aceptado por el handler. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingBankAccountsIdHistoryResponse**](GetAccountingBankAccountsIdHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankAdjustments**
```swift
    open class func mobileGetAccountingBankAdjustments(cuentaId: String? = nil, tipo: String? = nil, fechaInicio: Date? = nil, fechaFin: Date? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAccountingBankAdjustmentsResponse?, _ error: Error?) -> Void)
```

Consultar ajustes bancarios

Lista ingresos y egresos manuales registrados sobre cuentas bancarias. Permite precisar la consulta mediante cuenta bancaria, tipo, fecha inicial, fecha final, página, límite por página.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)
let tipo = "tipo_example" // String | Tipo de registro solicitado. (optional)
let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Consultar ajustes bancarios
AccountingBankingAPI.mobileGetAccountingBankAdjustments(cuentaId: cuentaId, tipo: tipo, fechaInicio: fechaInicio, fechaFin: fechaFin, page: page, limit: limit) { (response, error) in
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
 **cuentaId** | **String** | Identificador de la cuenta bancaria. | [optional] 
 **tipo** | **String** | Tipo de registro solicitado. | [optional] 
 **fechaInicio** | **Date** | Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **Date** | Fin inclusivo del período consultado. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingBankAdjustmentsResponse**](GetAccountingBankAdjustmentsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankTransfers**
```swift
    open class func mobileGetAccountingBankTransfers(fechaInicio: Date? = nil, fechaFin: Date? = nil, cuentaId: String? = nil, completion: @escaping (_ data: GetAccountingBankTransfersResponse?, _ error: Error?) -> Void)
```

Consultar transferencias bancarias

Lista transferencias entre cuentas con importes de origen, destino y tasa aplicada. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)

// Consultar transferencias bancarias
AccountingBankingAPI.mobileGetAccountingBankTransfers(fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaId: cuentaId) { (response, error) in
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
 **fechaInicio** | **Date** | Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **Date** | Fin inclusivo del período consultado. | [optional] 
 **cuentaId** | **String** | Identificador de la cuenta bancaria. | [optional] 

### Return type

[**GetAccountingBankTransfersResponse**](GetAccountingBankTransfersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankTransfersById**
```swift
    open class func mobileGetAccountingBankTransfersById(id: String, completion: @escaping (_ data: GetAccountingBankTransfersIdResponse?, _ error: Error?) -> Void)
```

Consultar transferencias bancaria

Devuelve importes, cuentas, moneda, tasa y comprobante de la transferencia identificada.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Consultar transferencias bancaria
AccountingBankingAPI.mobileGetAccountingBankTransfersById(id: id) { (response, error) in
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

[**GetAccountingBankTransfersIdResponse**](GetAccountingBankTransfersIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingBankTransfersByIdComprobante**
```swift
    open class func mobileGetAccountingBankTransfersByIdComprobante(id: String, completion: @escaping (_ data: URL?, _ error: Error?) -> Void)
```

Descargar comprobante de transferencias bancarias

Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Descargar comprobante de transferencias bancarias
AccountingBankingAPI.mobileGetAccountingBankTransfersByIdComprobante(id: id) { (response, error) in
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

# **mobilePostAccountingBankAdjustments**
```swift
    open class func mobilePostAccountingBankAdjustments(bankAdjustmentRequest: BankAdjustmentRequest, cuentaId: String? = nil, tipo: String? = nil, fechaInicio: Date? = nil, fechaFin: Date? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: PostAccountingBankAdjustmentsResponse?, _ error: Error?) -> Void)
```

Registrar ajustes bancarios

Registra un ingreso o egreso manual y actualiza el saldo de la cuenta bancaria seleccionada.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let bankAdjustmentRequest = BankAdjustmentRequest(cuentaId: "cuentaId_example", tipo: "tipo_example", monto: 123, moneda: "moneda_example", descripcion: "descripcion_example", motivo: "motivo_example") // BankAdjustmentRequest | 
let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)
let tipo = "tipo_example" // String | Tipo de registro solicitado. (optional)
let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Registrar ajustes bancarios
AccountingBankingAPI.mobilePostAccountingBankAdjustments(bankAdjustmentRequest: bankAdjustmentRequest, cuentaId: cuentaId, tipo: tipo, fechaInicio: fechaInicio, fechaFin: fechaFin, page: page, limit: limit) { (response, error) in
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
 **bankAdjustmentRequest** | [**BankAdjustmentRequest**](BankAdjustmentRequest.md) |  | 
 **cuentaId** | **String** | Identificador de la cuenta bancaria. | [optional] 
 **tipo** | **String** | Tipo de registro solicitado. | [optional] 
 **fechaInicio** | **Date** | Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **Date** | Fin inclusivo del período consultado. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingBankAdjustmentsResponse**](PostAccountingBankAdjustmentsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingBankTransfers**
```swift
    open class func mobilePostAccountingBankTransfers(bankTransferCreateRequest: BankTransferCreateRequest, fechaInicio: Date? = nil, fechaFin: Date? = nil, cuentaId: String? = nil, completion: @escaping (_ data: PostAccountingBankTransfersResponse?, _ error: Error?) -> Void)
```

Registrar transferencias bancarias

Transfiere fondos entre dos cuentas, aplicando conversión cuando las monedas son diferentes.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let bankTransferCreateRequest = BankTransferCreateRequest(cuentaOrigenId: "cuentaOrigenId_example", cuentaDestinoId: "cuentaDestinoId_example", montoOrigen: 123, montoDestino: 123, motivo: "motivo_example", descripcion: "descripcion_example", tasaCambio: 123, monedaPrincipal: "monedaPrincipal_example") // BankTransferCreateRequest | 
let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)

// Registrar transferencias bancarias
AccountingBankingAPI.mobilePostAccountingBankTransfers(bankTransferCreateRequest: bankTransferCreateRequest, fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaId: cuentaId) { (response, error) in
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
 **bankTransferCreateRequest** | [**BankTransferCreateRequest**](BankTransferCreateRequest.md) |  | 
 **fechaInicio** | **Date** | Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **Date** | Fin inclusivo del período consultado. | [optional] 
 **cuentaId** | **String** | Identificador de la cuenta bancaria. | [optional] 

### Return type

[**PostAccountingBankTransfersResponse**](PostAccountingBankTransfersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingBankTransfersValidate**
```swift
    open class func mobilePostAccountingBankTransfersValidate(bankTransferValidationRequest: BankTransferValidationRequest, completion: @escaping (_ data: PostAccountingBankTransfersValidateResponse?, _ error: Error?) -> Void)
```

Validar transferencia bancaria

Comprueba cuentas, monedas, saldo e importes antes de registrar una transferencia.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let bankTransferValidationRequest = BankTransferValidationRequest(cuentaOrigenId: "cuentaOrigenId_example", cuentaDestinoId: "cuentaDestinoId_example", monto: 123, motivo: "motivo_example", descripcion: "descripcion_example") // BankTransferValidationRequest | 

// Validar transferencia bancaria
AccountingBankingAPI.mobilePostAccountingBankTransfersValidate(bankTransferValidationRequest: bankTransferValidationRequest) { (response, error) in
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
 **bankTransferValidationRequest** | [**BankTransferValidationRequest**](BankTransferValidationRequest.md) |  | 

### Return type

[**PostAccountingBankTransfersValidateResponse**](PostAccountingBankTransfersValidateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

