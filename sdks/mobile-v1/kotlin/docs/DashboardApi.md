# DashboardApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetDashboardDailyAverage**](DashboardApi.md#mobileGetDashboardDailyAverage) | **GET** /dashboard/daily-average | Consultar promedio diario de ingresos |
| [**mobileGetDashboardIncomeExpenses**](DashboardApi.md#mobileGetDashboardIncomeExpenses) | **GET** /dashboard/income-expenses | Consultar ingresos vs gastos del panel |
| [**mobileGetDashboardInventoryValue**](DashboardApi.md#mobileGetDashboardInventoryValue) | **GET** /dashboard/inventory-value | Consultar valor total del inventario |
| [**mobileGetDashboardLowStock**](DashboardApi.md#mobileGetDashboardLowStock) | **GET** /dashboard/low-stock | Consultar productos con stock bajo |
| [**mobileGetDashboardStats**](DashboardApi.md#mobileGetDashboardStats) | **GET** /dashboard/stats | Consultar indicadores del panel principal |
| [**mobileGetDashboardStockDistribution**](DashboardApi.md#mobileGetDashboardStockDistribution) | **GET** /dashboard/stock-distribution | Consultar distribución de stock |
| [**mobileGetDashboardTodaySales**](DashboardApi.md#mobileGetDashboardTodaySales) | **GET** /dashboard/today-sales | Consultar ventas de hoy |
| [**mobileGetDashboardTopProducts**](DashboardApi.md#mobileGetDashboardTopProducts) | **GET** /dashboard/top-products | Consultar productos más vendidos |
| [**mobileGetDashboardTransfers**](DashboardApi.md#mobileGetDashboardTransfers) | **GET** /dashboard/transfers | Consultar transferencias entre ubicaciones |


<a id="mobileGetDashboardDailyAverage"></a>
# **mobileGetDashboardDailyAverage**
> DashboardValueResponse mobileGetDashboardDailyAverage(ubicacionId, tipoUbicacion)

Consultar promedio diario de ingresos

Promedio de ingresos diarios (30 días).

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = DashboardApi()
val ubicacionId : kotlin.String = ubicacionId_example // kotlin.String | Valor de ubicacionId aceptado por el handler.
val tipoUbicacion : kotlin.String = tipoUbicacion_example // kotlin.String | Valor de tipoUbicacion aceptado por el handler.
try {
    val result : DashboardValueResponse = apiInstance.mobileGetDashboardDailyAverage(ubicacionId, tipoUbicacion)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling DashboardApi#mobileGetDashboardDailyAverage")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling DashboardApi#mobileGetDashboardDailyAverage")
    e.printStackTrace()
}
```

### Parameters
| **ubicacionId** | **kotlin.String**| Valor de ubicacionId aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipoUbicacion** | **kotlin.String**| Valor de tipoUbicacion aceptado por el handler. | [optional] [enum: almacen, punto_venta] |

### Return type

[**DashboardValueResponse**](DashboardValueResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetDashboardIncomeExpenses"></a>
# **mobileGetDashboardIncomeExpenses**
> DashboardIncomeExpenseResponse mobileGetDashboardIncomeExpenses(ubicacionId, tipoUbicacion)

Consultar ingresos vs gastos del panel

Ingresos y gastos totales más la serie mensual para la gráfica del panel.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = DashboardApi()
val ubicacionId : kotlin.String = ubicacionId_example // kotlin.String | Valor de ubicacionId aceptado por el handler.
val tipoUbicacion : kotlin.String = tipoUbicacion_example // kotlin.String | Valor de tipoUbicacion aceptado por el handler.
try {
    val result : DashboardIncomeExpenseResponse = apiInstance.mobileGetDashboardIncomeExpenses(ubicacionId, tipoUbicacion)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling DashboardApi#mobileGetDashboardIncomeExpenses")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling DashboardApi#mobileGetDashboardIncomeExpenses")
    e.printStackTrace()
}
```

### Parameters
| **ubicacionId** | **kotlin.String**| Valor de ubicacionId aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipoUbicacion** | **kotlin.String**| Valor de tipoUbicacion aceptado por el handler. | [optional] [enum: almacen, punto_venta] |

### Return type

[**DashboardIncomeExpenseResponse**](DashboardIncomeExpenseResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetDashboardInventoryValue"></a>
# **mobileGetDashboardInventoryValue**
> DashboardValueResponse mobileGetDashboardInventoryValue(ubicacionId, tipoUbicacion)

Consultar valor total del inventario

Valor total del inventario en stock.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = DashboardApi()
val ubicacionId : kotlin.String = ubicacionId_example // kotlin.String | Valor de ubicacionId aceptado por el handler.
val tipoUbicacion : kotlin.String = tipoUbicacion_example // kotlin.String | Valor de tipoUbicacion aceptado por el handler.
try {
    val result : DashboardValueResponse = apiInstance.mobileGetDashboardInventoryValue(ubicacionId, tipoUbicacion)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling DashboardApi#mobileGetDashboardInventoryValue")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling DashboardApi#mobileGetDashboardInventoryValue")
    e.printStackTrace()
}
```

### Parameters
| **ubicacionId** | **kotlin.String**| Valor de ubicacionId aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipoUbicacion** | **kotlin.String**| Valor de tipoUbicacion aceptado por el handler. | [optional] [enum: almacen, punto_venta] |

### Return type

[**DashboardValueResponse**](DashboardValueResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetDashboardLowStock"></a>
# **mobileGetDashboardLowStock**
> DashboardLowStockResponse mobileGetDashboardLowStock(ubicacionId, tipoUbicacion)

Consultar productos con stock bajo

Productos con stock bajo o crítico (top 5).

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = DashboardApi()
val ubicacionId : kotlin.String = ubicacionId_example // kotlin.String | Valor de ubicacionId aceptado por el handler.
val tipoUbicacion : kotlin.String = tipoUbicacion_example // kotlin.String | Valor de tipoUbicacion aceptado por el handler.
try {
    val result : DashboardLowStockResponse = apiInstance.mobileGetDashboardLowStock(ubicacionId, tipoUbicacion)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling DashboardApi#mobileGetDashboardLowStock")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling DashboardApi#mobileGetDashboardLowStock")
    e.printStackTrace()
}
```

### Parameters
| **ubicacionId** | **kotlin.String**| Valor de ubicacionId aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipoUbicacion** | **kotlin.String**| Valor de tipoUbicacion aceptado por el handler. | [optional] [enum: almacen, punto_venta] |

### Return type

[**DashboardLowStockResponse**](DashboardLowStockResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetDashboardStats"></a>
# **mobileGetDashboardStats**
> GetDashboardStatsResponse mobileGetDashboardStats(ubicacionId, tipoUbicacion)

Consultar indicadores del panel principal

Resume ventas, ingresos y alertas de inventario para una ubicación operativa. Permite precisar la consulta mediante ubicación, tipo de ubicación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = DashboardApi()
val ubicacionId : kotlin.String = ubicacionId_example // kotlin.String | Valor de ubicacionId aceptado por el handler.
val tipoUbicacion : kotlin.String = tipoUbicacion_example // kotlin.String | Valor de tipoUbicacion aceptado por el handler.
try {
    val result : GetDashboardStatsResponse = apiInstance.mobileGetDashboardStats(ubicacionId, tipoUbicacion)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling DashboardApi#mobileGetDashboardStats")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling DashboardApi#mobileGetDashboardStats")
    e.printStackTrace()
}
```

### Parameters
| **ubicacionId** | **kotlin.String**| Valor de ubicacionId aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipoUbicacion** | **kotlin.String**| Valor de tipoUbicacion aceptado por el handler. | [optional] [enum: almacen, punto_venta] |

### Return type

[**GetDashboardStatsResponse**](GetDashboardStatsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetDashboardStockDistribution"></a>
# **mobileGetDashboardStockDistribution**
> DashboardStockDistributionResponse mobileGetDashboardStockDistribution(ubicacionId, tipoUbicacion)

Consultar distribución de stock

Distribución de stock por categoría.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = DashboardApi()
val ubicacionId : kotlin.String = ubicacionId_example // kotlin.String | Valor de ubicacionId aceptado por el handler.
val tipoUbicacion : kotlin.String = tipoUbicacion_example // kotlin.String | Valor de tipoUbicacion aceptado por el handler.
try {
    val result : DashboardStockDistributionResponse = apiInstance.mobileGetDashboardStockDistribution(ubicacionId, tipoUbicacion)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling DashboardApi#mobileGetDashboardStockDistribution")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling DashboardApi#mobileGetDashboardStockDistribution")
    e.printStackTrace()
}
```

### Parameters
| **ubicacionId** | **kotlin.String**| Valor de ubicacionId aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipoUbicacion** | **kotlin.String**| Valor de tipoUbicacion aceptado por el handler. | [optional] [enum: almacen, punto_venta] |

### Return type

[**DashboardStockDistributionResponse**](DashboardStockDistributionResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetDashboardTodaySales"></a>
# **mobileGetDashboardTodaySales**
> DashboardValueResponse mobileGetDashboardTodaySales(ubicacionId, tipoUbicacion)

Consultar ventas de hoy

Ingresos por ventas del día actual.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = DashboardApi()
val ubicacionId : kotlin.String = ubicacionId_example // kotlin.String | Valor de ubicacionId aceptado por el handler.
val tipoUbicacion : kotlin.String = tipoUbicacion_example // kotlin.String | Valor de tipoUbicacion aceptado por el handler.
try {
    val result : DashboardValueResponse = apiInstance.mobileGetDashboardTodaySales(ubicacionId, tipoUbicacion)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling DashboardApi#mobileGetDashboardTodaySales")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling DashboardApi#mobileGetDashboardTodaySales")
    e.printStackTrace()
}
```

### Parameters
| **ubicacionId** | **kotlin.String**| Valor de ubicacionId aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipoUbicacion** | **kotlin.String**| Valor de tipoUbicacion aceptado por el handler. | [optional] [enum: almacen, punto_venta] |

### Return type

[**DashboardValueResponse**](DashboardValueResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetDashboardTopProducts"></a>
# **mobileGetDashboardTopProducts**
> DashboardTopProductsResponse mobileGetDashboardTopProducts(ubicacionId, tipoUbicacion)

Consultar productos más vendidos

Top 10 de productos más vendidos del período.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = DashboardApi()
val ubicacionId : kotlin.String = ubicacionId_example // kotlin.String | Valor de ubicacionId aceptado por el handler.
val tipoUbicacion : kotlin.String = tipoUbicacion_example // kotlin.String | Valor de tipoUbicacion aceptado por el handler.
try {
    val result : DashboardTopProductsResponse = apiInstance.mobileGetDashboardTopProducts(ubicacionId, tipoUbicacion)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling DashboardApi#mobileGetDashboardTopProducts")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling DashboardApi#mobileGetDashboardTopProducts")
    e.printStackTrace()
}
```

### Parameters
| **ubicacionId** | **kotlin.String**| Valor de ubicacionId aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipoUbicacion** | **kotlin.String**| Valor de tipoUbicacion aceptado por el handler. | [optional] [enum: almacen, punto_venta] |

### Return type

[**DashboardTopProductsResponse**](DashboardTopProductsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetDashboardTransfers"></a>
# **mobileGetDashboardTransfers**
> DashboardTransfersResponse mobileGetDashboardTransfers(ubicacionId, tipoUbicacion)

Consultar transferencias entre ubicaciones

Conteo de transferencias entre almacenes y puntos de venta.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = DashboardApi()
val ubicacionId : kotlin.String = ubicacionId_example // kotlin.String | Valor de ubicacionId aceptado por el handler.
val tipoUbicacion : kotlin.String = tipoUbicacion_example // kotlin.String | Valor de tipoUbicacion aceptado por el handler.
try {
    val result : DashboardTransfersResponse = apiInstance.mobileGetDashboardTransfers(ubicacionId, tipoUbicacion)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling DashboardApi#mobileGetDashboardTransfers")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling DashboardApi#mobileGetDashboardTransfers")
    e.printStackTrace()
}
```

### Parameters
| **ubicacionId** | **kotlin.String**| Valor de ubicacionId aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipoUbicacion** | **kotlin.String**| Valor de tipoUbicacion aceptado por el handler. | [optional] [enum: almacen, punto_venta] |

### Return type

[**DashboardTransfersResponse**](DashboardTransfersResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

