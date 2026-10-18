# DashboardAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetDashboardDailyAverage**](DashboardAPI.md#mobilegetdashboarddailyaverage) | **GET** /dashboard/daily-average | Consultar promedio diario de ingresos
[**mobileGetDashboardIncomeExpenses**](DashboardAPI.md#mobilegetdashboardincomeexpenses) | **GET** /dashboard/income-expenses | Consultar ingresos vs gastos del panel
[**mobileGetDashboardInventoryValue**](DashboardAPI.md#mobilegetdashboardinventoryvalue) | **GET** /dashboard/inventory-value | Consultar valor total del inventario
[**mobileGetDashboardLowStock**](DashboardAPI.md#mobilegetdashboardlowstock) | **GET** /dashboard/low-stock | Consultar productos con stock bajo
[**mobileGetDashboardStats**](DashboardAPI.md#mobilegetdashboardstats) | **GET** /dashboard/stats | Consultar indicadores del panel principal
[**mobileGetDashboardStockDistribution**](DashboardAPI.md#mobilegetdashboardstockdistribution) | **GET** /dashboard/stock-distribution | Consultar distribución de stock
[**mobileGetDashboardTodaySales**](DashboardAPI.md#mobilegetdashboardtodaysales) | **GET** /dashboard/today-sales | Consultar ventas de hoy
[**mobileGetDashboardTopProducts**](DashboardAPI.md#mobilegetdashboardtopproducts) | **GET** /dashboard/top-products | Consultar productos más vendidos
[**mobileGetDashboardTransfers**](DashboardAPI.md#mobilegetdashboardtransfers) | **GET** /dashboard/transfers | Consultar transferencias entre ubicaciones


# **mobileGetDashboardDailyAverage**
```swift
    open class func mobileGetDashboardDailyAverage(ubicacionId: String? = nil, tipoUbicacion: TipoUbicacion_mobileGetDashboardDailyAverage? = nil, completion: @escaping (_ data: DashboardValueResponse?, _ error: Error?) -> Void)
```

Consultar promedio diario de ingresos

Promedio de ingresos diarios (30 días).

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let ubicacionId = "ubicacionId_example" // String | Valor de ubicacionId aceptado por el handler. (optional)
let tipoUbicacion = "tipoUbicacion_example" // String | Valor de tipoUbicacion aceptado por el handler. (optional)

// Consultar promedio diario de ingresos
DashboardAPI.mobileGetDashboardDailyAverage(ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion) { (response, error) in
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
 **ubicacionId** | **String** | Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String** | Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardValueResponse**](DashboardValueResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardIncomeExpenses**
```swift
    open class func mobileGetDashboardIncomeExpenses(ubicacionId: String? = nil, tipoUbicacion: TipoUbicacion_mobileGetDashboardIncomeExpenses? = nil, completion: @escaping (_ data: DashboardIncomeExpenseResponse?, _ error: Error?) -> Void)
```

Consultar ingresos vs gastos del panel

Ingresos y gastos totales más la serie mensual para la gráfica del panel.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let ubicacionId = "ubicacionId_example" // String | Valor de ubicacionId aceptado por el handler. (optional)
let tipoUbicacion = "tipoUbicacion_example" // String | Valor de tipoUbicacion aceptado por el handler. (optional)

// Consultar ingresos vs gastos del panel
DashboardAPI.mobileGetDashboardIncomeExpenses(ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion) { (response, error) in
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
 **ubicacionId** | **String** | Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String** | Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardIncomeExpenseResponse**](DashboardIncomeExpenseResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardInventoryValue**
```swift
    open class func mobileGetDashboardInventoryValue(ubicacionId: String? = nil, tipoUbicacion: TipoUbicacion_mobileGetDashboardInventoryValue? = nil, completion: @escaping (_ data: DashboardValueResponse?, _ error: Error?) -> Void)
```

Consultar valor total del inventario

Valor total del inventario en stock.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let ubicacionId = "ubicacionId_example" // String | Valor de ubicacionId aceptado por el handler. (optional)
let tipoUbicacion = "tipoUbicacion_example" // String | Valor de tipoUbicacion aceptado por el handler. (optional)

// Consultar valor total del inventario
DashboardAPI.mobileGetDashboardInventoryValue(ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion) { (response, error) in
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
 **ubicacionId** | **String** | Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String** | Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardValueResponse**](DashboardValueResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardLowStock**
```swift
    open class func mobileGetDashboardLowStock(ubicacionId: String? = nil, tipoUbicacion: TipoUbicacion_mobileGetDashboardLowStock? = nil, completion: @escaping (_ data: DashboardLowStockResponse?, _ error: Error?) -> Void)
```

Consultar productos con stock bajo

Productos con stock bajo o crítico (top 5).

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let ubicacionId = "ubicacionId_example" // String | Valor de ubicacionId aceptado por el handler. (optional)
let tipoUbicacion = "tipoUbicacion_example" // String | Valor de tipoUbicacion aceptado por el handler. (optional)

// Consultar productos con stock bajo
DashboardAPI.mobileGetDashboardLowStock(ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion) { (response, error) in
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
 **ubicacionId** | **String** | Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String** | Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardLowStockResponse**](DashboardLowStockResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardStats**
```swift
    open class func mobileGetDashboardStats(ubicacionId: String? = nil, tipoUbicacion: TipoUbicacion_mobileGetDashboardStats? = nil, completion: @escaping (_ data: GetDashboardStatsResponse?, _ error: Error?) -> Void)
```

Consultar indicadores del panel principal

Resume ventas, ingresos y alertas de inventario para una ubicación operativa. Permite precisar la consulta mediante ubicación, tipo de ubicación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let ubicacionId = "ubicacionId_example" // String | Valor de ubicacionId aceptado por el handler. (optional)
let tipoUbicacion = "tipoUbicacion_example" // String | Valor de tipoUbicacion aceptado por el handler. (optional)

// Consultar indicadores del panel principal
DashboardAPI.mobileGetDashboardStats(ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion) { (response, error) in
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
 **ubicacionId** | **String** | Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String** | Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**GetDashboardStatsResponse**](GetDashboardStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardStockDistribution**
```swift
    open class func mobileGetDashboardStockDistribution(ubicacionId: String? = nil, tipoUbicacion: TipoUbicacion_mobileGetDashboardStockDistribution? = nil, completion: @escaping (_ data: DashboardStockDistributionResponse?, _ error: Error?) -> Void)
```

Consultar distribución de stock

Distribución de stock por categoría.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let ubicacionId = "ubicacionId_example" // String | Valor de ubicacionId aceptado por el handler. (optional)
let tipoUbicacion = "tipoUbicacion_example" // String | Valor de tipoUbicacion aceptado por el handler. (optional)

// Consultar distribución de stock
DashboardAPI.mobileGetDashboardStockDistribution(ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion) { (response, error) in
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
 **ubicacionId** | **String** | Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String** | Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardStockDistributionResponse**](DashboardStockDistributionResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardTodaySales**
```swift
    open class func mobileGetDashboardTodaySales(ubicacionId: String? = nil, tipoUbicacion: TipoUbicacion_mobileGetDashboardTodaySales? = nil, completion: @escaping (_ data: DashboardValueResponse?, _ error: Error?) -> Void)
```

Consultar ventas de hoy

Ingresos por ventas del día actual.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let ubicacionId = "ubicacionId_example" // String | Valor de ubicacionId aceptado por el handler. (optional)
let tipoUbicacion = "tipoUbicacion_example" // String | Valor de tipoUbicacion aceptado por el handler. (optional)

// Consultar ventas de hoy
DashboardAPI.mobileGetDashboardTodaySales(ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion) { (response, error) in
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
 **ubicacionId** | **String** | Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String** | Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardValueResponse**](DashboardValueResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardTopProducts**
```swift
    open class func mobileGetDashboardTopProducts(ubicacionId: String? = nil, tipoUbicacion: TipoUbicacion_mobileGetDashboardTopProducts? = nil, completion: @escaping (_ data: DashboardTopProductsResponse?, _ error: Error?) -> Void)
```

Consultar productos más vendidos

Top 10 de productos más vendidos del período.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let ubicacionId = "ubicacionId_example" // String | Valor de ubicacionId aceptado por el handler. (optional)
let tipoUbicacion = "tipoUbicacion_example" // String | Valor de tipoUbicacion aceptado por el handler. (optional)

// Consultar productos más vendidos
DashboardAPI.mobileGetDashboardTopProducts(ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion) { (response, error) in
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
 **ubicacionId** | **String** | Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String** | Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardTopProductsResponse**](DashboardTopProductsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetDashboardTransfers**
```swift
    open class func mobileGetDashboardTransfers(ubicacionId: String? = nil, tipoUbicacion: TipoUbicacion_mobileGetDashboardTransfers? = nil, completion: @escaping (_ data: DashboardTransfersResponse?, _ error: Error?) -> Void)
```

Consultar transferencias entre ubicaciones

Conteo de transferencias entre almacenes y puntos de venta.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let ubicacionId = "ubicacionId_example" // String | Valor de ubicacionId aceptado por el handler. (optional)
let tipoUbicacion = "tipoUbicacion_example" // String | Valor de tipoUbicacion aceptado por el handler. (optional)

// Consultar transferencias entre ubicaciones
DashboardAPI.mobileGetDashboardTransfers(ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion) { (response, error) in
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
 **ubicacionId** | **String** | Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String** | Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**DashboardTransfersResponse**](DashboardTransfersResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

