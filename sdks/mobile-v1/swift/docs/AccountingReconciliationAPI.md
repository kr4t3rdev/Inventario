# AccountingReconciliationAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingReconciliationExpenses**](AccountingReconciliationAPI.md#mobilegetaccountingreconciliationexpenses) | **GET** /accounting/reconciliation/expenses | Consultar conciliación de gastos
[**mobileGetAccountingReconciliationExpensesHistory**](AccountingReconciliationAPI.md#mobilegetaccountingreconciliationexpenseshistory) | **GET** /accounting/reconciliation/expenses-history | Consultar historial de conciliaciones de gastos
[**mobileGetAccountingReconciliationExpensesNestedHistory**](AccountingReconciliationAPI.md#mobilegetaccountingreconciliationexpensesnestedhistory) | **GET** /accounting/reconciliation/expenses/history | Consultar historial paginado de conciliaciones de gastos
[**mobileGetAccountingReconciliationSales**](AccountingReconciliationAPI.md#mobilegetaccountingreconciliationsales) | **GET** /accounting/reconciliation/sales | Consultar conciliación de ventas
[**mobileGetAccountingReconciliationSalesHistory**](AccountingReconciliationAPI.md#mobilegetaccountingreconciliationsaleshistory) | **GET** /accounting/reconciliation/sales-history | Consultar historial de conciliaciones de ventas
[**mobileGetAccountingReconciliationSalesNestedHistory**](AccountingReconciliationAPI.md#mobilegetaccountingreconciliationsalesnestedhistory) | **GET** /accounting/reconciliation/sales/history | Consultar historial paginado de conciliaciones de ventas
[**mobileGetAccountingReconciliationServices**](AccountingReconciliationAPI.md#mobilegetaccountingreconciliationservices) | **GET** /accounting/reconciliation/services | Consultar conciliación de servicios
[**mobileGetAccountingReconciliationServicesHistory**](AccountingReconciliationAPI.md#mobilegetaccountingreconciliationserviceshistory) | **GET** /accounting/reconciliation/services-history | Consultar historial de conciliaciones de servicios
[**mobileGetAccountingReconciliationServicesNestedHistory**](AccountingReconciliationAPI.md#mobilegetaccountingreconciliationservicesnestedhistory) | **GET** /accounting/reconciliation/services/history | Consultar historial paginado de conciliaciones de servicios
[**mobileGetAccountingReconciliationStats**](AccountingReconciliationAPI.md#mobilegetaccountingreconciliationstats) | **GET** /accounting/reconciliation/stats | Consultar panel de conciliaciones
[**mobilePostAccountingReconciliationExpenses**](AccountingReconciliationAPI.md#mobilepostaccountingreconciliationexpenses) | **POST** /accounting/reconciliation/expenses | Registrar conciliación de gastos
[**mobilePostAccountingReconciliationSales**](AccountingReconciliationAPI.md#mobilepostaccountingreconciliationsales) | **POST** /accounting/reconciliation/sales | Registrar conciliación de ventas
[**mobilePostAccountingReconciliationServices**](AccountingReconciliationAPI.md#mobilepostaccountingreconciliationservices) | **POST** /accounting/reconciliation/services | Registrar conciliación de servicios


# **mobileGetAccountingReconciliationExpenses**
```swift
    open class func mobileGetAccountingReconciliationExpenses(tipoGasto: String? = nil, fechaDesde: Date? = nil, fechaHasta: Date? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAccountingReconciliationExpensesResponse?, _ error: Error?) -> Void)
```

Consultar conciliación de gastos

Lista gastos pendientes de conciliación bancaria. Permite precisar la consulta mediante tipoGasto, fecha inicial, fecha final, página, límite por página.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let tipoGasto = "tipoGasto_example" // String | Valor de tipoGasto aceptado por el handler. (optional)
let fechaDesde = Date() // Date | Valor de fechaDesde aceptado por el handler. (optional)
let fechaHasta = Date() // Date | Valor de fechaHasta aceptado por el handler. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Consultar conciliación de gastos
AccountingReconciliationAPI.mobileGetAccountingReconciliationExpenses(tipoGasto: tipoGasto, fechaDesde: fechaDesde, fechaHasta: fechaHasta, page: page, limit: limit) { (response, error) in
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
 **tipoGasto** | **String** | Valor de tipoGasto aceptado por el handler. | [optional] 
 **fechaDesde** | **Date** | Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **Date** | Valor de fechaHasta aceptado por el handler. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingReconciliationExpensesResponse**](GetAccountingReconciliationExpensesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationExpensesHistory**
```swift
    open class func mobileGetAccountingReconciliationExpensesHistory(tipoGasto: String? = nil, cuentaId: String? = nil, fechaDesde: Date? = nil, fechaHasta: Date? = nil, periodo: String? = nil, reconciliadoPor: String? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAccountingReconciliationExpensesHistoryResponse?, _ error: Error?) -> Void)
```

Consultar historial de conciliaciones de gastos

Devuelve el historial completo de conciliaciones de gastos. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let tipoGasto = "tipoGasto_example" // String | Valor de tipoGasto aceptado por el handler. (optional)
let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)
let fechaDesde = Date() // Date | Valor de fechaDesde aceptado por el handler. (optional)
let fechaHasta = Date() // Date | Valor de fechaHasta aceptado por el handler. (optional)
let periodo = "periodo_example" // String | Valor de periodo aceptado por el handler. (optional)
let reconciliadoPor = "reconciliadoPor_example" // String | Valor de reconciliadoPor aceptado por el handler. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Consultar historial de conciliaciones de gastos
AccountingReconciliationAPI.mobileGetAccountingReconciliationExpensesHistory(tipoGasto: tipoGasto, cuentaId: cuentaId, fechaDesde: fechaDesde, fechaHasta: fechaHasta, periodo: periodo, reconciliadoPor: reconciliadoPor, page: page, limit: limit) { (response, error) in
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
 **tipoGasto** | **String** | Valor de tipoGasto aceptado por el handler. | [optional] 
 **cuentaId** | **String** | Identificador de la cuenta bancaria. | [optional] 
 **fechaDesde** | **Date** | Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **Date** | Valor de fechaHasta aceptado por el handler. | [optional] 
 **periodo** | **String** | Valor de periodo aceptado por el handler. | [optional] 
 **reconciliadoPor** | **String** | Valor de reconciliadoPor aceptado por el handler. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingReconciliationExpensesHistoryResponse**](GetAccountingReconciliationExpensesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationExpensesNestedHistory**
```swift
    open class func mobileGetAccountingReconciliationExpensesNestedHistory(tipoGasto: String? = nil, cuentaId: String? = nil, fechaDesde: Date? = nil, fechaHasta: Date? = nil, periodo: String? = nil, reconciliadoPor: String? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAccountingReconciliationExpensesHistoryResponse?, _ error: Error?) -> Void)
```

Consultar historial paginado de conciliaciones de gastos

Devuelve conciliaciones de gastos con estadísticas y control de página. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let tipoGasto = "tipoGasto_example" // String | Valor de tipoGasto aceptado por el handler. (optional)
let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)
let fechaDesde = Date() // Date | Valor de fechaDesde aceptado por el handler. (optional)
let fechaHasta = Date() // Date | Valor de fechaHasta aceptado por el handler. (optional)
let periodo = "periodo_example" // String | Valor de periodo aceptado por el handler. (optional)
let reconciliadoPor = "reconciliadoPor_example" // String | Valor de reconciliadoPor aceptado por el handler. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Consultar historial paginado de conciliaciones de gastos
AccountingReconciliationAPI.mobileGetAccountingReconciliationExpensesNestedHistory(tipoGasto: tipoGasto, cuentaId: cuentaId, fechaDesde: fechaDesde, fechaHasta: fechaHasta, periodo: periodo, reconciliadoPor: reconciliadoPor, page: page, limit: limit) { (response, error) in
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
 **tipoGasto** | **String** | Valor de tipoGasto aceptado por el handler. | [optional] 
 **cuentaId** | **String** | Identificador de la cuenta bancaria. | [optional] 
 **fechaDesde** | **Date** | Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **Date** | Valor de fechaHasta aceptado por el handler. | [optional] 
 **periodo** | **String** | Valor de periodo aceptado por el handler. | [optional] 
 **reconciliadoPor** | **String** | Valor de reconciliadoPor aceptado por el handler. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingReconciliationExpensesHistoryResponse**](GetAccountingReconciliationExpensesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationSales**
```swift
    open class func mobileGetAccountingReconciliationSales(fechaInicio: Date? = nil, fechaFin: Date? = nil, puntoDeVentaId: String? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAccountingReconciliationSalesResponse?, _ error: Error?) -> Void)
```

Consultar conciliación de ventas

Lista ventas que todavía no tienen conciliación bancaria. Permite precisar la consulta mediante fecha inicial, fecha final, punto de venta, página, límite por página.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let puntoDeVentaId = "puntoDeVentaId_example" // String | Valor de puntoDeVentaId aceptado por el handler. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Consultar conciliación de ventas
AccountingReconciliationAPI.mobileGetAccountingReconciliationSales(fechaInicio: fechaInicio, fechaFin: fechaFin, puntoDeVentaId: puntoDeVentaId, page: page, limit: limit) { (response, error) in
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
 **puntoDeVentaId** | **String** | Valor de puntoDeVentaId aceptado por el handler. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingReconciliationSalesResponse**](GetAccountingReconciliationSalesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationSalesHistory**
```swift
    open class func mobileGetAccountingReconciliationSalesHistory(fechaDesde: Date? = nil, fechaInicio: Date? = nil, fechaHasta: Date? = nil, fechaFin: Date? = nil, cuentaId: String? = nil, completion: @escaping (_ data: GetAccountingReconciliationSalesHistoryResponse?, _ error: Error?) -> Void)
```

Consultar historial de conciliaciones de ventas

Devuelve el historial completo de conciliaciones de ventas. Permite precisar la consulta mediante fecha inicial, fecha inicial, fecha final, fecha final, cuenta bancaria.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let fechaDesde = Date() // Date | Valor de fechaDesde aceptado por el handler. (optional)
let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaHasta = Date() // Date | Valor de fechaHasta aceptado por el handler. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)

// Consultar historial de conciliaciones de ventas
AccountingReconciliationAPI.mobileGetAccountingReconciliationSalesHistory(fechaDesde: fechaDesde, fechaInicio: fechaInicio, fechaHasta: fechaHasta, fechaFin: fechaFin, cuentaId: cuentaId) { (response, error) in
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
 **fechaDesde** | **Date** | Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaInicio** | **Date** | Inicio inclusivo del período consultado. | [optional] 
 **fechaHasta** | **Date** | Valor de fechaHasta aceptado por el handler. | [optional] 
 **fechaFin** | **Date** | Fin inclusivo del período consultado. | [optional] 
 **cuentaId** | **String** | Identificador de la cuenta bancaria. | [optional] 

### Return type

[**GetAccountingReconciliationSalesHistoryResponse**](GetAccountingReconciliationSalesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationSalesNestedHistory**
```swift
    open class func mobileGetAccountingReconciliationSalesNestedHistory(fechaInicio: Date? = nil, fechaFin: Date? = nil, cuentaId: String? = nil, completion: @escaping (_ data: GetAccountingReconciliationSalesHistoryResponse?, _ error: Error?) -> Void)
```

Consultar historial paginado de conciliaciones de ventas

Devuelve conciliaciones de ventas con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)

// Consultar historial paginado de conciliaciones de ventas
AccountingReconciliationAPI.mobileGetAccountingReconciliationSalesNestedHistory(fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaId: cuentaId) { (response, error) in
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

[**GetAccountingReconciliationSalesHistoryResponse**](GetAccountingReconciliationSalesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationServices**
```swift
    open class func mobileGetAccountingReconciliationServices(fechaDesde: Date? = nil, fechaHasta: Date? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: GetAccountingReconciliationServicesResponse?, _ error: Error?) -> Void)
```

Consultar conciliación de servicios

Lista servicios vendidos pendientes de distribuir entre cuentas bancarias. Permite precisar la consulta mediante fecha inicial, fecha final, página, límite por página.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let fechaDesde = Date() // Date | Valor de fechaDesde aceptado por el handler. (optional)
let fechaHasta = Date() // Date | Valor de fechaHasta aceptado por el handler. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Consultar conciliación de servicios
AccountingReconciliationAPI.mobileGetAccountingReconciliationServices(fechaDesde: fechaDesde, fechaHasta: fechaHasta, page: page, limit: limit) { (response, error) in
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
 **fechaDesde** | **Date** | Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **Date** | Valor de fechaHasta aceptado por el handler. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**GetAccountingReconciliationServicesResponse**](GetAccountingReconciliationServicesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationServicesHistory**
```swift
    open class func mobileGetAccountingReconciliationServicesHistory(fechaDesde: Date? = nil, fechaHasta: Date? = nil, cuentaId: String? = nil, completion: @escaping (_ data: GetAccountingReconciliationServicesHistoryResponse?, _ error: Error?) -> Void)
```

Consultar historial de conciliaciones de servicios

Devuelve el historial completo de conciliaciones de servicios. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let fechaDesde = Date() // Date | Valor de fechaDesde aceptado por el handler. (optional)
let fechaHasta = Date() // Date | Valor de fechaHasta aceptado por el handler. (optional)
let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)

// Consultar historial de conciliaciones de servicios
AccountingReconciliationAPI.mobileGetAccountingReconciliationServicesHistory(fechaDesde: fechaDesde, fechaHasta: fechaHasta, cuentaId: cuentaId) { (response, error) in
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
 **fechaDesde** | **Date** | Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **Date** | Valor de fechaHasta aceptado por el handler. | [optional] 
 **cuentaId** | **String** | Identificador de la cuenta bancaria. | [optional] 

### Return type

[**GetAccountingReconciliationServicesHistoryResponse**](GetAccountingReconciliationServicesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationServicesNestedHistory**
```swift
    open class func mobileGetAccountingReconciliationServicesNestedHistory(fechaDesde: Date? = nil, fechaHasta: Date? = nil, cuentaId: String? = nil, completion: @escaping (_ data: GetAccountingReconciliationServicesHistoryResponse?, _ error: Error?) -> Void)
```

Consultar historial paginado de conciliaciones de servicios

Devuelve conciliaciones de servicios con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let fechaDesde = Date() // Date | Valor de fechaDesde aceptado por el handler. (optional)
let fechaHasta = Date() // Date | Valor de fechaHasta aceptado por el handler. (optional)
let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)

// Consultar historial paginado de conciliaciones de servicios
AccountingReconciliationAPI.mobileGetAccountingReconciliationServicesNestedHistory(fechaDesde: fechaDesde, fechaHasta: fechaHasta, cuentaId: cuentaId) { (response, error) in
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
 **fechaDesde** | **Date** | Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **Date** | Valor de fechaHasta aceptado por el handler. | [optional] 
 **cuentaId** | **String** | Identificador de la cuenta bancaria. | [optional] 

### Return type

[**GetAccountingReconciliationServicesHistoryResponse**](GetAccountingReconciliationServicesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReconciliationStats**
```swift
    open class func mobileGetAccountingReconciliationStats(completion: @escaping (_ data: GetAccountingReconciliationStatsResponse?, _ error: Error?) -> Void)
```

Consultar panel de conciliaciones

Resume pendientes, conciliaciones completadas hoy, eficiencia y actividad reciente por módulo.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar panel de conciliaciones
AccountingReconciliationAPI.mobileGetAccountingReconciliationStats() { (response, error) in
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

[**GetAccountingReconciliationStatsResponse**](GetAccountingReconciliationStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingReconciliationExpenses**
```swift
    open class func mobilePostAccountingReconciliationExpenses(expenseReconciliationRequest: ExpenseReconciliationRequest, tipoGasto: String? = nil, fechaDesde: Date? = nil, fechaHasta: Date? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: PostAccountingReconciliationExpensesResponse?, _ error: Error?) -> Void)
```

Registrar conciliación de gastos

Distribuye el importe de un gasto entre una o varias cuentas y registra su pago contable.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let expenseReconciliationRequest = ExpenseReconciliationRequest(tipoGasto: "tipoGasto_example", pgId: "pgId_example", gastosDEId: "gastosDEId_example", gastoCompraId: "gastoCompraId_example", referenciaId: "referenciaId_example", cuentaId: "cuentaId_example", tipoPagoId: "tipoPagoId_example", monto: 123, moneda: "moneda_example", tasaCambio: 123, descripcion: "descripcion_example", periodo: "periodo_example", observaciones: "observaciones_example", estado: "estado_example", cuentaPorPagarId: "cuentaPorPagarId_example", numeroTransaccion: "numeroTransaccion_example", distribucion: [ExpenseDistributionRequest(cuentaId: "cuentaId_example", monto: 123, porcentaje: 123)]) // ExpenseReconciliationRequest | 
let tipoGasto = "tipoGasto_example" // String | Valor de tipoGasto aceptado por el handler. (optional)
let fechaDesde = Date() // Date | Valor de fechaDesde aceptado por el handler. (optional)
let fechaHasta = Date() // Date | Valor de fechaHasta aceptado por el handler. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Registrar conciliación de gastos
AccountingReconciliationAPI.mobilePostAccountingReconciliationExpenses(expenseReconciliationRequest: expenseReconciliationRequest, tipoGasto: tipoGasto, fechaDesde: fechaDesde, fechaHasta: fechaHasta, page: page, limit: limit) { (response, error) in
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
 **expenseReconciliationRequest** | [**ExpenseReconciliationRequest**](ExpenseReconciliationRequest.md) |  | 
 **tipoGasto** | **String** | Valor de tipoGasto aceptado por el handler. | [optional] 
 **fechaDesde** | **Date** | Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **Date** | Valor de fechaHasta aceptado por el handler. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingReconciliationExpensesResponse**](PostAccountingReconciliationExpensesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingReconciliationSales**
```swift
    open class func mobilePostAccountingReconciliationSales(saleReconciliationRequest: SaleReconciliationRequest, fechaInicio: Date? = nil, fechaFin: Date? = nil, puntoDeVentaId: String? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: PostAccountingReconciliationSalesResponse?, _ error: Error?) -> Void)
```

Registrar conciliación de ventas

Abona una venta en la cuenta y medio de pago indicados, respetando el importe conciliable.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let saleReconciliationRequest = SaleReconciliationRequest(ventaId: "ventaId_example", cuentaId: "cuentaId_example", tipoPagoId: "tipoPagoId_example", monto: 123, moneda: "moneda_example", fechaReconciliacion: Date(), observaciones: "observaciones_example") // SaleReconciliationRequest | 
let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let puntoDeVentaId = "puntoDeVentaId_example" // String | Valor de puntoDeVentaId aceptado por el handler. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Registrar conciliación de ventas
AccountingReconciliationAPI.mobilePostAccountingReconciliationSales(saleReconciliationRequest: saleReconciliationRequest, fechaInicio: fechaInicio, fechaFin: fechaFin, puntoDeVentaId: puntoDeVentaId, page: page, limit: limit) { (response, error) in
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
 **saleReconciliationRequest** | [**SaleReconciliationRequest**](SaleReconciliationRequest.md) |  | 
 **fechaInicio** | **Date** | Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **Date** | Fin inclusivo del período consultado. | [optional] 
 **puntoDeVentaId** | **String** | Valor de puntoDeVentaId aceptado por el handler. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingReconciliationSalesResponse**](PostAccountingReconciliationSalesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingReconciliationServices**
```swift
    open class func mobilePostAccountingReconciliationServices(serviceReconciliationRequest: ServiceReconciliationRequest, fechaDesde: Date? = nil, fechaHasta: Date? = nil, page: Int? = nil, limit: Int? = nil, completion: @escaping (_ data: PostAccountingReconciliationServicesResponse?, _ error: Error?) -> Void)
```

Registrar conciliación de servicios

Distribuye el total de un servicio entre las cuentas y medios de pago enviados.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let serviceReconciliationRequest = ServiceReconciliationRequest(ventaServicioId: "ventaServicioId_example", distribuciones: [ServiceDistributionRequest(cuentaId: "cuentaId_example", tipoPagoId: "tipoPagoId_example", monto: 123, moneda: "moneda_example", observaciones: "observaciones_example")], fechaReconciliacion: Date()) // ServiceReconciliationRequest | 
let fechaDesde = Date() // Date | Valor de fechaDesde aceptado por el handler. (optional)
let fechaHasta = Date() // Date | Valor de fechaHasta aceptado por el handler. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)

// Registrar conciliación de servicios
AccountingReconciliationAPI.mobilePostAccountingReconciliationServices(serviceReconciliationRequest: serviceReconciliationRequest, fechaDesde: fechaDesde, fechaHasta: fechaHasta, page: page, limit: limit) { (response, error) in
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
 **serviceReconciliationRequest** | [**ServiceReconciliationRequest**](ServiceReconciliationRequest.md) |  | 
 **fechaDesde** | **Date** | Valor de fechaDesde aceptado por el handler. | [optional] 
 **fechaHasta** | **Date** | Valor de fechaHasta aceptado por el handler. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 

### Return type

[**PostAccountingReconciliationServicesResponse**](PostAccountingReconciliationServicesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

