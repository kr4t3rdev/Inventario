# AccountingReportsAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetAccountingAdvancesReportsCustomers**](AccountingReportsAPI.md#mobilegetaccountingadvancesreportscustomers) | **GET** /accounting/advances/reports/customers | Consultar anticipos de clientes
[**mobileGetAccountingAdvancesReportsProviders**](AccountingReportsAPI.md#mobilegetaccountingadvancesreportsproviders) | **GET** /accounting/advances/reports/providers | Consultar anticipos a proveedores
[**mobileGetAccountingAdvancesReportsSummary**](AccountingReportsAPI.md#mobilegetaccountingadvancesreportssummary) | **GET** /accounting/advances/reports/summary | Consultar resumen de anticipos
[**mobileGetAccountingReportsClientAccountAnalysis**](AccountingReportsAPI.md#mobilegetaccountingreportsclientaccountanalysis) | **GET** /accounting/reports/client-account-analysis | Consultar análisis de cuenta de cliente
[**mobileGetAccountingReportsExchange**](AccountingReportsAPI.md#mobilegetaccountingreportsexchange) | **GET** /accounting/reports/exchange | Consultar reporte de cambio de moneda
[**mobileGetAccountingReportsExchangeImpact**](AccountingReportsAPI.md#mobilegetaccountingreportsexchangeimpact) | **GET** /accounting/reports/exchange-impact | Consultar impacto de variaciones cambiarias
[**mobileGetAccountingReportsMovements**](AccountingReportsAPI.md#mobilegetaccountingreportsmovements) | **GET** /accounting/reports/movements | Consultar movimientos contables
[**mobileGetAccountingReportsOverdueInvoices**](AccountingReportsAPI.md#mobilegetaccountingreportsoverdueinvoices) | **GET** /accounting/reports/overdue-invoices | Consultar facturas vencidas
[**mobileGetAccountingReportsSummary**](AccountingReportsAPI.md#mobilegetaccountingreportssummary) | **GET** /accounting/reports/summary | Consultar resumen financiero
[**mobileGetAccountingReportsTransfers**](AccountingReportsAPI.md#mobilegetaccountingreportstransfers) | **GET** /accounting/reports/transfers | Consultar reporte de transferencias


# **mobileGetAccountingAdvancesReportsCustomers**
```swift
    open class func mobileGetAccountingAdvancesReportsCustomers(clienteId: String? = nil, fechaInicio: Date? = nil, fechaFin: Date? = nil, completion: @escaping (_ data: GetAccountingAdvancesReportsCustomersResponse?, _ error: Error?) -> Void)
```

Consultar anticipos de clientes

Agrupa los anticipos recibidos de clientes para el período consultado. Permite precisar la consulta mediante cliente, fecha inicial, fecha final.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let clienteId = "clienteId_example" // String | Identificador del cliente. (optional)
let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)

// Consultar anticipos de clientes
AccountingReportsAPI.mobileGetAccountingAdvancesReportsCustomers(clienteId: clienteId, fechaInicio: fechaInicio, fechaFin: fechaFin) { (response, error) in
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
 **clienteId** | **String** | Identificador del cliente. | [optional] 
 **fechaInicio** | **Date** | Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **Date** | Fin inclusivo del período consultado. | [optional] 

### Return type

[**GetAccountingAdvancesReportsCustomersResponse**](GetAccountingAdvancesReportsCustomersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAdvancesReportsProviders**
```swift
    open class func mobileGetAccountingAdvancesReportsProviders(proveedorId: String? = nil, fechaInicio: Date? = nil, fechaFin: Date? = nil, completion: @escaping (_ data: GetAccountingAdvancesReportsProvidersResponse?, _ error: Error?) -> Void)
```

Consultar anticipos a proveedores

Agrupa los anticipos entregados a proveedores para el período consultado. Permite precisar la consulta mediante proveedor, fecha inicial, fecha final.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let proveedorId = "proveedorId_example" // String | Identificador del proveedor. (optional)
let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)

// Consultar anticipos a proveedores
AccountingReportsAPI.mobileGetAccountingAdvancesReportsProviders(proveedorId: proveedorId, fechaInicio: fechaInicio, fechaFin: fechaFin) { (response, error) in
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
 **proveedorId** | **String** | Identificador del proveedor. | [optional] 
 **fechaInicio** | **Date** | Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **Date** | Fin inclusivo del período consultado. | [optional] 

### Return type

[**GetAccountingAdvancesReportsProvidersResponse**](GetAccountingAdvancesReportsProvidersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAdvancesReportsSummary**
```swift
    open class func mobileGetAccountingAdvancesReportsSummary(tipo: String? = nil, fechaInicio: Date? = nil, fechaFin: Date? = nil, completion: @escaping (_ data: GetAccountingAdvancesReportsSummaryResponse?, _ error: Error?) -> Void)
```

Consultar resumen de anticipos

Resume importes y estados de anticipos de pago y cobro. Permite precisar la consulta mediante tipo, fecha inicial, fecha final.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let tipo = "tipo_example" // String | Tipo de registro solicitado. (optional)
let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)

// Consultar resumen de anticipos
AccountingReportsAPI.mobileGetAccountingAdvancesReportsSummary(tipo: tipo, fechaInicio: fechaInicio, fechaFin: fechaFin) { (response, error) in
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
 **fechaInicio** | **Date** | Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **Date** | Fin inclusivo del período consultado. | [optional] 

### Return type

[**GetAccountingAdvancesReportsSummaryResponse**](GetAccountingAdvancesReportsSummaryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsClientAccountAnalysis**
```swift
    open class func mobileGetAccountingReportsClientAccountAnalysis(clienteId: String? = nil, completion: @escaping (_ data: GetAccountingReportsClientAccountAnalysisResponse?, _ error: Error?) -> Void)
```

Consultar análisis de cuenta de cliente

Analiza deuda, pagos, vencimientos y actividad de una cuenta de cliente. Permite precisar la consulta mediante cliente.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let clienteId = "clienteId_example" // String | Identificador del cliente. (optional)

// Consultar análisis de cuenta de cliente
AccountingReportsAPI.mobileGetAccountingReportsClientAccountAnalysis(clienteId: clienteId) { (response, error) in
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
 **clienteId** | **String** | Identificador del cliente. | [optional] 

### Return type

[**GetAccountingReportsClientAccountAnalysisResponse**](GetAccountingReportsClientAccountAnalysisResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsExchange**
```swift
    open class func mobileGetAccountingReportsExchange(fechaInicio: Date? = nil, fechaFin: Date? = nil, monedaOrigen: String? = nil, monedaDestino: String? = nil, export: String? = nil, completion: @escaping (_ data: GetAccountingReportsExchangeResponse?, _ error: Error?) -> Void)
```

Consultar reporte de cambio de moneda

Reúne tasas y conversiones monetarias para evaluar operaciones de cambio. Permite precisar la consulta mediante fecha inicial, fecha final, monedaOrigen, monedaDestino, formato de exportación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let monedaOrigen = "monedaOrigen_example" // String | Valor de monedaOrigen aceptado por el handler. (optional)
let monedaDestino = "monedaDestino_example" // String | Valor de monedaDestino aceptado por el handler. (optional)
let export = "export_example" // String | Valor de export aceptado por el handler. (optional)

// Consultar reporte de cambio de moneda
AccountingReportsAPI.mobileGetAccountingReportsExchange(fechaInicio: fechaInicio, fechaFin: fechaFin, monedaOrigen: monedaOrigen, monedaDestino: monedaDestino, export: export) { (response, error) in
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
 **monedaOrigen** | **String** | Valor de monedaOrigen aceptado por el handler. | [optional] 
 **monedaDestino** | **String** | Valor de monedaDestino aceptado por el handler. | [optional] 
 **export** | **String** | Valor de export aceptado por el handler. | [optional] 

### Return type

[**GetAccountingReportsExchangeResponse**](GetAccountingReportsExchangeResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsExchangeImpact**
```swift
    open class func mobileGetAccountingReportsExchangeImpact(fechaInicio: Date? = nil, fechaFin: Date? = nil, monedaBase: String? = nil, tipoAnalisis: String? = nil, completion: @escaping (_ data: GetAccountingReportsExchangeImpactResponse?, _ error: Error?) -> Void)
```

Consultar impacto de variaciones cambiarias

Calcula el efecto de las tasas aplicadas sobre movimientos y saldos convertidos. Permite precisar la consulta mediante fecha inicial, fecha final, monedaBase, tipoAnalisis.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let monedaBase = "monedaBase_example" // String | Valor de monedaBase aceptado por el handler. (optional)
let tipoAnalisis = "tipoAnalisis_example" // String | Valor de tipoAnalisis aceptado por el handler. (optional)

// Consultar impacto de variaciones cambiarias
AccountingReportsAPI.mobileGetAccountingReportsExchangeImpact(fechaInicio: fechaInicio, fechaFin: fechaFin, monedaBase: monedaBase, tipoAnalisis: tipoAnalisis) { (response, error) in
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
 **monedaBase** | **String** | Valor de monedaBase aceptado por el handler. | [optional] 
 **tipoAnalisis** | **String** | Valor de tipoAnalisis aceptado por el handler. | [optional] 

### Return type

[**GetAccountingReportsExchangeImpactResponse**](GetAccountingReportsExchangeImpactResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsMovements**
```swift
    open class func mobileGetAccountingReportsMovements(busqueda: String? = nil, fechaInicio: Date? = nil, fechaFin: Date? = nil, cuentaId: String? = nil, tipoMovimiento: String? = nil, moneda: String? = nil, page: Int? = nil, limit: Int? = nil, formato: String? = nil, completion: @escaping (_ data: GetAccountingReportsMovementsResponse?, _ error: Error?) -> Void)
```

Consultar movimientos contables

Lista entradas y salidas contables y puede devolver su exportación CSV. Permite precisar la consulta mediante texto libre, fecha inicial, fecha final, cuenta bancaria, tipo de movimiento, moneda, página, límite por página, formato de exportación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let busqueda = "busqueda_example" // String | Valor de busqueda aceptado por el handler. (optional)
let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)
let tipoMovimiento = "tipoMovimiento_example" // String | Valor de tipoMovimiento aceptado por el handler. (optional)
let moneda = "moneda_example" // String | Código de moneda. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)
let formato = "formato_example" // String | Valor de formato aceptado por el handler. (optional)

// Consultar movimientos contables
AccountingReportsAPI.mobileGetAccountingReportsMovements(busqueda: busqueda, fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaId: cuentaId, tipoMovimiento: tipoMovimiento, moneda: moneda, page: page, limit: limit, formato: formato) { (response, error) in
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
 **busqueda** | **String** | Valor de busqueda aceptado por el handler. | [optional] 
 **fechaInicio** | **Date** | Inicio inclusivo del período consultado. | [optional] 
 **fechaFin** | **Date** | Fin inclusivo del período consultado. | [optional] 
 **cuentaId** | **String** | Identificador de la cuenta bancaria. | [optional] 
 **tipoMovimiento** | **String** | Valor de tipoMovimiento aceptado por el handler. | [optional] 
 **moneda** | **String** | Código de moneda. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 
 **formato** | **String** | Valor de formato aceptado por el handler. | [optional] 

### Return type

[**GetAccountingReportsMovementsResponse**](GetAccountingReportsMovementsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsOverdueInvoices**
```swift
    open class func mobileGetAccountingReportsOverdueInvoices(completion: @escaping (_ data: GetAccountingReportsOverdueInvoicesResponse?, _ error: Error?) -> Void)
```

Consultar facturas vencidas

Identifica facturas cuyo vencimiento pasó y que aún conservan saldo pendiente.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar facturas vencidas
AccountingReportsAPI.mobileGetAccountingReportsOverdueInvoices() { (response, error) in
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

[**GetAccountingReportsOverdueInvoicesResponse**](GetAccountingReportsOverdueInvoicesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsSummary**
```swift
    open class func mobileGetAccountingReportsSummary(fechaInicio: Date? = nil, fechaFin: Date? = nil, cuentaId: String? = nil, moneda: String? = nil, export: String? = nil, completion: @escaping (_ data: GetAccountingReportsSummaryResponse?, _ error: Error?) -> Void)
```

Consultar resumen financiero

Consolida saldos, ingresos, egresos y actividad contable del período. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria, moneda, formato de exportación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let cuentaId = "cuentaId_example" // String | Identificador de la cuenta bancaria. (optional)
let moneda = "moneda_example" // String | Código de moneda. (optional)
let export = "export_example" // String | Valor de export aceptado por el handler. (optional)

// Consultar resumen financiero
AccountingReportsAPI.mobileGetAccountingReportsSummary(fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaId: cuentaId, moneda: moneda, export: export) { (response, error) in
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
 **moneda** | **String** | Código de moneda. | [optional] 
 **export** | **String** | Valor de export aceptado por el handler. | [optional] 

### Return type

[**GetAccountingReportsSummaryResponse**](GetAccountingReportsSummaryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingReportsTransfers**
```swift
    open class func mobileGetAccountingReportsTransfers(fechaInicio: Date? = nil, fechaFin: Date? = nil, cuentaOrigenId: String? = nil, cuentaDestinoId: String? = nil, moneda: String? = nil, page: Int? = nil, limit: Int? = nil, realizadoPor: String? = nil, export: String? = nil, completion: @escaping (_ data: GetAccountingReportsTransfersResponse?, _ error: Error?) -> Void)
```

Consultar reporte de transferencias

Analiza transferencias por cuentas, monedas y responsable, con exportación opcional. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta de origen, cuenta de destino, moneda, página, límite por página, usuario responsable, formato de exportación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let fechaInicio = Date() // Date | Inicio inclusivo del período consultado. (optional)
let fechaFin = Date() // Date | Fin inclusivo del período consultado. (optional)
let cuentaOrigenId = "cuentaOrigenId_example" // String | Valor de cuentaOrigenId aceptado por el handler. (optional)
let cuentaDestinoId = "cuentaDestinoId_example" // String | Valor de cuentaDestinoId aceptado por el handler. (optional)
let moneda = "moneda_example" // String | Código de moneda. (optional)
let page = 987 // Int | Página solicitada, comenzando en 1. (optional)
let limit = 987 // Int | Cantidad máxima de elementos por página. (optional)
let realizadoPor = "realizadoPor_example" // String | Valor de realizadoPor aceptado por el handler. (optional)
let export = "export_example" // String | Valor de export aceptado por el handler. (optional)

// Consultar reporte de transferencias
AccountingReportsAPI.mobileGetAccountingReportsTransfers(fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaOrigenId: cuentaOrigenId, cuentaDestinoId: cuentaDestinoId, moneda: moneda, page: page, limit: limit, realizadoPor: realizadoPor, export: export) { (response, error) in
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
 **cuentaOrigenId** | **String** | Valor de cuentaOrigenId aceptado por el handler. | [optional] 
 **cuentaDestinoId** | **String** | Valor de cuentaDestinoId aceptado por el handler. | [optional] 
 **moneda** | **String** | Código de moneda. | [optional] 
 **page** | **Int** | Página solicitada, comenzando en 1. | [optional] 
 **limit** | **Int** | Cantidad máxima de elementos por página. | [optional] 
 **realizadoPor** | **String** | Valor de realizadoPor aceptado por el handler. | [optional] 
 **export** | **String** | Valor de export aceptado por el handler. | [optional] 

### Return type

[**GetAccountingReportsTransfersResponse**](GetAccountingReportsTransfersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

