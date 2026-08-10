# DashboardApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetDashboardStats**](DashboardApi.md#mobileGetDashboardStats) | **GET** /dashboard/stats | Consultar indicadores del panel principal |


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

